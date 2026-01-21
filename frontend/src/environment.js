const IS_PROD = true;

const server = IS_PROD
  ? "http://3.110.127.147"
  : "http://localhost:8000";

export default server;
