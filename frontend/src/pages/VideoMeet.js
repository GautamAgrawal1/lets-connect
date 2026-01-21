import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { Badge, IconButton, TextField, Button } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import styles from "../styles/videoComponent.module.css";
import server from "../environment";

const server_url = server;

const connections = {};

const peerConfigConnections = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },

    // ✅ TURN (IMPORTANT)
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export default function VideoMeetComponent() {
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoRef = useRef();
  const videoRef = useRef([]);

  const [videos, setVideos] = useState([]);
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [showModal, setModal] = useState(true);

  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");

  /* ===================== MEDIA ===================== */

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        window.localStream = stream;
        localVideoRef.current.srcObject = stream;
      });
  }, []);

  const toggleVideo = () => {
    window.localStream.getVideoTracks().forEach((t) => (t.enabled = !video));
    setVideo(!video);
  };

  const toggleAudio = () => {
    window.localStream.getAudioTracks().forEach((t) => (t.enabled = !audio));
    setAudio(!audio);
  };

  /* ===================== SOCKET ===================== */

  const connectToSocketServer = () => {
    socketRef.current = io(server_url);

    socketRef.current.on("connect", () => {
      socketIdRef.current = socketRef.current.id;
      socketRef.current.emit("join-call", window.location.href);
    });

    socketRef.current.on("signal", gotMessageFromServer);
    socketRef.current.on("chat-message", addMessage);

    socketRef.current.on("user-left", (id) => {
      setVideos((v) => v.filter((x) => x.socketId !== id));
    });

    socketRef.current.on("user-joined", (id, clients) => {
      clients.forEach((clientId) => {
        if (connections[clientId]) return;

        const pc = new RTCPeerConnection(peerConfigConnections);
        connections[clientId] = pc;

        // ✅ ADD TRACKS
        window.localStream.getTracks().forEach((track) =>
          pc.addTrack(track, window.localStream)
        );

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socketRef.current.emit(
              "signal",
              clientId,
              JSON.stringify({ ice: e.candidate })
            );
          }
        };

        pc.ontrack = (event) => {
          const stream = event.streams[0];

          setVideos((prev) => {
            if (prev.find((v) => v.socketId === clientId)) return prev;
            return [...prev, { socketId: clientId, stream }];
          });
        };

        if (clientId === socketIdRef.current) return;

        pc.createOffer().then((offer) => {
          pc.setLocalDescription(offer);
          socketRef.current.emit(
            "signal",
            clientId,
            JSON.stringify({ sdp: offer })
          );
        });
      });
    });
  };

  const gotMessageFromServer = (fromId, message) => {
    const signal = JSON.parse(message);
    const pc = connections[fromId];

    if (signal.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
        if (signal.sdp.type === "offer") {
          pc.createAnswer().then((answer) => {
            pc.setLocalDescription(answer);
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
      pc.addIceCandidate(new RTCIceCandidate(signal.ice));
    }
  };

  /* ===================== CHAT ===================== */

  const addMessage = (data, sender, socketId) => {
    setMessages((m) => [...m, { sender, data }]);
    if (socketId !== socketIdRef.current) {
      setNewMessages((n) => n + 1);
    }
  };

  const sendMessage = () => {
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  /* ===================== JOIN ===================== */

  const connect = () => {
    setAskForUsername(false);
    connectToSocketServer();
  };

  /* ===================== UI ===================== */

  return (
    <>
      {askForUsername ? (
        <div>
          <h2>Enter Lobby</h2>
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Button onClick={connect}>Join</Button>
          <video ref={localVideoRef} autoPlay muted />
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          <video
            className={styles.meetUserVideo}
            ref={localVideoRef}
            autoPlay
            muted
          />

          <div className={styles.conferenceView}>
            {videos.map((v) => (
              <video
                key={v.socketId}
                ref={(ref) => ref && (ref.srcObject = v.stream)}
                autoPlay
                playsInline
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
            <IconButton onClick={() => window.location.reload()}>
              <CallEndIcon style={{ color: "red" }} />
            </IconButton>
            <IconButton onClick={() => setModal(!showModal)}>
              <Badge badgeContent={newMessages} color="primary">
                <ChatIcon />
              </Badge>
            </IconButton>
          </div>

          {showModal && (
            <div className={styles.chatRoom}>
              {messages.map((m, i) => (
                <p key={i}>
                  <b>{m.sender}</b>: {m.data}
                </p>
              ))}
              <TextField
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button onClick={sendMessage}>Send</Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
