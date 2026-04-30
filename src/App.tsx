import { useState, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { sendMagicLink, verifyMagicLink, devVerifyMagicLink, loginWithGoogle, logout, getSession, AuthUser } from '@/auth/AuthService';
import Layout from '@/components/Layout/Layout';
import { LoadingSpinner } from '@/components/shared';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Analytics } from '@vercel/analytics/react';
import LoginPage from '@/pages/Login';
import { EdicionProvider } from '@/context/EdicionContext';
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
const AuditTrailPage = lazy(() => import('@/pages/admin/AuditTrail'));

export default function App() {
  const [session, setSession] = useState<AuthUser | null>(getSession);

  const handleSendMagicLink = useCallback(async (email: string) => {
    return sendMagicLink(email);
  }, []);

  const handleVerifyMagicLink = useCallback(async (token: string): Promise<string | null> => {
    const result = await verifyMagicLink(token);
    if (result.success && result.user) {
      setSession(result.user);
      return null;
    }
    return result.error || 'Enlace invalido o expirado';
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
        <LoginPage
          onSendMagicLink={handleSendMagicLink}
          onVerifyMagicLink={handleVerifyMagicLink}
          onGoogleLogin={handleGoogleLogin}
          onDevVerify={() => {
            const result = devVerifyMagicLink();
            if (result.success && result.user) setSession(result.user);
            return { success: result.success, error: result.error };
          }}
        />
        <Analytics />
      </BrowserRouter>
    );
  }

  // Ruta por defecto según rol
  const defaultPath = session.role === 'admin' ? '/admin/dashboard' : '/revisor/videos';

  return (
    <BrowserRouter>
      <ErrorBoundary>
      <EdicionProvider>
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
          {/* Rutas compartidas (admin + revisor) */}
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/alumnos" element={<AlumnosPage />} />
          <Route path="/admin/alumnos/:id" element={<AlumnoDetailPage />} />
          <Route path="/admin/pagos" element={<PagosPage />} />
          <Route path="/admin/inbox" element={<InboxPage />} />
          {/* Redirect legacy Comunicaciones URL */}
          <Route path="/admin/comunicaciones" element={<Navigate to="/admin/inbox" replace />} />
          <Route path="/admin/ediciones" element={<EdicionesPage />} />
          <Route path="/revisor/videos" element={<VideoReviewPage />} />
          <Route path="/revisor/emails" element={<EmailApprovalPage />} />

          {/* Rutas exclusivas Admin */}
          {session.role === 'admin' && (
            <Route path="/admin/audit" element={<AuditTrailPage />} />
          )}
        </Route>

        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>
      </Suspense>
      </EdicionProvider>
      </ErrorBoundary>
      <Analytics />
    </BrowserRouter>
  );
}
