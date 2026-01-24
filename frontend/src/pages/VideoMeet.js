import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  IconButton,
  TextField,
  Button,
  Badge
} from "@mui/material";

import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";

import styles from "../styles/videoComponent.module.css";
import server from "../environment";

const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

export default function VideoMeet() {
  const socketRef = useRef();
  const peersRef = useRef({});
  const localVideoRef = useRef();

  const [videos, setVideos] = useState([]);
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);

  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);

  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMsg, setNewMsg] = useState(0);

  /* ================= MEDIA ================= */

  const getUserMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localVideoRef.current.srcObject = stream;
    window.localStream = stream;
  };

  /* ================= SOCKET ================= */

  const connectSocket = () => {
    socketRef.current = io(server);

    socketRef.current.emit("join-call", window.location.href);

    socketRef.current.on("user-joined", (id, clients) => {
      clients.forEach((clientId) => {
        if (clientId === socketRef.current.id) return;

        const peer = new RTCPeerConnection(ICE_CONFIG);
        peersRef.current[clientId] = peer;

        window.localStream.getTracks().forEach(track =>
          peer.addTrack(track, window.localStream)
        );

        peer.onicecandidate = e => {
          if (e.candidate) {
            socketRef.current.emit("signal", clientId, {
              ice: e.candidate
            });
          }
        };

        peer.ontrack = e => {
          setVideos(prev => {
            if (prev.find(v => v.id === clientId)) return prev;
            return [...prev, { id: clientId, stream: e.streams[0] }];
          });
        };

        peer.createOffer().then(offer => {
          peer.setLocalDescription(offer);
          socketRef.current.emit("signal", clientId, {
            sdp: offer
          });
        });
      });
    });

    socketRef.current.on("signal", ({ from, sdp, ice }) => {
      let peer = peersRef.current[from];
      if (!peer) {
        peer = new RTCPeerConnection(ICE_CONFIG);
        peersRef.current[from] = peer;

        window.localStream.getTracks().forEach(track =>
          peer.addTrack(track, window.localStream)
        );

        peer.ontrack = e => {
          setVideos(prev => [...prev, { id: from, stream: e.streams[0] }]);
        };

        peer.onicecandidate = e => {
          if (e.candidate) {
            socketRef.current.emit("signal", from, {
              ice: e.candidate
            });
          }
        };
      }

      if (sdp) {
        peer.setRemoteDescription(new RTCSessionDescription(sdp));
        if (sdp.type === "offer") {
          peer.createAnswer().then(answer => {
            peer.setLocalDescription(answer);
            socketRef.current.emit("signal", from, {
              sdp: answer
            });
          });
        }
      }

      if (ice) peer.addIceCandidate(new RTCIceCandidate(ice));
    });

    socketRef.current.on("chat-message", (data, sender) => {
      setMessages(prev => [...prev, { sender, data }]);
      setNewMsg(n => n + 1);
    });
  };

  /* ================= JOIN ================= */

  const joinMeeting = async () => {
    if (!username) return alert("Enter username");
    await getUserMedia();
    connectSocket();
    setJoined(true);
  };

  /* ================= CONTROLS ================= */

  const toggleVideo = () => {
    window.localStream.getVideoTracks()[0].enabled = !videoOn;
    setVideoOn(!videoOn);
  };

  const toggleAudio = () => {
    window.localStream.getAudioTracks()[0].enabled = !audioOn;
    setAudioOn(!audioOn);
  };

  const toggleScreen = async () => {
    if (!screenOn) {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = stream.getVideoTracks()[0];

      Object.values(peersRef.current).forEach(peer => {
        const sender = peer.getSenders().find(s => s.track.kind === "video");
        sender.replaceTrack(screenTrack);
      });

      screenTrack.onended = () => toggleScreen();
      setScreenOn(true);
    } else {
      const camTrack = window.localStream.getVideoTracks()[0];
      Object.values(peersRef.current).forEach(peer => {
        const sender = peer.getSenders().find(s => s.track.kind === "video");
        sender.replaceTrack(camTrack);
      });
      setScreenOn(false);
    }
  };

  const sendMessage = () => {
    socketRef.current.emit("chat-message", message, username);
    setMessages(prev => [...prev, { sender: "Me", data: message }]);
    setMessage("");
  };

  const endCall = () => {
    window.location.href = "/";
  };

  /* ================= UI ================= */

  if (!joined) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <h2>Join Meeting</h2>
        <TextField
          label="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <br /><br />
        <Button variant="contained" onClick={joinMeeting}>
          Join
        </Button>
        <video ref={localVideoRef} autoPlay muted />
      </div>
    );
  }

  return (
    <div className={styles.meetVideoContainer}>
      <video
        className={styles.meetUserVideo}
        ref={localVideoRef}
        autoPlay
        muted
      />

      <div className={styles.conferenceView}>
        {videos.map(v => (
          <video
            key={v.id}
            autoPlay
            playsInline
            muted={false}
            ref={el => el && (el.srcObject = v.stream)}
          />
        ))}
      </div>

      {/* CONTROLS */}
      <div className={styles.buttonContainers}>
        <IconButton onClick={toggleVideo}>
          {videoOn ? <VideocamIcon /> : <VideocamOffIcon />}
        </IconButton>

        <IconButton onClick={toggleAudio}>
          {audioOn ? <MicIcon /> : <MicOffIcon />}
        </IconButton>

        <IconButton onClick={toggleScreen}>
          {screenOn ? <StopScreenShareIcon /> : <ScreenShareIcon />}
        </IconButton>

        <Badge badgeContent={newMsg} color="primary">
          <IconButton onClick={() => {
            setShowChat(!showChat);
            setNewMsg(0);
          }}>
            <ChatIcon />
          </IconButton>
        </Badge>

        <IconButton onClick={endCall} style={{ color: "red" }}>
          <CallEndIcon />
        </IconButton>
      </div>

      {/* CHAT */}
      {showChat && (
        <div className={styles.chatRoom}>
          <div className={styles.chatContainer}>
            <div className={styles.chattingDisplay}>
              {messages.map((m, i) => (
                <div key={i}>
                  <b>{m.sender}</b>
                  <p>{m.data}</p>
                </div>
              ))}
            </div>

            <div className={styles.chattingArea}>
              <TextField
                value={message}
                onChange={e => setMessage(e.target.value)}
                fullWidth
              />
              <Button onClick={sendMessage}>Send</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
