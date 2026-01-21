import { useNavigate } from "react-router-dom";
import * as React from "react";
import {
  Avatar,
  Button,
  CssBaseline,
  TextField,
  Box,
  Typography,
  Snackbar
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { AuthContext } from "../contexts/AuthContext";
import "../App.css";

const theme = createTheme({
  palette: {
    primary: {
      main: "#FF9839",
    },
  },
});

export default function Authentication() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [formState, setFormState] = React.useState(0); // 0 = login, 1 = register
  const [open, setOpen] = React.useState(false);

  const { handleRegister, handleLogin } = React.useContext(AuthContext);
  const navigate = useNavigate();

  const handleAuth = async () => {
    try {
      if (formState === 0) {
        // LOGIN
        await handleLogin(username, password);
        navigate("/home"); 
      } else {
        // REGISTER
        const result = await handleRegister(name, username, password);
        setMessage(result);
        setOpen(true);
        setFormState(0);
        setName("");
        setUsername("");
        setPassword("");
        setError("");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box className="authPage">
        <CssBaseline />

        <Box className="authFormWrapper">
          <Box className="authBox">
            {/* ICON */}
            <Avatar className="authAvatar">
              <LockOutlinedIcon />
            </Avatar>

            {/* TITLE */}
            <Typography variant="h5" sx={{ mb: 1 }}>
              {formState === 0
                ? "Sign in to your account"
                : "Create a new account"}
            </Typography>

            <Typography
              variant="body2"
              sx={{ opacity: 0.7, mb: 3 }}
            >
              {formState === 0
                ? "Welcome back! Please login."
                : "Join us and start connecting."}
            </Typography>

            {/* TOGGLE BUTTONS */}
            <Box className="authToggle">
              <Button
                variant={formState === 0 ? "contained" : "text"}
                onClick={() => setFormState(0)}
                fullWidth
              >
                Login
              </Button>

              <Button
                variant={formState === 1 ? "contained" : "text"}
                onClick={() => setFormState(1)}
                fullWidth
              >
                Register
              </Button>
            </Box>

            {/* FORM */}
            <Box sx={{ mt: 2, width: "100%" }}>
              {formState === 1 && (
                <TextField
                  margin="normal"
                  fullWidth
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}

              <TextField
                margin="normal"
                fullWidth
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />

              <TextField
                margin="normal"
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  {error}
                </Typography>
              )}

              <Button
                fullWidth
                variant="contained"
                sx={{ mt: 3, py: 1.2 }}
                onClick={handleAuth}
              >
                {formState === 0 ? "Login" : "Create Account"}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* SUCCESS SNACKBAR */}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        message={message}
        onClose={() => setOpen(false)}
      />
    </ThemeProvider>
  );
}
