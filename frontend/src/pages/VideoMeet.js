import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  IconButton,
  TextField,
  Button,
  Badge,
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

const socketServer = server;

const peerConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeet() {
  const socketRef = useRef();
  const mySocketId = useRef();

  const localVideoRef = useRef();
  const peersRef = useRef({});
  const localStreamRef = useRef();

  const [videos, setVideos] = useState([]);
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);

  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessages, setNewMessages] = useState(0);
  const [message, setMessage] = useState("");

  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);

  // ================= MEDIA =================
  const getUserMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;
    localVideoRef.current.srcObject = stream;
  };

  // ================= SOCKET =================
  const createPeer = (remoteId) => {
    const pc = new RTCPeerConnection(peerConfig);

    // SEND TRACKS
    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    // RECEIVE TRACKS
    pc.ontrack = (event) => {
      setVideos((prev) => {
        if (prev.find((v) => v.socketId === remoteId)) return prev;
        return [...prev, { socketId: remoteId, stream: event.streams[0] }];
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit(
          "signal",
          remoteId,
          JSON.stringify({ ice: event.candidate })
        );
      }
    };

    peersRef.current[remoteId] = pc;
    return pc;
  };

  const handleSignal = async (fromId, message) => {
    const data = JSON.parse(message);
    const pc = peersRef.current[fromId];

    if (data.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      if (data.sdp.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current.emit(
          "signal",
          fromId,
          JSON.stringify({ sdp: pc.localDescription })
        );
      }
    }

    if (data.ice) {
      await pc.addIceCandidate(new RTCIceCandidate(data.ice));
    }
  };

  const joinRoom = async () => {
    await getUserMedia();

    socketRef.current = io(socketServer);
    socketRef.current.on("signal", handleSignal);

    socketRef.current.on("connect", () => {
      mySocketId.current = socketRef.current.id;
      socketRef.current.emit("join-call", window.location.pathname);
    });

    socketRef.current.on("user-joined", (id, clients) => {
      clients.forEach(async (clientId) => {
        if (clientId === mySocketId.current) return;

        const pc = createPeer(clientId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socketRef.current.emit(
          "signal",
          clientId,
          JSON.stringify({ sdp: pc.localDescription })
        );
      });
    });

    socketRef.current.on("user-left", (id) => {
      if (peersRef.current[id]) peersRef.current[id].close();
      delete peersRef.current[id];
      setVideos((prev) => prev.filter((v) => v.socketId !== id));
    });

    socketRef.current.on("chat-message", (data, sender, senderId) => {
      setMessages((prev) => [...prev, { sender, data }]);
      if (senderId !== mySocketId.current) {
        setNewMessages((n) => n + 1);
      }
    });

    setJoined(true);
  };

  // ================= CONTROLS =================
  const toggleVideo = () => {
    const track = localStreamRef.current
      .getTracks()
      .find((t) => t.kind === "video");
    track.enabled = !track.enabled;
    setVideoOn(track.enabled);
  };

  const toggleAudio = () => {
    const track = localStreamRef.current
      .getTracks()
      .find((t) => t.kind === "audio");
    track.enabled = !track.enabled;
    setAudioOn(track.enabled);
  };

  const endCall = () => {
    localStreamRef.current.getTracks().forEach((t) => t.stop());
    window.location.href = "/";
  };

  const sendMessage = () => {
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  // ================= UI =================
  if (!joined) {
    return (
      <div style={{ textAlign: "center" }}>
        <h2>Join Meeting</h2>
        <TextField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <br /><br />
        <Button variant="contained" onClick={joinRoom}>
          Join
        </Button>
        <br /><br />
        <video ref={localVideoRef} autoPlay muted />
      </div>
    );
  }

  return (
    <div className={styles.meetVideoContainer}>
      {/* CHAT */}
      {chatOpen && (
        <div className={styles.chatRoom}>
          <div className={styles.chatContainer}>
            <h3>Chat</h3>
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
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button onClick={sendMessage}>Send</Button>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLS */}
      <div className={styles.buttonContainers}>
        <IconButton onClick={toggleVideo}>
          {videoOn ? <VideocamIcon /> : <VideocamOffIcon />}
        </IconButton>
        <IconButton onClick={toggleAudio}>
          {audioOn ? <MicIcon /> : <MicOffIcon />}
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

      {/* VIDEOS */}
      <video
        ref={localVideoRef}
        className={styles.meetUserVideo}
        autoPlay
        muted
      />

      <div className={styles.conferenceView}>
        {videos.map((v) => (
          <video
            key={v.socketId}
            autoPlay
            playsInline
            ref={(el) => el && (el.srcObject = v.stream)}
          />
        ))}
      </div>
    </div>
  );
}
