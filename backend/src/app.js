import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import { connectToSocket } from "./Controllers/SocketManager.js";
import userRoutes from "./routes/UserRoute.js";

dotenv.config(); // 🔥 VERY IMPORTANT

const app = express();
const server = createServer(app);

// Socket.IO
connectToSocket(server);

// Middleware
app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

// Routes
app.use("/api/v1/users", userRoutes);

const PORT = process.env.PORT || 8000;
const MONGO_URI = process.env.MONGO_URI;
const start = async () => {
  try {
    const connectionDb = await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB connected: ${connectionDb.connection.host}`);
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

start();