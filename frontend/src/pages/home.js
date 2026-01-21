import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import "../App.css";
import {
  Button,
  IconButton,
  TextField,
  Typography,
  Box,
} from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import LogoutIcon from "@mui/icons-material/Logout";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import { AuthContext } from "../contexts/AuthContext";

function HomeComponent() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const { addToUserHistory } = useContext(AuthContext);

  const handleJoinVideoCall = async () => {
    if (!meetingCode.trim()) return;

    try {
      await addToUserHistory(meetingCode);
      navigate(`/${meetingCode}`);
    } catch (err) {
      console.error("Failed to add history", err);
      alert("Something went wrong while joining meeting");
    }
  };

  return (
    <div className="homePage">
      {/* ===== NAVBAR ===== */}
      <div className="homeNavbar">
        <Typography variant="h6" fontWeight={600}>
          Let’s Connect
        </Typography>

        <div className="homeNavActions">
          <IconButton onClick={() => navigate("/history")}>
            <RestoreIcon />
          </IconButton>

          <IconButton
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/auth");
            }}
          >
            <LogoutIcon />
          </IconButton>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <Box className="homeContainer">
        <Box className="homeCard">
          <VideoCallIcon className="homeIcon" />

          <Typography variant="h4" fontWeight={600}>
            Join a Meeting
          </Typography>

          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Enter a meeting code to start or join a video call
          </Typography>

          <Box className="homeJoinBox">
            <TextField
              fullWidth
              label="Meeting Code"
              variant="outlined"
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
            />

            <Button
              variant="contained"
              size="large"
              onClick={handleJoinVideoCall}
            >
              Join
            </Button>
          </Box>
        </Box>
      </Box>
    </div>
  );
}

export default withAuth(HomeComponent);
