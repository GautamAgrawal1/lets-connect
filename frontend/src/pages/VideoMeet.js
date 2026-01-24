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
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import CallEndIcon from "@mui/icons-material/CallEnd";
import ChatIcon from "@mui/icons-material/Chat";

import styles from "../styles/videoComponent.module.css";
import server from "../environment";

const peerConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

let connections = {};

export default function VideoMeet() {
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoRef = useRef();
  const videoRef = useRef([]);

  const [videos, setVideos] = useState([]);
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);

  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);

  /* ================= MEDIA ================= */

  const getUserMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoOn,
      audio: audioOn,
    });

    window.localStream = stream;
    localVideoRef.current.srcObject = stream;
  };

  const startScreenShare = async () => {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });

    const screenTrack = screenStream.getVideoTracks()[0];

    Object.values(connections).forEach((pc) => {
      const sender = pc
        .getSenders()
        .find((s) => s.track.kind === "video");
      sender.replaceTrack(screenTrack);
    });

    screenTrack.onended = () => stopScreenShare();
    setScreenOn(true);
  };

  const stopScreenShare = () => {
    const cameraTrack = window.localStream
      .getVideoTracks()[0];

    Object.values(connections).forEach((pc) => {
      const sender = pc
        .getSenders()
        .find((s) => s.track.kind === "video");
      sender.replaceTrack(cameraTrack);
    });

    setScreenOn(false);
  };

  /* ================= SOCKET ================= */

  const connectSocket = () => {
    socketRef.current = io(server);

    socketRef.current.on("connect", () => {
      socketIdRef.current = socketRef.current.id;
      socketRef.current.emit("join-call", window.location.href);
    });

    socketRef.current.on("signal", handleSignal);
    socketRef.current.on("user-left", removeUser);
    socketRef.current.on("chat-message", addMessage);

    socketRef.current.on("user-joined", (id, clients) => {
      clients.forEach((clientId) => {
        if (clientId === socketIdRef.current) return;
        createPeer(clientId);
      });
    });
  };

  const createPeer = (socketId) => {
    const pc = new RTCPeerConnection(peerConfig);
    connections[socketId] = pc;

    window.localStream.getTracks().forEach((track) => {
      pc.addTrack(track, window.localStream);
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit(
          "signal",
          socketId,
          JSON.stringify({ ice: e.candidate })
        );
      }
    };

    pc.ontrack = (e) => {
      setVideos((prev) => {
        if (prev.find((v) => v.socketId === socketId)) return prev;
        return [...prev, { socketId, stream: e.streams[0] }];
      });
    };

    pc.createOffer().then((offer) => {
      pc.setLocalDescription(offer);
      socketRef.current.emit(
        "signal",
        socketId,
        JSON.stringify({ sdp: offer })
      );
    });
  };

  const handleSignal = async (fromId, message) => {
    const signal = JSON.parse(message);
    const pc = connections[fromId];

    if (signal.sdp) {
      await pc.setRemoteDescription(signal.sdp);
      if (signal.sdp.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current.emit(
          "signal",
          fromId,
          JSON.stringify({ sdp: answer })
        );
      }
    }

    if (signal.ice) {
      await pc.addIceCandidate(signal.ice);
    }
  };

  const removeUser = (id) => {
    setVideos((prev) => prev.filter((v) => v.socketId !== id));
    if (connections[id]) connections[id].close();
    delete connections[id];
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

  /* ================= JOIN ================= */

  const joinMeeting = async () => {
    await getUserMedia();
    connectSocket();
    setJoined(true);
  };

  /* ================= RENDER ================= */

  return (
    <div>
      {!joined ? (
        <div>
          <h2>Enter Lobby</h2>
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Button onClick={joinMeeting}>Join</Button>
          <video ref={localVideoRef} autoPlay muted />
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          <div className={styles.conferenceView}>
            {videos.map((v) => (
              <video
                key={v.socketId}
                autoPlay
                playsInline
                ref={(ref) => ref && (ref.srcObject = v.stream)}
              />
            ))}
          </div>

          <video
            className={styles.meetUserVideo}
            ref={localVideoRef}
            autoPlay
            muted
          />

          <div className={styles.buttonContainers}>
            <IconButton onClick={() => setVideoOn(!videoOn)}>
              {videoOn ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>

            <IconButton onClick={() => setAudioOn(!audioOn)}>
              {audioOn ? <MicIcon /> : <MicOffIcon />}
            </IconButton>

            <IconButton
              onClick={screenOn ? stopScreenShare : startScreenShare}
            >
              {screenOn ? <StopScreenShareIcon /> : <ScreenShareIcon />}
            </IconButton>

            <IconButton onClick={() => window.location.reload()}>
              <CallEndIcon />
            </IconButton>

            <Badge badgeContent={newMessages}>
              <IconButton onClick={() => setChatOpen(!chatOpen)}>
                <ChatIcon />
              </IconButton>
            </Badge>
          </div>

          {chatOpen && (
            <div className={styles.chatRoom}>
              <div>
                {messages.map((m, i) => (
                  <p key={i}>
                    <b>{m.sender}:</b> {m.data}
                  </p>
                ))}
              </div>
              <TextField
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button onClick={sendMessage}>Send</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
