const IS_PROD = true;

const server = IS_PROD
  ? "https://e71xuvrhq4.execute-api.ap-south-1.amazonaws.com"
  : "http://localhost:8000";

export default server;
