import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  Typography,
  IconButton,
  Box
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";

export default function History() {
  const { getHistoryOfUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await getHistoryOfUser();
        console.log("HISTORY DATA 👉", data);
        setMeetings(data);
      } catch (err) {
        console.error("History fetch failed", err);
      }
    };

    fetchHistory();
  }, []);

  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#020617,#0f172a)",
        color: "white",
        padding: "24px",
      }}
    >
      {/* HEADER */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <IconButton onClick={() => navigate("/home")} sx={{ color: "white" }}>
          <HomeIcon />
        </IconButton>
        <Typography variant="h5" sx={{ ml: 1 }}>
          Meeting History
        </Typography>
      </Box>

      {/* LIST */}
      {meetings.length === 0 ? (
        <Typography>No meetings found</Typography>
      ) : (
        meetings.map((m, i) => (
          <Card
            key={i}
            sx={{
              mb: 2,
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(10px)",
              color: "white",
              borderRadius: "14px",
            }}
          >
            <CardContent>
              <Typography variant="h6">
                Meeting Code: {m.meetingCode}
              </Typography>
              <Typography sx={{ opacity: 0.8, mt: 1 }}>
                Date: {formatDate(m.createdAt)}
              </Typography>
            </CardContent>
          </Card>
        ))
      )}
    </Box>
  );
}
