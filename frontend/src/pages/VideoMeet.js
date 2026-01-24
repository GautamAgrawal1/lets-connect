import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  IconButton,
  Badge,
  TextField,
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

const socketURL = server;

const peerConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const connections = {};

export default function VideoMeet() {
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoRef = useRef();
  const videoRefs = useRef([]);

  const [videos, setVideos] = useState([]);
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);

  const [username, setUsername] = useState("");
  const [askForUsername, setAskForUsername] = useState(true);

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [showChat, setShowChat] = useState(false);

  /* ================= JOIN CALL ================= */
  const connect = async () => {
    setAskForUsername(false);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    window.localStream = stream;
    localVideoRef.current.srcObject = stream;

    socketRef.current = io(socketURL);

    socketRef.current.on("connect", () => {
      socketIdRef.current = socketRef.current.id;
      socketRef.current.emit("join-call", window.location.pathname);
    });

    socketRef.current.on("signal", handleSignal);
    socketRef.current.on("user-joined", handleUserJoined);
    socketRef.current.on("user-left", handleUserLeft);
    socketRef.current.on("chat-message", addMessage);
  };

  /* ================= SIGNAL HANDLING ================= */
  const handleSignal = (fromId, message) => {
    const signal = JSON.parse(message);

    if (signal.sdp) {
      connections[fromId]
        .setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(() => {
          if (signal.sdp.type === "offer") {
            connections[fromId].createAnswer().then((answer) => {
              connections[fromId].setLocalDescription(answer);
              socketRef.current.emit(
                "signal",
                fromId,
                JSON.stringify({ sdp: answer })
              );
            });
          }
        });
    }

    if (signal.ice) {
      connections[fromId].addIceCandidate(
        new RTCIceCandidate(signal.ice)
      );
    }
  };

  /* ================= USER JOIN ================= */
  const handleUserJoined = (id, clients) => {
    clients.forEach((clientId) => {
      if (connections[clientId]) return;

      const peer = new RTCPeerConnection(peerConfig);
      connections[clientId] = peer;

      peer.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current.emit(
            "signal",
            clientId,
            JSON.stringify({ ice: e.candidate })
          );
        }
      };

      peer.ontrack = (e) => {
        setVideos((prev) => {
          if (prev.find((v) => v.id === clientId)) return prev;
          return [...prev, { id: clientId, stream: e.streams[0] }];
        });
      };

      window.localStream.getTracks().forEach((track) => {
        peer.addTrack(track, window.localStream);
      });
    });

    if (id === socketIdRef.current) {
      Object.keys(connections).forEach((id2) => {
        if (id2 === socketIdRef.current) return;
        connections[id2].createOffer().then((offer) => {
          connections[id2].setLocalDescription(offer);
          socketRef.current.emit(
            "signal",
            id2,
            JSON.stringify({ sdp: offer })
          );
        });
      });
    }
  };

  /* ================= USER LEFT ================= */
  const handleUserLeft = (id) => {
    if (connections[id]) connections[id].close();
    delete connections[id];
    setVideos((prev) => prev.filter((v) => v.id !== id));
  };

  /* ================= MEDIA CONTROLS ================= */
  const toggleVideo = () => {
    window.localStream.getVideoTracks()[0].enabled =
      !window.localStream.getVideoTracks()[0].enabled;
    setVideo(!video);
  };

  const toggleAudio = () => {
    window.localStream.getAudioTracks()[0].enabled =
      !window.localStream.getAudioTracks()[0].enabled;
    setAudio(!audio);
  };

  const toggleScreen = async () => {
    if (!screen) {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const screenTrack = screenStream.getVideoTracks()[0];

      Object.values(connections).forEach((peer) => {
        const sender = peer
          .getSenders()
          .find((s) => s.track.kind === "video");
        sender.replaceTrack(screenTrack);
      });

      screenTrack.onended = () => toggleScreen();
      setScreen(true);
    } else {
      const camTrack = window.localStream.getVideoTracks()[0];
      Object.values(connections).forEach((peer) => {
        const sender = peer
          .getSenders()
          .find((s) => s.track.kind === "video");
        sender.replaceTrack(camTrack);
      });
      setScreen(false);
    }
  };

  /* ================= CHAT ================= */
  const sendMessage = () => {
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  const addMessage = (data, sender, senderId) => {
    setMessages((prev) => [...prev, { sender, data }]);
    if (senderId !== socketIdRef.current) {
      setNewMessages((n) => n + 1);
    }
  };

  /* ================= END CALL ================= */
  const endCall = () => {
    window.localStream.getTracks().forEach((t) => t.stop());
    window.location.href = "/";
  };

  /* ================= UI ================= */
  if (askForUsername) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Enter Meeting</h2>
        <TextField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Button onClick={connect} variant="contained">
          Join
        </Button>
        <video ref={localVideoRef} autoPlay muted playsInline />
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
        playsInline
      />

      <div className={styles.conferenceView}>
        {videos.map((v) => (
          <video
            key={v.id}
            autoPlay
            playsInline
            ref={(el) => el && (el.srcObject = v.stream)}
          />
        ))}
      </div>

      <div className={styles.buttonContainers}>
        <IconButton onClick={toggleVideo}>
          {video ? <VideocamIcon /> : <VideocamOffIcon />}
        </IconButton>

        <IconButton onClick={toggleAudio}>
          {audio ? <MicIcon /> : <MicOffIcon />}
        </IconButton>

        <IconButton onClick={toggleScreen}>
          {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
        </IconButton>

        <IconButton onClick={endCall} style={{ color: "red" }}>
          <CallEndIcon />
        </IconButton>

        <Badge badgeContent={newMessages} color="primary">
          <IconButton onClick={() => setShowChat(!showChat)}>
            <ChatIcon />
          </IconButton>
        </Badge>
      </div>
    </div>
  );
}
