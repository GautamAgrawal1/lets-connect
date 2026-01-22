import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import server from "../environment";
import styles from "../styles/videoComponent.module.css";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

export default function VideoMeet() {
  const socketRef = useRef();
  const pcRef = useRef({});
  const localVideoRef = useRef();
  const localStreamRef = useRef();

  const [remoteStreams, setRemoteStreams] = useState([]);

  useEffect(() => {
    init();
    return () => cleanup();
  }, []);

  const init = async () => {
    socketRef.current = io(server, { transports: ["websocket"] });

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localStreamRef.current = stream;
    localVideoRef.current.srcObject = stream;

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", window.location.pathname);
    });

    socketRef.current.on("user-joined", (id, clients) => {
      clients.forEach(socketId => {
        if (socketId === socketRef.current.id) return;
        createPeer(socketId, stream);
      });
    });

    socketRef.current.on("signal", handleSignal);

    socketRef.current.on("user-left", id => {
      if (pcRef.current[id]) {
        pcRef.current[id].close();
        delete pcRef.current[id];
      }
      setRemoteStreams(prev => prev.filter(v => v.id !== id));
    });
  };

  const createPeer = (id, stream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pcRef.current[id] = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = e => {
      if (e.candidate) {
        socketRef.current.emit(
          "signal",
          id,
          JSON.stringify({ ice: e.candidate })
        );
      }
    };

    pc.ontrack = e => {
      setRemoteStreams(prev => {
        if (prev.find(v => v.id === id)) return prev;
        return [...prev, { id, stream: e.streams[0] }];
      });
    };

    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socketRef.current.emit(
        "signal",
        id,
        JSON.stringify({ sdp: offer })
      );
    });
  };

  const handleSignal = async (fromId, message) => {
    const data = JSON.parse(message);
    let pc = pcRef.current[fromId];

    if (!pc) {
      pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current[fromId] = pc;

      localStreamRef.current
        .getTracks()
        .forEach(track => pc.addTrack(track, localStreamRef.current));

      pc.ontrack = e => {
        setRemoteStreams(prev => {
          if (prev.find(v => v.id === fromId)) return prev;
          return [...prev, { id: fromId, stream: e.streams[0] }];
        });
      };

      pc.onicecandidate = e => {
        if (e.candidate) {
          socketRef.current.emit(
            "signal",
            fromId,
            JSON.stringify({ ice: e.candidate })
          );
        }
      };
    }

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

  const cleanup = () => {
    Object.values(pcRef.current).forEach(pc => pc.close());
    socketRef.current?.disconnect();
  };

  return (
    <div className={styles.meetVideoContainer}>
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className={styles.meetUserVideo}
      />

      <div className={styles.conferenceView}>
        {remoteStreams.map(v => (
          <video
            key={v.id}
            autoPlay
            playsInline
            ref={ref => ref && (ref.srcObject = v.stream)}
          />
        ))}
      </div>
    </div>
  );
}
