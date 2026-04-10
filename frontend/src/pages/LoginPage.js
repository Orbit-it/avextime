import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios"; 
import apiConfig from "../config/Endpoint";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); // Réinitialiser l'erreur

    try {
      const response = await axios.post(apiConfig.Endpoint.login, { 
        username, 
        password 
      });

      // Ne pas destructure le mot de passe de la réponse
      const { name , role, token, avatar, position } = response.data;

      const userData = {
        name,
        role,
        avatar,
        position,
        token // Ajout du token JWT si utilisé
      };

      login(userData); // Stockage sécurisé via le contexte

      // Redirection basée sur le rôle
      switch(role) {
        case "admin":
        case "manager":
          navigate("/");
          break;
        case "employee":
          navigate("/pointage");
          break;
        default:
          navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Identifiants invalides");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src="/aventuratime.png" alt="Logo" className="logo-image" />
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="text"
            placeholder="Nom d'utilisateur"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button type="submit">Se connecter</button>
        </form>
        <footer>© 2025 Aventura-Time</footer>
      </div>
    </div>
  );
};

export default LoginPage;