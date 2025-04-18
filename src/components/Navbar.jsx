import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { 
  Avatar, IconButton, Toolbar, AppBar, Box, 
  Menu, MenuItem, Typography, Badge, Divider 
} from "@mui/material";
import { grey } from '@mui/material/colors';
import { Menu as MenuIcon, Notifications, AccountCircle } from '@mui/icons-material';
import { FaArtstation, FaClock, FaUsers, FaTablet } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

// Navigation items configuration
const navItems = [
  { path: "/dashboard", icon: <FaArtstation className="icon" />, label: "Tableau de Bord" },
  { path: "/pointage", icon: <FaClock className="icon" />, label: "Pointages" },
  { path: "/gestionrh", icon: <FaUsers className="icon" />, label: "Service RH" },
  { path: "/machines", icon: <FaTablet className="icon" />, label: "Machines" },
];

// Notification items configuration
const notificationItems = [
  "Nouveau pointage en attente",
  "Mise à jour disponible",
  "Rappel: Réunion à 15h"
];

const Navbar = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [profileAnchorEl, setProfileAnchorEl] = useState(null);
  const [notificationsAnchorEl, setNotificationsAnchorEl] = useState(null);
  const [notificationCount, setNotificationCount] = useState(3);
  const { user, logout } = useAuth();

  const isMenuOpen = Boolean(anchorEl);
  const isProfileMenuOpen = Boolean(profileAnchorEl);
  const isNotificationsMenuOpen = Boolean(notificationsAnchorEl);

  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleProfileMenuOpen = (event) => setProfileAnchorEl(event.currentTarget);
  const handleProfileMenuClose = () => setProfileAnchorEl(null);

  const handleNotificationsMenuOpen = (event) => {
    setNotificationsAnchorEl(event.currentTarget);
    setNotificationCount(0);
  };

  const handleNotificationsMenuClose = () => setNotificationsAnchorEl(null);

  const handleLogout = () => {
    logout();
    handleProfileMenuClose();
  };

  return (
    <AppBar 
      position="sticky" 
      sx={{ 
        backgroundColor: '#ffffff', 
        boxShadow: 'none', 
        borderBottom: '1px solid #e0e0e0' 
      }}
    >
      <Toolbar sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: { xs: '0 16px', md: '0 40px' }
      }}>
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <NavLink to="/" aria-label="Home">
            <img 
              src="/aventuratime.png" 
              alt="Logo" 
              className="logo-image" 
              style={{ height: '40px', marginLeft: '8px' }} 
              loading="lazy"
            />
          </NavLink>
        </Box>

        {user && (
          <>
          {/* Desktop Navigation */}
        <Box sx={{ 
          display: { xs: 'none', md: 'flex' }, 
          gap: 2, 
          alignItems: 'center',
          margin: '0 auto'
        }}>
          {navItems.map((item) => (
            <NavLink 
              key={item.path}
              to={item.path} 
              className="nav-link"
              activeClassName="active-nav-link"
            >
              {item.icon} {item.label}
            </NavLink>
          ))}
        </Box>

        {/* Action Icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Notifications */}
          <IconButton 
            aria-label="Notifications"
            onClick={handleNotificationsMenuOpen}
            sx={{ color: grey[700], '&:hover': { backgroundColor: '#f5f5f5' } }}
          >
            <Badge badgeContent={notificationCount} color="error">
              <Notifications />
            </Badge>
          </IconButton>
          
          <Menu
            anchorEl={notificationsAnchorEl}
            open={isNotificationsMenuOpen}
            onClose={handleNotificationsMenuClose}
            PaperProps={{
              style: {
                width: '300px',
                maxHeight: '400px',
                padding: '10px'
              },
            }}
          >
            <Typography variant="subtitle1" sx={{ p: 2 }}>Notifications</Typography>
            <Divider />
            {notificationItems.map((item, index) => (
              <MenuItem key={index} onClick={handleNotificationsMenuClose}>
                <Typography variant="body2">{item}</Typography>
              </MenuItem>
            ))}
          </Menu>

          {/* Profile */}
          <IconButton 
            aria-label="User profile"
            onClick={handleProfileMenuOpen}
            sx={{ color: grey[700], '&:hover': { backgroundColor: '#f5f5f5' } }}
          >
            {user?.avatar ? (
              <Avatar 
                src={user.avatar} 
                sx={{ width: 32, height: 32 }} 
                alt={user.name || "User"} 
              />
            ) : (
              <AccountCircle />
            )}
          </IconButton>
          
          <Menu
            anchorEl={profileAnchorEl}
            open={isProfileMenuOpen}
            onClose={handleProfileMenuClose}
            PaperProps={{
              style: {
                width: '250px',
                padding: '20px'
              },
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              p: 2,
              textAlign: 'center'
            }}>
              {user?.avatar ? (
                <Avatar 
                  src={user.avatar} 
                  sx={{ width: 64, height: 64, mb: 2 }} 
                  alt={user.name || "User"}
                />
              ) : (
                <AccountCircle sx={{ fontSize: 64, mb: 2 }} />
              )}
              <Typography variant="h6">{user?.name || "Utilisateur"}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.role || "Rôle non défini"}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={handleProfileMenuClose}>Mon Profil</MenuItem>
            <MenuItem onClick={handleProfileMenuClose}>Paramètres</MenuItem>
            <Divider />
            <MenuItem 
              onClick={handleLogout} 
              sx={{ color: 'error.main', fontWeight: 'bold' }}
            >
              Déconnexion
            </MenuItem>
          </Menu>
        </Box>

        {/* Mobile Menu */}
        <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
          <IconButton 
            aria-label="Open menu"
            color="inherit" 
            onClick={handleMenuOpen} 
            sx={{ color: grey[700] }}
          >
            <MenuIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={isMenuOpen}
            onClose={handleMenuClose}
            sx={{ display: { xs: 'block', md: 'none' } }}
          >
            {navItems.map((item) => (
              <MenuItem key={item.path} onClick={handleMenuClose}>
                <NavLink 
                  to={item.path} 
                  className="nav-link"
                  activeClassName="active-nav-link"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {item.icon} {item.label}
                </NavLink>
              </MenuItem>
            ))}
          </Menu>
        </Box>
        </>
        )}     

      </Toolbar>
    </AppBar>
  );
};

export default Navbar;