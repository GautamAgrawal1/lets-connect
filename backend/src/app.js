import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/db.js";
import { connectToSocket } from "./Controllers/SocketManager.js";
import userRoutes from "./routes/UserRoute.js";

dotenv.config();

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

// Port
const PORT = process.env.PORT || 8000;

// Start server
const start = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

start();
