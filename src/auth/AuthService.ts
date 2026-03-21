/**
 * AuthService — Servicio de autenticación del dashboard ProEv.
 * 
 * Implementa:
 * 1. Magic Link: Verifica email contra tabla de usuarios autorizados
 * 2. IP Whitelist: Verifica IP del cliente para acceso admin
 * 3. Sesión con token JWT-like (localStorage)
 * 
 * NOTA: En producción real, estas verificaciones deberían ejecutarse
 * server-side. Este es un MVP que funciona client-side.
 */

import { UserRole } from '@/types';

// ============================================================
// Tipos
// ============================================================

export interface AuthUser {
  email: string;
  name: string;
  role: UserRole;
  loginAt: string;
  expiresAt: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

// ============================================================
// Configuración
// ============================================================

const SESSION_KEY = 'proev_session';
const SESSION_DURATION_HOURS = 24;

/** IPs autorizadas para acceso admin (configurable vía .env) */
const ADMIN_IP_WHITELIST: string[] = (() => {
  const envIPs = import.meta.env.VITE_ADMIN_IP_WHITELIST;
  if (!envIPs) return [];
  return envIPs.split(',').map((ip: string) => ip.trim()).filter(Boolean);
})();

/**
 * Emails autorizados con sus roles.
 * En producción, esto vendría de una tabla "Usuarios" en Airtable/Supabase.
 */
const AUTHORIZED_USERS: Record<string, { role: UserRole; name: string }> = {
  'andara14@gmail.com': { role: 'admin', name: 'David Ramos' },
  // Añadir revisores aquí:
  // 'revisor@email.com': { role: 'revisor', name: 'Nombre Revisor' },
};

/**
 * Patrón para usuarios de test.
 * Los aliases andara14+test-*@gmail.com siempre tienen acceso admin.
 */
const TEST_USER_PATTERN = /^andara14\+test-.*@gmail\.com$/i;

/**
 * Patrón para detectar alias de admin con +admin
 */
const ADMIN_ALIAS_PATTERN = /\+admin@/i;

/**
 * Patrón para detectar alias de revisor
 */
const REVISOR_ALIAS_PATTERN = /\+revisor@/i;

// ============================================================
// API Pública
// ============================================================

/**
 * Intenta autenticar al usuario por email.
 * Verifica contra la lista de usuarios autorizados y patrones de test.
 */
export async function login(email: string): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase().trim();

  // Simular latencia de red (en producción sería una API call)
  await new Promise(resolve => setTimeout(resolve, 600));

  // 1. Verificar usuarios de test (siempre permitidos como admin)
  if (TEST_USER_PATTERN.test(normalizedEmail)) {
    return createSession(normalizedEmail, 'admin', 'Test User');
  }

  // 2. Verificar alias con +admin o +revisor
  if (ADMIN_ALIAS_PATTERN.test(normalizedEmail)) {
    return createSession(normalizedEmail, 'admin', 'Admin (alias)');
  }
  if (REVISOR_ALIAS_PATTERN.test(normalizedEmail)) {
    return createSession(normalizedEmail, 'revisor', 'Revisor (alias)');
  }

  // 3. Verificar contra lista de usuarios autorizados
  const authorizedUser = AUTHORIZED_USERS[normalizedEmail];
  if (authorizedUser) {
    return createSession(normalizedEmail, authorizedUser.role, authorizedUser.name);
  }

  // 4. No autorizado
  return {
    success: false,
    error: 'Email no autorizado. Contacta al administrador del sistema.',
  };
}

/**
 * Cierra la sesión actual.
 */
export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Recupera la sesión actual si existe y no ha expirado.
 */
export function getSession(): AuthUser | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    const session: AuthUser = JSON.parse(stored);

    // Verificar expiración
    if (new Date(session.expiresAt) < new Date()) {
      logout();
      return null;
    }

    return session;
  } catch {
    logout();
    return null;
  }
}

/**
 * Verifica si la IP actual está en la whitelist de admin.
 * Usa un servicio externo para obtener la IP del cliente.
 * 
 * @returns true si la IP está en whitelist, false si no, null si no se pudo verificar
 */
export async function checkIPWhitelist(): Promise<boolean | null> {
  if (ADMIN_IP_WHITELIST.length === 0) return true; // Sin whitelist = permitir todo

  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    const clientIP = data.ip;

    return ADMIN_IP_WHITELIST.includes(clientIP);
  } catch {
    console.warn('No se pudo verificar la IP del cliente');
    return null; // No bloquear si el servicio falla
  }
}

// ============================================================
// Helpers internos
// ============================================================

function createSession(email: string, role: UserRole, name: string): AuthResult {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  const user: AuthUser = {
    email,
    name,
    role,
    loginAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(user));

  return { success: true, user };
}
