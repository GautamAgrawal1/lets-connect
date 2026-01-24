import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import server from "../environment";

const iceServers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeet() {
  const socketRef = useRef();
  const localVideoRef = useRef();
  const peersRef = useRef({});
  const localStreamRef = useRef();

  const [remoteStreams, setRemoteStreams] = useState([]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);

  /* ================= CAMERA ================= */
  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;
    localVideoRef.current.srcObject = stream;
  };

  /* ================= SOCKET ================= */
  const connectSocket = () => {
    socketRef.current = io(server);

    socketRef.current.emit("join-call", window.location.pathname);

    socketRef.current.on("user-joined", (id, clients) => {
      clients.forEach((clientId) => {
        if (clientId === socketRef.current.id) return;
        if (peersRef.current[clientId]) return;

        const peer = new RTCPeerConnection(iceServers);
        peersRef.current[clientId] = peer;

        localStreamRef.current.getTracks().forEach((track) =>
          peer.addTrack(track, localStreamRef.current)
        );

        peer.onicecandidate = (e) => {
          if (e.candidate) {
            socketRef.current.emit("signal", clientId, {
              ice: e.candidate,
            });
          }
        };

        peer.ontrack = (e) => {
          setRemoteStreams((prev) => {
            if (prev.find((s) => s.id === clientId)) return prev;
            return [...prev, { id: clientId, stream: e.streams[0] }];
          });
        };

        peer.createOffer().then((offer) => {
          peer.setLocalDescription(offer);
          socketRef.current.emit("signal", clientId, {
            sdp: offer,
          });
        });
      });
    });

    socketRef.current.on("signal", async ({ from, sdp, ice }) => {
      let peer = peersRef.current[from];

      if (!peer) {
        peer = new RTCPeerConnection(iceServers);
        peersRef.current[from] = peer;

        localStreamRef.current.getTracks().forEach((track) =>
          peer.addTrack(track, localStreamRef.current)
        );

        peer.ontrack = (e) => {
          setRemoteStreams((prev) => {
            if (prev.find((s) => s.id === from)) return prev;
            return [...prev, { id: from, stream: e.streams[0] }];
          });
        };

        peer.onicecandidate = (e) => {
          if (e.candidate) {
            socketRef.current.emit("signal", from, {
              ice: e.candidate,
            });
          }
        };
      }

      if (sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(sdp));
        if (sdp.type === "offer") {
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socketRef.current.emit("signal", from, {
            sdp: answer,
          });
        }
      }

      if (ice) {
        await peer.addIceCandidate(new RTCIceCandidate(ice));
      }
    });

    socketRef.current.on("chat-message", (msg, sender) => {
      setMessages((prev) => [...prev, { msg, sender }]);
    });
  };

  /* ================= JOIN ================= */
  const joinMeeting = async () => {
    await startCamera();
    connectSocket();
    setJoined(true);
  };

  /* ================= CHAT ================= */
  const sendMessage = () => {
    socketRef.current.emit("chat-message", message, username);
    setMessages((prev) => [...prev, { msg: message, sender: "You" }]);
    setMessage("");
  };

  return (
    <div>
      {!joined ? (
        <div>
          <input
            placeholder="Your Name"
            onChange={(e) => setUsername(e.target.value)}
          />
          <button onClick={joinMeeting}>Join</button>
          <video ref={localVideoRef} autoPlay muted />
        </div>
      ) : (
        <div>
          <video ref={localVideoRef} autoPlay muted />

          {remoteStreams.map((v) => (
            <video
              key={v.id}
              autoPlay
              ref={(ref) => ref && (ref.srcObject = v.stream)}
            />
          ))}

          <div>
            {messages.map((m, i) => (
              <p key={i}>
                <b>{m.sender}:</b> {m.msg}
              </p>
            ))}
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
