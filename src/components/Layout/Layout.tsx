/**
 * Layout principal del Dashboard.
 * 
 * Sidebar con navegación por rol + header + contenido.
 * Se adapta según el rol del usuario autenticado.
 */

import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ADMIN_NAV, REVISOR_NAV, NavItem } from '@/utils/constants';
import { getInitials } from '@/utils/formatters';
import { useTranslation, Locale } from '@/i18n';
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
  '/admin/comunicaciones': 'comunicaciones.title',
  '/admin/ediciones': 'ediciones.title',
  '/revisor/videos': 'videoReview.title',
  '/revisor/emails': 'emailApproval.title',
};

export default function Layout({ role, userName, userEmail, onLogout }: LayoutProps) {
  const location = useLocation();
  const { t, locale, setLocale } = useTranslation();
  const navItems: NavItem[] = role === 'admin' ? ADMIN_NAV : REVISOR_NAV;
  const basePath = '/' + location.pathname.split('/').slice(1, 3).join('/');
  const pageTitle = t(PAGE_TITLE_KEYS[basePath] || 'common.noData');

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoText}>ProEv</span>
          <span className={styles.logoSub}>Dashboard</span>
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
            ⏻
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>{pageTitle}</h1>
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
                  border: locale === l ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: locale === l ? 'var(--color-accent-primary-hover)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family)',
                }}
              >
                {l === 'es' ? 'ES' : 'EN'}
              </button>
            ))}
          </div>
        </header>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
