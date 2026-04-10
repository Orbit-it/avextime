import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ allowedRoles }) => {
  const { user } = useAuth();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Simule un temps de vérification ou attend que `user` soit initialisé
    const timer = setTimeout(() => setIsCheckingAuth(false), 100);
    return () => clearTimeout(timer);
  }, []);

  if (isCheckingAuth) {
    return <div>Chargement...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/refused" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;