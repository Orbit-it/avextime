import React, { useState } from "react";
import { TextField } from "@mui/material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Endpoint from "../config/Endpoint";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

const NonAccessPage = () => {
  
  return (
    <div className="login-container">
      <div className="login-box">
        <img src="/aventuratime.png" alt="Logo" className="logo-image" />

          <h2>Accès non Autorisé !</h2>
          
        <footer>© 2025 Aventura-Time</footer>
      </div>
    </div>
  );
};

export default NonAccessPage;