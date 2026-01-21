let IS_PROD = false; // local development

const server = IS_PROD
  ? "https://apnacollegebackend.onrender.com"
  : "http://localhost:8000";

export default server;
