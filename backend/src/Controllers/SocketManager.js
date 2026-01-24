import { Server } from "socket.io";

let connections = {};
let messages = {};

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

    /* ================= JOIN CALL ================= */
    socket.on("join-call", (room) => {
      if (!connections[room]) connections[room] = [];

      connections[room].push(socket.id);

      // Notify everyone
      connections[room].forEach((id) => {
        io.to(id).emit("user-joined", socket.id, connections[room]);
      });

      // Send old messages to newly joined user
      if (messages[room]) {
        messages[room].forEach((msg) => {
          io.to(socket.id).emit(
            "chat-message",
            msg.data,
            msg.sender
          );
        });
      }
    });

    /* ================= WEBRTC SIGNAL ================= */
    socket.on("signal", (toId, payload) => {
      io.to(toId).emit("signal", {
        from: socket.id,
        ...payload,
      });
    });

    /* ================= CHAT ================= */
    socket.on("chat-message", (data, sender) => {
      const room = Object.keys(connections).find((r) =>
        connections[r].includes(socket.id)
      );

      if (!room) return;

      if (!messages[room]) messages[room] = [];

      messages[room].push({ data, sender });

      // 🔥 IMPORTANT: send ONLY to others (not self)
      connections[room].forEach((id) => {
        if (id !== socket.id) {
          io.to(id).emit("chat-message", data, sender);
        }
      });
    });

    /* ================= DISCONNECT ================= */
    socket.on("disconnect", () => {
      for (const room in connections) {
        const idx = connections[room].indexOf(socket.id);
        if (idx !== -1) {
          connections[room].splice(idx, 1);
          connections[room].forEach((id) =>
            io.to(id).emit("user-left", socket.id)
          );

          if (connections[room].length === 0) {
            delete connections[room];
            delete messages[room];
          }
        }
      }
    });
  });

  return io;
};
