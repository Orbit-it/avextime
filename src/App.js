
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import Pointage from "./pages/Pointage";
import NonAccessPage from "./pages/NonAccessPage";
import Dashbord from "./pages/Dashboard"
import GestionRh from "./pages/GestionRH";
import Machines from "./pages/Machines";
import ProtectedRoute from "./components/ProtectedRoute";
import Synthese from "./pages/synthese";

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Navbar />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/refused" element={<NonAccessPage />} />
            
            <Route element={<ProtectedRoute allowedRoles={['admin', 'manager', 'employee', 'omega']} />}>
              <Route path="/pointage" element={<Pointage />} />
              <Route path="/" element={<Dashbord />} />
            </Route>
            
            <Route element={<ProtectedRoute allowedRoles={['admin', 'manager', 'omega']} />}>
              <Route path="/gestionrh" element={<GestionRh />} />
            </Route>
            
            <Route element={<ProtectedRoute allowedRoles={['admin', 'omega']} />}>
              <Route path="/machines" element={<Machines />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['omega']} />}>
              <Route path="/synthese" element={<Synthese />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
