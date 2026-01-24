import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

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
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/v1/users", userRoutes);

const PORT = process.env.PORT || 8000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    server.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ Mongo error:", err);
  });
