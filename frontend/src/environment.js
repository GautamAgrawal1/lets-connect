const server =
  process.env.NODE_ENV === "production"
    ? "https://lets-connect-1-1oy1.onrender.com"
    : "http://localhost:8000";

export default server;
