/**
 * App principal del Dashboard ProEv.
 * 
 * Gestiona autenticación con AuthService e inyecta routing por rol.
 * Rutas protegidas según el rol del usuario autenticado.
 */

import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { login, logout, getSession, checkDeviceWhitelist, getDeviceId, AuthUser } from '@/auth/AuthService';
import Layout from '@/components/Layout/Layout';
import LoginPage from '@/pages/Login';
import '@/styles/global.css';

// Páginas
import DashboardPage from '@/pages/admin/Dashboard';
import AlumnosPage from '@/pages/admin/Alumnos';
import AlumnoDetailPage from '@/pages/admin/AlumnoDetail';
import PagosPage from '@/pages/admin/Pagos';
import ComunicacionesPage from '@/pages/admin/Comunicaciones';
import EdicionesPage from '@/pages/admin/Ediciones';
import VideoReviewPage from '@/pages/revisor/VideoReview';
import EmailApprovalPage from '@/pages/revisor/EmailApproval';

export default function App() {
  const [session, setSession] = useState<AuthUser | null>(getSession);
  const [deviceWarning, setDeviceWarning] = useState(false);
  const deviceId = getDeviceId();

  // Verificar Device whitelist al cargar si es admin
  useEffect(() => {
    if (session?.role === 'admin') {
      checkDeviceWhitelist().then(allowed => {
        if (allowed === false) {
          setDeviceWarning(true);
          console.warn('⚠️ Dispositivo no está en la whitelist de admin');
        }
      });
    }
  }, [session]);

  const handleLogin = useCallback(async (email: string): Promise<string | null> => {
    const result = await login(email);
    if (result.success && result.user) {
      setSession(result.user);
      return null;
    }
    return result.error || 'Error desconocido';
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    setSession(null);
    setDeviceWarning(false);
  }, []);

  // Sin sesión → Login
  if (!session) {
    return (
      <BrowserRouter>
        <LoginPage onLogin={handleLogin} />
      </BrowserRouter>
    );
  }

  // Ruta por defecto según rol
  const defaultPath = session.role === 'admin' ? '/admin/dashboard' : '/revisor/videos';

  return (
    <BrowserRouter>
      {/* Banner de advertencia DeviceID */}
      {deviceWarning && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          padding: '8px 16px',
          fontSize: '0.8125rem',
          color: '#f87171',
          textAlign: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
        }}>
          ⚠️ Equipo no reconocido. Tu ID para añadir al panel es: <strong style={{ userSelect: 'all', background: 'rgba(0,0,0,0.2)', padding: '2px 4px', borderRadius: '4px' }}>{deviceId}</strong>
          <button
            onClick={() => setDeviceWarning(false)}
            style={{ marginLeft: 16, background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontFamily: 'var(--font-family)' }}
          >
            ✕
          </button>
        </div>
      )}

      <Routes>
        <Route path="/" element={<Navigate to={defaultPath} replace />} />

        <Route
          element={
            <Layout
              role={session.role}
              userName={session.name}
              userEmail={session.email}
              onLogout={handleLogout}
            />
          }
        >
          {/* Rutas Admin */}
          {session.role === 'admin' && (
            <>
              <Route path="/admin/dashboard" element={<DashboardPage />} />
              <Route path="/admin/alumnos" element={<AlumnosPage />} />
              <Route path="/admin/alumnos/:id" element={<AlumnoDetailPage />} />
              <Route path="/admin/pagos" element={<PagosPage />} />
              <Route path="/admin/comunicaciones" element={<ComunicacionesPage />} />
              <Route path="/admin/ediciones" element={<EdicionesPage />} />
              {/* Admin accede a vistas del revisor */}
              <Route path="/revisor/videos" element={<VideoReviewPage />} />
              <Route path="/revisor/emails" element={<EmailApprovalPage />} />
            </>
          )}

          {/* Rutas Revisor */}
          {session.role === 'revisor' && (
            <>
              <Route path="/revisor/videos" element={<VideoReviewPage />} />
              <Route path="/revisor/emails" element={<EmailApprovalPage />} />
            </>
          )}
        </Route>

        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
