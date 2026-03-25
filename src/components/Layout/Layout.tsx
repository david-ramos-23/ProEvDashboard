/**
 * Layout principal del Dashboard.
 * 
 * Sidebar con navegación por rol + header + contenido.
 * Se adapta según el rol del usuario autenticado.
 */

import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ADMIN_NAV, REVISOR_NAV, NavItem } from '@/utils/constants';
import { getInitials } from '@/utils/formatters';
import { useTranslation, Locale } from '@/i18n';
import NotificationBell from '@/components/NotificationBell';
import { ScrollToTop, DropdownMenu } from '@/components/shared';
import { useTheme } from '@/hooks/useTheme';
import { useIsMobile } from '@/hooks/useMediaQuery';
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
  const isMobile = useIsMobile();
  const [aiOpen, setAiOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [edicionOpen, setEdicionOpen] = useState(false);
  const edicionBtnRef = useRef<HTMLButtonElement>(null);
  const { ediciones, selectedNombre, setSelectedNombre } = useEdicion();
  const navItems: NavItem[] = role === 'admin' ? ADMIN_NAV : REVISOR_NAV;
  const basePath = '/' + location.pathname.split('/').slice(1, 3).join('/');
  const pageTitle = t(PAGE_TITLE_KEYS[basePath] || 'common.noData');
  const showEdicionFilter = !NO_EDITION_FILTER_PAGES.has(basePath);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  return (
    <div className={styles.layout}>
      {/* Mobile sidebar backdrop */}
      {isMobile && (
        <div
          className={`${styles.sidebarBackdrop} ${sidebarOpen ? styles.sidebarBackdropOpen : ''}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isMobile && sidebarOpen ? styles.sidebarOpen : ''}`}>
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

        {/* Mobile-only: theme + language in sidebar footer */}
        {isMobile && (
          <div className={styles.sidebarFooterControls}>
            <button
              onClick={toggleTheme}
              className={styles.sidebarFooterBtn}
              title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
              <span>{theme === 'light' ? 'Modo oscuro' : 'Modo claro'}</span>
            </button>
            <button
              onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
              className={styles.sidebarFooterBtn}
              title={locale === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{locale === 'es' ? 'English' : 'Español'}</span>
            </button>
          </div>
        )}

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
          <div className={styles.headerLeft}>
            {/* Mobile hamburger */}
            {isMobile && (
              <button
                className={styles.hamburger}
                onClick={() => setSidebarOpen(o => !o)}
                aria-label="Abrir menú"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}
            <h1 className={styles.pageTitle}>{pageTitle}</h1>
            {!isMobile && showEdicionFilter && ediciones.length > 0 && (
              <>
                <button
                  ref={edicionBtnRef}
                  className={`${styles.edicionSelect} ${edicionOpen ? styles.edicionSelectActive : ''}`}
                  onClick={() => setEdicionOpen(p => !p)}
                >
                  {selectedNombre}{ediciones.find(e => e.nombre === selectedNombre)?.esEdicionActiva ? ' ★' : ''}
                </button>
                <DropdownMenu open={edicionOpen} onClose={() => setEdicionOpen(false)} triggerRef={edicionBtnRef} matchTriggerWidth>
                  {ediciones.map(ed => (
                    <button
                      key={ed.id}
                      className={styles.edicionOption}
                      style={ed.nombre === selectedNombre ? { background: 'var(--color-accent-primary-glow)', color: 'var(--color-accent-primary)' } : undefined}
                      onClick={() => { setSelectedNombre(ed.nombre); setEdicionOpen(false); }}
                    >
                      {ed.nombre}{ed.esEdicionActiva ? ' ★' : ''}
                    </button>
                  ))}
                </DropdownMenu>
              </>
            )}
          </div>
          <div className={styles.headerRight}>
            <NotificationBell />
            {/* Theme + Language — desktop only (mobile has them in sidebar) */}
            {!isMobile && (
              <>
                <button
                  onClick={toggleTheme}
                  className={styles.headerIconBtn}
                  title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
                >
                  {theme === 'light' ? '🌙' : '☀️'}
                </button>
                <button
                  onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
                  className={styles.langToggleBtn}
                  title={locale === 'es' ? 'Switch to English' : 'Cambiar a Español'}
                >
                  {locale.toUpperCase()}
                </button>
              </>
            )}
            {/* AI Assistant toggle */}
            <button
              onClick={() => setAiOpen(o => !o)}
              className={`${styles.headerIconBtn} ${styles.aiToggleBtn} ${aiOpen ? styles.aiToggleBtnActive : ''}`}
              title={aiOpen ? 'Cerrar asistente IA' : 'Abrir asistente IA'}
              aria-label="Abrir asistente IA"
            >
              ✦
            </button>
          </div>
        </header>
        {/* Mobile edition filter sub-bar */}
        {isMobile && showEdicionFilter && ediciones.length > 0 && (
          <div className={styles.mobileEdicionBar}>
            <button
              ref={edicionBtnRef}
              className={`${styles.edicionSelect} ${styles.mobileEdicionSelect} ${edicionOpen ? styles.edicionSelectActive : ''}`}
              onClick={() => setEdicionOpen(p => !p)}
            >
              {selectedNombre}{ediciones.find(e => e.nombre === selectedNombre)?.esEdicionActiva ? ' ★' : ''}
            </button>
            <DropdownMenu open={edicionOpen} onClose={() => setEdicionOpen(false)} triggerRef={edicionBtnRef} width={180}>
              {ediciones.map(ed => (
                <button
                  key={ed.id}
                  className={styles.edicionOption}
                  style={ed.nombre === selectedNombre ? { background: 'var(--color-accent-primary-glow)', color: 'var(--color-accent-primary)' } : undefined}
                  onClick={() => { setSelectedNombre(ed.nombre); setEdicionOpen(false); }}
                >
                  {ed.nombre}{ed.esEdicionActiva ? ' ★' : ''}
                </button>
              ))}
            </DropdownMenu>
          </div>
        )}
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
