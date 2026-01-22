import { Server } from "socket.io";

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

    // ======================
    // JOIN ROOM
    // ======================
    socket.on("join-room", (roomId) => {
      socket.join(roomId);

      const clients = Array.from(
        io.sockets.adapter.rooms.get(roomId) || []
      );

      // Send existing users to new user
      socket.emit("all-users", clients);

      // Notify others
      socket.to(roomId).emit("user-joined", socket.id);
    });

    // ======================
    // WEBRTC SIGNALING
    // ======================
    socket.on("signal", ({ to, data }) => {
      io.to(to).emit("signal", {
        from: socket.id,
        data
      });
    });

    // ======================
    // CHAT
    // ======================
    socket.on("chat-message", ({ roomId, message, user }) => {
      socket.to(roomId).emit("chat-message", {
        message,
        user
      });
    });

    // ======================
    // DISCONNECT
    // ======================
    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);
      socket.broadcast.emit("user-left", socket.id);
    });
  });

  return io;
};
