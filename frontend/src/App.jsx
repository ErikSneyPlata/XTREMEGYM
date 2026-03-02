// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ManualEntry from './pages/ManualEntry';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import Plans from './pages/Plans';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import PublicRegister from './public_pages/Publicregister';

// ─── Tabla de permisos ────────────────────────────────────────────────────────
// Define qué roles pueden acceder a cada ruta.
// Agregar una ruta aquí es todo lo que hace falta para protegerla.
export const ROUTE_PERMISSIONS = {
  '/':             ['admin', 'encargado', 'entrenador'],
  '/manual-entry': ['admin', 'encargado', 'entrenador'],
  '/clients':      ['admin', 'encargado'],
  '/memberships':  ['admin', 'encargado'],
  '/pos':          ['admin', 'encargado'],
  '/inventory':    ['admin', 'encargado'],
  '/reports':      ['admin'],
  '/settings':     ['admin'],
};

// Helper reutilizable — importable desde Layout, guards, etc.
export const canAccess = (role, path) => {
  const allowed = ROUTE_PERMISSIONS[path];
  if (!allowed) return true; // ruta sin restricción declarada = libre
  return allowed.includes(role);
};

// ─── PrivateRoute ─────────────────────────────────────────────────────────────
const PrivateRoute = ({ children, path }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Rol sin acceso → redirige silenciosamente al dashboard
  if (user?.role && !canAccess(user.role, path)) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<PublicRegister />} />

      <Route path="/"             element={<PrivateRoute path="/">            <Dashboard />  </PrivateRoute>} />
      <Route path="/manual-entry" element={<PrivateRoute path="/manual-entry"><ManualEntry /></PrivateRoute>} />
      <Route path="/clients"      element={<PrivateRoute path="/clients">     <Clients />    </PrivateRoute>} />
      <Route path="/memberships"  element={<PrivateRoute path="/memberships"> <Plans />      </PrivateRoute>} />
      <Route path="/pos"          element={<PrivateRoute path="/pos">         <POS />        </PrivateRoute>} />
      <Route path="/inventory"    element={<PrivateRoute path="/inventory">   <Inventory />  </PrivateRoute>} />
      <Route path="/reports"      element={<PrivateRoute path="/reports">     <Reports />    </PrivateRoute>} />
      <Route path="/settings"     element={<PrivateRoute path="/settings">    <Settings />   </PrivateRoute>} />

      {/* Ruta desconocida → dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}