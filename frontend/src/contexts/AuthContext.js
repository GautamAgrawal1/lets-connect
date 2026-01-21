import React, { createContext } from "react";
import axios from "axios";
import server from "../environment";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  /* ================= LOGIN ================= */
  const handleLogin = async (username, password) => {
    const res = await axios.post(
      `${server}/api/v1/users/login`,
      { username, password }
    );

    localStorage.setItem("token", res.data.token);
    return res.data;
  };

  /* ================= REGISTER ================= */
  const handleRegister = async (name, username, password) => {
    const res = await axios.post(
      `${server}/api/v1/users/register`,
      { name, username, password }
    );

    return res.data.message;
  };

  /* ================= ADD HISTORY ================= */
  const addToUserHistory = async (meetingCode) => {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("No token found");
    }

    return axios.post(
      `${server}/api/v1/users/add_to_activity`,
      {
        token,
        meetingCode,
      }
    );
  };

  /* ================= GET HISTORY ================= */
  const getHistoryOfUser = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("No token found");
    }

    const res = await axios.get(
      `${server}/api/v1/users/get_all_activity`,
      {
        params: { token },
      }
    );

    return res.data;
  };

  return (
    <AuthContext.Provider
      value={{
        handleLogin,
        handleRegister,
        addToUserHistory,
        getHistoryOfUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
