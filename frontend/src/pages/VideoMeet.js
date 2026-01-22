import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import server from "../environment";

const iceServers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export default function VideoMeet() {
  const socketRef = useRef();
  const localVideo = useRef();
  const peersRef = useRef({});
  const [remoteStreams, setRemoteStreams] = useState([]);
  const roomId = window.location.pathname.split("/").pop();

  useEffect(() => {
    start();
  }, []);

  const start = async () => {
    socketRef.current = io(server, {
      transports: ["websocket"],
      secure: true
    });

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localVideo.current.srcObject = stream;

    socketRef.current.emit("join-room", roomId);

    socketRef.current.on("all-users", (users) => {
      users.forEach((userId) => createPeer(userId, stream));
    });

    socketRef.current.on("user-joined", (userId) => {
      createPeer(userId, stream);
    });

    socketRef.current.on("signal", handleSignal);

    socketRef.current.on("user-left", (id) => {
      setRemoteStreams((prev) =>
        prev.filter((v) => v.id !== id)
      );
      delete peersRef.current[id];
    });
  };

  const createPeer = (userId, stream) => {
    if (peersRef.current[userId]) return;

    const peer = new RTCPeerConnection(iceServers);

    stream.getTracks().forEach((track) =>
      peer.addTrack(track, stream)
    );

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit("signal", {
          to: userId,
          data: { ice: e.candidate }
        });
      }
    };

    peer.ontrack = (e) => {
      setRemoteStreams((prev) => {
        if (prev.find((p) => p.id === userId)) return prev;
        return [...prev, { id: userId, stream: e.streams[0] }];
      });
    };

    peer.createOffer().then((offer) => {
      peer.setLocalDescription(offer);
      socketRef.current.emit("signal", {
        to: userId,
        data: { sdp: offer }
      });
    });

    peersRef.current[userId] = peer;
  };

  const handleSignal = async ({ from, data }) => {
    let peer = peersRef.current[from];

    if (!peer) {
      peer = new RTCPeerConnection(iceServers);
      peersRef.current[from] = peer;

      peer.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current.emit("signal", {
            to: from,
            data: { ice: e.candidate }
          });
        }
      };

      peer.ontrack = (e) => {
        setRemoteStreams((prev) => [
          ...prev,
          { id: from, stream: e.streams[0] }
        ]);
      };

      localVideo.current.srcObject
        .getTracks()
        .forEach((t) =>
          peer.addTrack(t, localVideo.current.srcObject)
        );
    }

    if (data.sdp) {
      await peer.setRemoteDescription(
        new RTCSessionDescription(data.sdp)
      );
      if (data.sdp.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socketRef.current.emit("signal", {
          to: from,
          data: { sdp: answer }
        });
      }
    }

    if (data.ice) {
      await peer.addIceCandidate(
        new RTCIceCandidate(data.ice)
      );
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Room: {roomId}</h2>

      <video
        ref={localVideo}
        autoPlay
        muted
        playsInline
        style={{ width: 250, border: "2px solid green" }}
      />

      <div style={{ display: "flex", gap: 10 }}>
        {remoteStreams.map((v) => (
          <video
            key={v.id}
            autoPlay
            playsInline
            ref={(el) => el && (el.srcObject = v.stream)}
            style={{ width: 250, border: "2px solid blue" }}
          />
        ))}
      </div>
    </div>
  );
}
