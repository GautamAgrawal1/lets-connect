import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  IconButton,
  TextField,
  Badge,
  Button
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

const server_url = server;

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

export default function VideoMeet() {
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);

  const [videos, setVideos] = useState([]);
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);

  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);

  /* ================= MEDIA ================= */

  const getUserMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localStreamRef.current = stream;
    localVideoRef.current.srcObject = stream;
  };

  /* ================= SOCKET ================= */

  const connectSocket = () => {
    socketRef.current = io(server_url, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", window.location.pathname);
    });

    socketRef.current.on("user-joined", (socketId, clients) => {
      clients.forEach(id => {
        if (id === socketRef.current.id) return;
        createPeer(id, true);
      });
    });

    socketRef.current.on("signal", handleSignal);

    socketRef.current.on("user-left", id => {
      if (peersRef.current[id]) {
        peersRef.current[id].close();
        delete peersRef.current[id];
      }
      setVideos(prev => prev.filter(v => v.id !== id));
    });

    socketRef.current.on("chat-message", (data, sender, senderId) => {
      setMessages(prev => [...prev, { sender, data }]);
      if (senderId !== socketRef.current.id) {
        setNewMessages(n => n + 1);
      }
    });
  };

  /* ================= PEER ================= */

  const createPeer = (id, initiator) => {
    const peer = new RTCPeerConnection(iceServers);

    peersRef.current[id] = peer;

    localStreamRef.current.getTracks().forEach(track => {
      peer.addTrack(track, localStreamRef.current);
    });

    peer.onicecandidate = e => {
      if (e.candidate) {
        socketRef.current.emit(
          "signal",
          id,
          JSON.stringify({ ice: e.candidate })
        );
      }
    };

    peer.ontrack = e => {
      const stream = e.streams[0];

      setVideos(prev => {
        if (prev.find(v => v.id === id)) return prev;
        return [...prev, { id, stream }];
      });
    };

    if (initiator) {
      peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        socketRef.current.emit(
          "signal",
          id,
          JSON.stringify({ sdp: offer })
        );
      });
    }
  };

  const handleSignal = async (fromId, msg) => {
    const signal = JSON.parse(msg);
    let peer = peersRef.current[fromId];

    if (!peer) {
      peer = createPeer(fromId, false);
    }

    if (signal.sdp) {
      await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      if (signal.sdp.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socketRef.current.emit(
          "signal",
          fromId,
          JSON.stringify({ sdp: answer })
        );
      }
    }

    if (signal.ice) {
      await peer.addIceCandidate(new RTCIceCandidate(signal.ice));
    }
  };

  /* ================= CONTROLS ================= */

  const toggleVideo = () => {
    const track = localStreamRef.current.getVideoTracks()[0];
    track.enabled = !track.enabled;
    setVideoOn(track.enabled);
  };

  const toggleAudio = () => {
    const track = localStreamRef.current.getAudioTracks()[0];
    track.enabled = !track.enabled;
    setAudioOn(track.enabled);
  };

  const toggleScreen = async () => {
    if (!screenOn) {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      Object.values(peersRef.current).forEach(peer => {
        const sender = peer.getSenders().find(s => s.track.kind === "video");
        sender.replaceTrack(screenTrack);
      });

      screenTrack.onended = () => stopScreen();
      localVideoRef.current.srcObject = screenStream;
      setScreenOn(true);
    } else {
      stopScreen();
    }
  };

  const stopScreen = () => {
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    Object.values(peersRef.current).forEach(peer => {
      const sender = peer.getSenders().find(s => s.track.kind === "video");
      sender.replaceTrack(videoTrack);
    });
    localVideoRef.current.srcObject = localStreamRef.current;
    setScreenOn(false);
  };

  const sendMessage = () => {
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  const endCall = () => {
    window.location.href = "/";
  };

  /* ================= INIT ================= */

  const joinMeeting = async () => {
    await getUserMedia();
    connectSocket();
    setJoined(true);
  };

  /* ================= UI ================= */

  return (
    <div>
      {!joined ? (
        <div>
          <h2>Enter Meeting</h2>
          <TextField value={username} onChange={e => setUsername(e.target.value)} label="Name" />
          <Button onClick={joinMeeting}>Join</Button>
          <video ref={localVideoRef} autoPlay muted />
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          <video ref={localVideoRef} className={styles.meetUserVideo} autoPlay muted />

          <div className={styles.conferenceView}>
            {videos.map(v => (
              <video
                key={v.id}
                ref={ref => ref && (ref.srcObject = v.stream)}
                autoPlay
                playsInline
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

            <IconButton onClick={endCall} style={{ color: "red" }}>
              <CallEndIcon />
            </IconButton>

            <Badge badgeContent={newMessages}>
              <IconButton onClick={() => setChatOpen(!chatOpen)}>
                <ChatIcon />
              </IconButton>
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
