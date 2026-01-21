import httpStatus from "http-status";
import { User } from "../models/UserModel.js";
import { Meeting } from "../models/MeetingModel.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

/* ================= LOGIN ================= */
const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Please provide username & password" });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(httpStatus.NOT_FOUND).json({ message: "User Not Found" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid credentials" });
    }

    const token = crypto.randomBytes(20).toString("hex");
    user.token = token;
    await user.save();

    return res.status(httpStatus.OK).json({ token });
  } catch (e) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};

/* ================= REGISTER ================= */
const register = async (req, res) => {
  const { name, username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(httpStatus.FOUND).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      username,
      password: hashedPassword
    });

    await newUser.save();
    res.status(httpStatus.CREATED).json({ message: "User Registered" });
  } catch (e) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

/* ================= ADD MEETING HISTORY ================= */
const addToHistory = async (req, res) => {
  const { token, meetingCode } = req.body;

  try {
    const user = await User.findOne({ token });
    if (!user) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid token" });
    }

    const newMeeting = new Meeting({
      user_id: user.username,
      meetingCode
    });

    await newMeeting.save();

    res.status(httpStatus.CREATED).json({
      message: "Added code to history",
      date: newMeeting.createdAt   // ⭐ RETURN DATE
    });
  } catch (e) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

/* ================= GET USER HISTORY ================= */
const getUserHistory = async (req, res) => {
    const { token } = req.query;
  
    try {
      const user = await User.findOne({ token });
      if (!user) {
        return res.status(401).json({ message: "Invalid token" });
      }
  
      const meetings = await Meeting.find({ user_id: user.username });
  
      // 🔴 HARD DEBUG
      console.log("MEETINGS FROM DB 👉", meetings);
  
      res.json(meetings); // send RAW data (no mapping)
    } catch (e) {
      console.log("ERROR 👉", e);
      res.status(500).json({ message: "Something went wrong" });
    }
  };
  

export { login, register, getUserHistory, addToHistory };
