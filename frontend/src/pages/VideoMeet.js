import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  IconButton,
  Badge,
  TextField,
  Button,
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

const ICE_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const connections = {};

export default function VideoMeet() {
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  const [remoteStreams, setRemoteStreams] = useState([]);
  const [joined, setJoined] = useState(false);

  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);

  const [username, setUsername] = useState("");

  /* ================= MEDIA ================= */

  const initMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;
    localVideoRef.current.srcObject = stream;
  };

  /* ================= SOCKET ================= */

  const initSocket = () => {
    socketRef.current = io(server, {
        transports: ["websocket"],
        secure: true
      });

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", window.location.pathname);
    });

    socketRef.current.on("user-joined", (id, clients) => {
      clients.forEach((clientId) => {
        if (!connections[clientId] && clientId !== socketRef.current.id) {
          createPeer(clientId);
        }
      });
    });

    socketRef.current.on("signal", handleSignal);
    socketRef.current.on("user-left", handleUserLeft);
  };

  const createPeer = (peerId) => {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    connections[peerId] = pc;

    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit(
          "signal",
          peerId,
          JSON.stringify({ ice: e.candidate })
        );
      }
    };

    pc.ontrack = (e) => {
      setRemoteStreams((prev) => {
        if (prev.find((s) => s.id === peerId)) return prev;
        return [...prev, { id: peerId, stream: e.streams[0] }];
      });
    };

    pc.createOffer().then((offer) => {
      pc.setLocalDescription(offer);
      socketRef.current.emit(
        "signal",
        peerId,
        JSON.stringify({ sdp: offer })
      );
    });
  };

  const handleSignal = async (fromId, message) => {
    const data = JSON.parse(message);
    const pc = connections[fromId];

    if (!pc) return;

    if (data.sdp) {
      await pc.setRemoteDescription(data.sdp);
      if (data.sdp.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current.emit(
          "signal",
          fromId,
          JSON.stringify({ sdp: answer })
        );
      }
    }

    if (data.ice) {
      await pc.addIceCandidate(data.ice);
    }
  };

  const handleUserLeft = (id) => {
    if (connections[id]) connections[id].close();
    delete connections[id];
    setRemoteStreams((prev) => prev.filter((s) => s.id !== id));
  };

  /* ================= JOIN ================= */

  const joinMeeting = async () => {
    await initMedia();     // 🔥 FIRST
    initSocket();          // 🔥 SECOND
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
          <video ref={localVideoRef} autoPlay muted playsInline />
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          <div className={styles.conferenceView}>
            {remoteStreams.map((r) => (
              <video
                key={r.id}
                autoPlay
                playsInline
                ref={(el) => el && (el.srcObject = r.stream)}
              />
            ))}
          </div>

          <video
            className={styles.meetUserVideo}
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
          />

          <div className={styles.buttonContainers}>
            <IconButton onClick={() => setVideoOn(!videoOn)}>
              {videoOn ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>

            <IconButton onClick={() => setAudioOn(!audioOn)}>
              {audioOn ? <MicIcon /> : <MicOffIcon />}
            </IconButton>

            <IconButton onClick={() => window.location.reload()}>
              <CallEndIcon />
            </IconButton>

            <IconButton>
              <ChatIcon />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  );
}
