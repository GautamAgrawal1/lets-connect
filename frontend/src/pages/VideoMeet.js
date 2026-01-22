import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  Badge,
  IconButton,
  TextField,
  Button,
} from "@mui/material";
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

// 🔑 TURN + STUN (CRITICAL FIX)
const peerConfigConnections = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
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

const connections = {};

export default function VideoMeetComponent() {
  const socketRef = useRef(null);
  const socketIdRef = useRef(null);
  const localVideoref = useRef(null);
  const videoRef = useRef([]);

  const [videos, setVideos] = useState([]);
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);
  const [screenAvailable, setScreenAvailable] = useState(false);

  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [showModal, setModal] = useState(true);

  /* ---------------- MEDIA ---------------- */

  useEffect(() => {
    getPermissions();
  }, []);

  const getPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      window.localStream = stream;
      if (localVideoref.current) {
        localVideoref.current.srcObject = stream;
      }

      setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
    } catch (err) {
      console.error(err);
    }
  };

  /* ---------------- SOCKET ---------------- */

  const connectToSocketServer = () => {
    socketRef.current = io(server_url);

    socketRef.current.on("connect", () => {
      socketIdRef.current = socketRef.current.id;
      socketRef.current.emit("join-call", window.location.href);
    });

    socketRef.current.on("signal", gotMessageFromServer);
    socketRef.current.on("chat-message", addMessage);

    socketRef.current.on("user-left", (id) => {
      setVideos((videos) => videos.filter((v) => v.socketId !== id));
    });

    socketRef.current.on("user-joined", (id, clients) => {
      clients.forEach((clientId) => {
        if (clientId === socketIdRef.current) return;

        const peer = new RTCPeerConnection(peerConfigConnections);
        connections[clientId] = peer;

        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socketRef.current.emit(
              "signal",
              clientId,
              JSON.stringify({ ice: event.candidate })
            );
          }
        };

        peer.ontrack = (event) => {
          const stream = event.streams[0];

          if (!videoRef.current.find((v) => v.socketId === clientId)) {
            setVideos((prev) => {
              const updated = [...prev, { socketId: clientId, stream }];
              videoRef.current = updated;
              return updated;
            });
          }
        };

        // 🔑 MODERN API (addTrack)
        window.localStream.getTracks().forEach((track) => {
          peer.addTrack(track, window.localStream);
        });

        if (id === socketIdRef.current) {
          peer.createOffer().then((offer) => {
            peer.setLocalDescription(offer);
            socketRef.current.emit(
              "signal",
              clientId,
              JSON.stringify({ sdp: offer })
            );
          });
        }
      });
    });
  };

  const gotMessageFromServer = (fromId, message) => {
    const signal = JSON.parse(message);
    const peer = connections[fromId];

    if (!peer) return;

    if (signal.sdp) {
      peer.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
        if (signal.sdp.type === "offer") {
          peer.createAnswer().then((answer) => {
            peer.setLocalDescription(answer);
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
      peer.addIceCandidate(new RTCIceCandidate(signal.ice));
    }
  };

  /* ---------------- CONTROLS ---------------- */

  const handleVideo = () => {
    const track = window.localStream
      ?.getTracks()
      .find((t) => t.kind === "video");

    if (track) {
      track.enabled = !track.enabled;
      setVideo(track.enabled);
    }
  };

  const handleAudio = () => {
    const track = window.localStream
      ?.getTracks()
      .find((t) => t.kind === "audio");

    if (track) {
      track.enabled = !track.enabled;
      setAudio(track.enabled);
    }
  };

  const handleScreen = async () => {
    if (!screen) {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      replaceStream(stream);
      setScreen(true);
    } else {
      replaceStream(await navigator.mediaDevices.getUserMedia({ video: true }));
      setScreen(false);
    }
  };

  const replaceStream = (stream) => {
    window.localStream.getTracks().forEach((t) => t.stop());
    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    Object.values(connections).forEach((peer) => {
      peer.getSenders().forEach((sender) => {
        const track = stream.getTracks().find((t) => t.kind === sender.track.kind);
        if (track) sender.replaceTrack(track);
      });
    });
  };

  const handleEndCall = () => {
    window.location.href = "/";
  };

  /* ---------------- CHAT ---------------- */

  const addMessage = (data, sender, socketId) => {
    setMessages((prev) => [...prev, { sender, data }]);
    if (socketId !== socketIdRef.current) {
      setNewMessages((n) => n + 1);
    }
  };

  const sendMessage = () => {
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  const connect = () => {
    setAskForUsername(false);
    connectToSocketServer();
  };

  /* ---------------- UI ---------------- */

  return (
    <div>
      {askForUsername ? (
        <div>
          <h2>Enter Lobby</h2>
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Button onClick={connect}>Connect</Button>
          <video ref={localVideoref} autoPlay muted />
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          <video
            className={styles.meetUserVideo}
            ref={localVideoref}
            autoPlay
            muted
            playsInline
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
            <IconButton onClick={handleVideo}>
              {video ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>

            <IconButton onClick={handleEndCall} color="error">
              <CallEndIcon />
            </IconButton>

            <IconButton onClick={handleAudio}>
              {audio ? <MicIcon /> : <MicOffIcon />}
            </IconButton>

            {screenAvailable && (
              <IconButton onClick={handleScreen}>
                {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </IconButton>
            )}

            <Badge badgeContent={newMessages} color="primary">
              <IconButton onClick={() => setModal(!showModal)}>
                <ChatIcon />
              </IconButton>
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
