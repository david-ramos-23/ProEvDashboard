/**
 * Layout principal del Dashboard.
 * 
 * Sidebar con navegación por rol + header + contenido.
 * Se adapta según el rol del usuario autenticado.
 */

import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ADMIN_NAV, REVISOR_NAV, NavItem } from '@/utils/constants';
import { getInitials } from '@/utils/formatters';
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
function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    '/admin/dashboard': 'Dashboard',
    '/admin/alumnos': 'Gestión de Alumnos',
    '/admin/pagos': 'Portal de Pagos',
    '/admin/comunicaciones': 'Comunicaciones',
    '/admin/ediciones': 'Gestión de Ediciones',
    '/revisor/videos': 'Revisión de Videos',
    '/revisor/emails': 'Aprobación de Emails',
  };
  // Manejar rutas con parámetros (e.g., /admin/alumnos/recXXX)
  const basePath = '/' + pathname.split('/').slice(1, 3).join('/');
  return titles[basePath] || 'ProEv Dashboard';
}

export default function Layout({ role, userName, userEmail, onLogout }: LayoutProps) {
  const location = useLocation();
  const navItems: NavItem[] = role === 'admin' ? ADMIN_NAV : REVISOR_NAV;
  const pageTitle = getPageTitle(location.pathname);

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
        </header>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
