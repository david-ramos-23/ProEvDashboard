import { useState, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { login, loginWithGoogle, logout, getSession, AuthUser } from '@/auth/AuthService';
import Layout from '@/components/Layout/Layout';
import { LoadingSpinner } from '@/components/shared';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Analytics } from '@vercel/analytics/react';
import LoginPage from '@/pages/Login';
import '@/styles/global.css';

// Lazy-loaded pages
const DashboardPage = lazy(() => import('@/pages/admin/Dashboard'));
const AlumnosPage = lazy(() => import('@/pages/admin/Alumnos'));
const AlumnoDetailPage = lazy(() => import('@/pages/admin/AlumnoDetail'));
const PagosPage = lazy(() => import('@/pages/admin/Pagos'));
const EdicionesPage = lazy(() => import('@/pages/admin/Ediciones'));
const VideoReviewPage = lazy(() => import('@/pages/revisor/VideoReview'));
const EmailApprovalPage = lazy(() => import('@/pages/revisor/EmailApproval'));
const InboxPage = lazy(() => import('@/pages/admin/Inbox'));

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

  const handleGoogleLogin = useCallback(async (credential: string): Promise<string | null> => {
    const result = await loginWithGoogle(credential);
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
        <LoginPage onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />
        <Analytics />
      </BrowserRouter>
    );
  }

  // Ruta por defecto según rol
  const defaultPath = session.role === 'admin' ? '/admin/dashboard' : '/revisor/videos';

  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner text="Cargando..." />}>
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
              <Route path="/admin/inbox" element={<InboxPage />} />
              {/* Redirect legacy Comunicaciones URL */}
              <Route path="/admin/comunicaciones" element={<Navigate to="/admin/inbox" replace />} />
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
      </Suspense>
      </ErrorBoundary>
      <Analytics />
    </BrowserRouter>
  );
}
