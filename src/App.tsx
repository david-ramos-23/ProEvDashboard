import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { login, logout, getSession, AuthUser } from '@/auth/AuthService';
import Layout from '@/components/Layout/Layout';
import { Analytics } from '@vercel/analytics/react';
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
  }, []);

  // Sin sesión → Login
  if (!session) {
    return (
      <BrowserRouter>
        <LoginPage onLogin={handleLogin} />
        <Analytics />
      </BrowserRouter>
    );
  }

  // Ruta por defecto según rol
  const defaultPath = session.role === 'admin' ? '/admin/dashboard' : '/revisor/videos';

  return (
    <BrowserRouter>
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
      <Analytics />
    </BrowserRouter>
  );
}
