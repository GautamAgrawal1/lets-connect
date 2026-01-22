import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { IconButton, TextField, Button, Badge } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import CallEndIcon from "@mui/icons-material/CallEnd";
import ChatIcon from "@mui/icons-material/Chat";
import styles from "../styles/videoComponent.module.css";
import server from "../environment";

const socket = io(server);

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeet() {
  const localVideoRef = useRef(null);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);

  const [joined, setJoined] = useState(false);
  const [username, setUsername] = useState("");
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState("");
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);

  // 🎥 Get camera & mic
  const startMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;
    localVideoRef.current.srcObject = stream;
  };

  // 🔌 Create peer
  const createPeer = (socketId, isOffer) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    localStreamRef.current.getTracks().forEach(track =>
      peer.addTrack(track, localStreamRef.current)
    );

    peer.ontrack = event => {
      setRemoteStreams(prev => {
        if (prev.find(v => v.id === socketId)) return prev;
        return [...prev, { id: socketId, stream: event.streams[0] }];
      });
    };

    peer.onicecandidate = event => {
      if (event.candidate) {
        socket.emit("signal", socketId, { ice: event.candidate });
      }
    };

    if (isOffer) {
      peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        socket.emit("signal", socketId, { sdp: offer });
      });
    }

    peersRef.current[socketId] = peer;
  };

  // 🔄 Socket logic
  useEffect(() => {
    socket.on("user-joined", (id, clients) => {
      clients.forEach(cid => {
        if (cid === socket.id) return;
        if (!peersRef.current[cid]) createPeer(cid, true);
      });
    });

    socket.on("signal", (from, data) => {
      let peer = peersRef.current[from];
      if (!peer) peer = createPeer(from, false);

      if (data.sdp) {
        peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === "offer") {
          peer.createAnswer().then(ans => {
            peer.setLocalDescription(ans);
            socket.emit("signal", from, { sdp: ans });
          });
        }
      }

      if (data.ice) peer.addIceCandidate(new RTCIceCandidate(data.ice));
    });

    socket.on("user-left", id => {
      if (peersRef.current[id]) peersRef.current[id].close();
      delete peersRef.current[id];
      setRemoteStreams(prev => prev.filter(v => v.id !== id));
    });

    socket.on("chat-message", msg => {
      setMessages(prev => [...prev, msg]);
    });
  }, []);

  // 🚪 Join meeting
  const joinMeeting = async () => {
    if (!username) return;
    await startMedia();
    socket.emit("join-call", window.location.pathname);
    setJoined(true);
  };

  // 🎥 Toggle video
  const toggleVideo = () => {
    const track = localStreamRef.current.getVideoTracks()[0];
    track.enabled = !track.enabled;
    setVideoOn(track.enabled);
  };

  // 🎤 Toggle mic
  const toggleAudio = () => {
    const track = localStreamRef.current.getAudioTracks()[0];
    track.enabled = !track.enabled;
    setAudioOn(track.enabled);
  };

  // 💬 Send message
  const sendMessage = () => {
    socket.emit("chat-message", { sender: username, text: msg });
    setMessages(prev => [...prev, { sender: "Me", text: msg }]);
    setMsg("");
  };

  // ❌ End call
  const endCall = () => {
    window.location.href = "/";
  };

  if (!joined) {
    return (
      <div className={styles.lobby}>
        <h2>Join Meeting</h2>
        <TextField
          label="Your Name"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <Button onClick={joinMeeting}>Join</Button>
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
            ref={ref => ref && (ref.srcObject = v.stream)}
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

        <IconButton onClick={endCall} color="error">
          <CallEndIcon />
        </IconButton>

        <IconButton onClick={() => setChatOpen(!chatOpen)}>
          <Badge badgeContent={messages.length}>
            <ChatIcon />
          </Badge>
        </IconButton>
      </div>

      {chatOpen && (
        <div className={styles.chatRoom}>
          {messages.map((m, i) => (
            <p key={i}><b>{m.sender}:</b> {m.text}</p>
          ))}
          <TextField
            value={msg}
            onChange={e => setMsg(e.target.value)}
            label="Message"
          />
          <Button onClick={sendMessage}>Send</Button>
        </div>
      )}
    </div>
  );
}
