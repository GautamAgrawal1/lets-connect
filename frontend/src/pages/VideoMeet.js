import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import server from "../environment";

const socket = io(server);

const pcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeet() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);

  const [joined, setJoined] = useState(false);

  useEffect(() => {
    socket.on("signal", async (data) => {
      if (!pcRef.current) return;

      if (data.sdp) {
        await pcRef.current.setRemoteDescription(data.sdp);
        if (data.sdp.type === "offer") {
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          socket.emit("signal", { sdp: answer });
        }
      }

      if (data.candidate) {
        try {
          await pcRef.current.addIceCandidate(data.candidate);
        } catch (e) {
          console.error(e);
        }
      }
    });
  }, []);

  const startCall = async () => {
    setJoined(true);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(pcConfig);
    pcRef.current = pc;

    // 🔥 MODERN API
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { candidate: event.candidate });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("signal", { sdp: offer });
  };

  return (
    <div
      style={{
        height: "100vh",
        background: "#020617",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        flexDirection: "column",
      }}
    >
      {!joined && (
        <button
          onClick={startCall}
          style={{
            padding: "14px 28px",
            fontSize: "18px",
            borderRadius: "10px",
            cursor: "pointer",
          }}
        >
          Join Meeting
        </button>
      )}

      <div style={{ display: "flex", gap: "20px" }}>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "300px",
            borderRadius: "12px",
            background: "black",
          }}
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{
            width: "600px",
            borderRadius: "12px",
            background: "black",
          }}
        />
      </div>
    </div>
  );
}
