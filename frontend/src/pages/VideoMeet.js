import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  IconButton, Button, TextField, Badge
} from "@mui/material";

import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import CallEndIcon from "@mui/icons-material/CallEnd";
import ChatIcon from "@mui/icons-material/Chat";

import server from "../environment";
import styles from "../styles/videoComponent.module.css";

const ICE = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export default function VideoMeet() {
  const socketRef = useRef();
  const localVideoRef = useRef();
  const peersRef = useRef({});

  const [joined, setJoined] = useState(false);
  const [username, setUsername] = useState("");

  const [remoteStreams, setRemoteStreams] = useState([]);

  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);

  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMsg, setNewMsg] = useState(0);

  /* ================= MEDIA ================= */

  const getMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    window.localStream = stream;
    localVideoRef.current.srcObject = stream;
  };

  /* ================= SOCKET ================= */

  const initSocket = () => {
    socketRef.current = io(server);

    socketRef.current.emit("join-call", window.location.href);

    socketRef.current.on("user-joined", (id, clients) => {
      clients.forEach(peerId => {
        if (peerId === socketRef.current.id) return;

        const pc = new RTCPeerConnection(ICE);
        peersRef.current[peerId] = pc;

        window.localStream.getTracks().forEach(track =>
          pc.addTrack(track, window.localStream)
        );

        pc.ontrack = e => {
          setRemoteStreams(prev => {
            if (prev.find(v => v.id === peerId)) return prev;
            return [...prev, { id: peerId, stream: e.streams[0] }];
          });
        };

        pc.onicecandidate = e => {
          if (e.candidate) {
            socketRef.current.emit("signal", peerId, {
              ice: e.candidate
            });
          }
        };

        pc.createOffer().then(offer => {
          pc.setLocalDescription(offer);
          socketRef.current.emit("signal", peerId, {
            sdp: offer
          });
        });
      });
    });

    socketRef.current.on("signal", async ({ from, sdp, ice }) => {
      let pc = peersRef.current[from];

      if (!pc) {
        pc = new RTCPeerConnection(ICE);
        peersRef.current[from] = pc;

        window.localStream.getTracks().forEach(track =>
          pc.addTrack(track, window.localStream)
        );

        pc.ontrack = e => {
          setRemoteStreams(prev => [...prev, {
            id: from,
            stream: e.streams[0]
          }]);
        };

        pc.onicecandidate = e => {
          if (e.candidate) {
            socketRef.current.emit("signal", from, {
              ice: e.candidate
            });
          }
        };
      }

      if (sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        if (sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current.emit("signal", from, { sdp: answer });
        }
      }

      if (ice) {
        await pc.addIceCandidate(new RTCIceCandidate(ice));
      }
    });

    socketRef.current.on("chat-message", (data, sender) => {
      setMessages(prev => [...prev, { sender, data }]);
      setNewMsg(n => n + 1);
    });
  };

  /* ================= JOIN ================= */

  const join = async () => {
    if (!username) return alert("Enter username");
    await getMedia();
    initSocket();
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
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screen.getVideoTracks()[0];

      Object.values(peersRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track.kind === "video");
        sender.replaceTrack(screenTrack);
      });

      screenTrack.onended = () => toggleScreen();
      setScreenOn(true);
    } else {
      const camTrack = window.localStream.getVideoTracks()[0];
      Object.values(peersRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track.kind === "video");
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
      <div style={{ textAlign: "center", marginTop: 100 }}>
        <h2>Join Meeting</h2>
        <TextField value={username} onChange={e => setUsername(e.target.value)} />
        <br /><br />
        <Button variant="contained" onClick={join}>Join</Button>
        <video ref={localVideoRef} autoPlay muted />
      </div>
    );
  }

  return (
    <div className={styles.meetVideoContainer}>
      <video ref={localVideoRef} autoPlay muted className={styles.meetUserVideo} />

      <div className={styles.conferenceView}>
        {remoteStreams.map(v => (
          <video
            key={v.id}
            autoPlay
            playsInline
            ref={el => el && (el.srcObject = v.stream)}
          />
        ))}
      </div>

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

      {showChat && (
        <div className={styles.chatRoom}>
          {messages.map((m, i) => (
            <div key={i}>
              <b>{m.sender}</b>
              <p>{m.data}</p>
            </div>
          ))}
          <TextField value={message} onChange={e => setMessage(e.target.value)} />
          <Button onClick={sendMessage}>Send</Button>
        </div>
      )}
    </div>
  );
}
