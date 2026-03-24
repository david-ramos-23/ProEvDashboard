/**
 * Layout principal del Dashboard.
 * 
 * Sidebar con navegación por rol + header + contenido.
 * Se adapta según el rol del usuario autenticado.
 */

import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ADMIN_NAV, REVISOR_NAV, NavItem } from '@/utils/constants';
import { getInitials } from '@/utils/formatters';
import { useTranslation, Locale } from '@/i18n';
import NotificationBell from '@/components/NotificationBell';
import { ScrollToTop } from '@/components/shared';
import { useTheme } from '@/hooks/useTheme';
import { useEdicion } from '@/context/EdicionContext';
import AIAssistant from '@/components/AIAssistant/AIAssistant';
import styles from './Layout.module.css';

interface LayoutProps {
  /** Rol del usuario actual */
  role: 'admin' | 'revisor';
  /** Nombre del usuario */
  userName: string;
  /** Email del usuario */
  userEmail: string;
  /** Callback para cerrar sesión */
  onLogout: () => void;
}

/**
 * Obtiene los títulos de las páginas basándose en la ruta actual.
 */
const PAGE_TITLE_KEYS: Record<string, string> = {
  '/admin/dashboard': 'dashboard.title',
  '/admin/alumnos': 'alumnos.title',
  '/admin/pagos': 'pagos.title',
  '/admin/inbox': 'inbox.title',
  '/admin/ediciones': 'ediciones.title',
  '/revisor/videos': 'videoReview.title',
  '/revisor/emails': 'emailApproval.title',
};

/** Pages where edition filter doesn't apply */
const NO_EDITION_FILTER_PAGES = new Set(['/admin/ediciones', '/admin/inbox', '/revisor/emails']);

export default function Layout({ role, userName, userEmail, onLogout }: LayoutProps) {
  const location = useLocation();
  const { t, locale, setLocale } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [aiOpen, setAiOpen] = useState(false);
  const { ediciones, selectedNombre, setSelectedNombre } = useEdicion();
  const navItems: NavItem[] = role === 'admin' ? ADMIN_NAV : REVISOR_NAV;
  const basePath = '/' + location.pathname.split('/').slice(1, 3).join('/');
  const pageTitle = t(PAGE_TITLE_KEYS[basePath] || 'common.noData');
  const showEdicionFilter = !NO_EDITION_FILTER_PAGES.has(basePath);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        {/* Logo */}
        <div className={styles.logo}>
          <img
            src="/logo-navbar.png"
            alt="FOCUS Dance Studio"
            className={styles.logoImg}
          />
          <span className={styles.logoProev}>ProEv</span>
        </div>

        {/* Navegación */}
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Usuario */}
        <div className={styles.userSection}>
          <div className={styles.avatar}>{getInitials(userName)}</div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{userName}</div>
            <div className={styles.userRole}>{role}</div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={onLogout}
            title="Cerrar sesión"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className={styles.main}>
        <header className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <h1 className={styles.pageTitle}>{pageTitle}</h1>
            {showEdicionFilter && ediciones.length > 0 && (
              <select
                value={selectedNombre}
                onChange={e => setSelectedNombre(e.target.value)}
                className={styles.edicionSelect}
              >
                {ediciones.map(ed => (
                  <option key={ed.id} value={ed.nombre}>
                    {ed.nombre}{ed.esEdicionActiva ? ' ★' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
              style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'transparent', border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem', transition: 'all var(--transition-fast)',
                fontFamily: 'var(--font-family)',
              }}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <NotificationBell />
            <div style={{ display: 'flex', gap: '4px' }}>
            {(['es', 'en'] as Locale[]).map(l => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: locale === l ? 600 : 400,
                  background: locale === l ? 'var(--color-accent-primary-glow)' : 'transparent',
                  border: locale === l ? '1px solid rgba(12, 90, 69, 0.3)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: locale === l ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family)',
                }}
              >
                {l === 'es' ? 'ES' : 'EN'}
              </button>
            ))}
            </div>
            {/* AI Assistant toggle */}
            <button
              onClick={() => setAiOpen(o => !o)}
              title={aiOpen ? 'Cerrar asistente IA' : 'Abrir asistente IA'}
              aria-label="Abrir asistente IA"
              style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: aiOpen ? 'var(--color-accent-primary)' : 'transparent',
                border: aiOpen ? 'none' : '1px solid var(--color-border)',
                color: aiOpen ? 'white' : 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', transition: 'all var(--transition-fast)',
                fontFamily: 'var(--font-family)',
                fontWeight: 600,
              }}
            >
              ✦
            </button>
          </div>
        </header>
        <div className={styles.content} key={location.pathname}>
          <Outlet />
        </div>
        <ScrollToTop aiOpen={aiOpen} />
      </main>
      {/* Flex spacer — pushes main content left when AI panel is open */}
      <div className={`${styles.aiSpacer} ${aiOpen ? styles.aiSpacerOpen : ''}`} />
      <AIAssistant isOpen={aiOpen} onToggle={() => setAiOpen(o => !o)} />
    </div>
  );
}
