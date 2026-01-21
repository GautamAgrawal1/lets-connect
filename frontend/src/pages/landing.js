import React from "react";
import "../App.css";
import { Link, useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landingPageContainer">
      {/* ===== NAVBAR ===== */}
      <nav>
        <div className="navHeader">
          <h2>Let's Connect</h2>
        </div>

        <div className="navlist">
          <p onClick={() => navigate("/aljk23")}>Join as Guest</p>
          <p onClick={() => navigate("/auth")}>Register</p>

          <div
            role="button"
            onClick={() => navigate("/auth")}
            style={{
              background: "#FF9839",
              padding: "8px 18px",
              borderRadius: "999px",
            }}
          >
            <p style={{ margin: 0, fontWeight: 500 }}>Login</p>
          </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <div className="landingMainContainer">
        <div>
          <h1>
            <span style={{ color: "#FF9839" }}>Connect</span> with your <br />
            loved ones
          </h1>

          <p>
            Secure, fast and simple video meetings <br />
            from anywhere in the world.
          </p>

          <div role="button">
            <Link to="/auth">Get Started</Link>
          </div>
        </div>

        <div>
          <img src="/mobile.png" alt="Video call illustration" />
        </div>
      </div>
    </div>
  );
}
