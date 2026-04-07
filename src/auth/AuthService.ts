/**
 * AuthService — Servicio de autenticación del dashboard ProEv.
 *
 * Implementa:
 * 1. Magic Link: Verifica email contra tabla de usuarios autorizados
 * 2. Google OAuth: Verifica ID token de Google y extrae perfil
 * 3. IP Whitelist: Verifica IP del cliente para acceso admin
 * 4. Sesión con token JWT-like (localStorage)
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

/** IDs de dispositivo autorizados para acceso admin (configurable vía .env) */
const ADMIN_DEVICE_IDS: string[] = (() => {
  const envIds = import.meta.env.VITE_ADMIN_DEVICE_IDS;
  if (!envIds) return [];
  return envIds.split(',').map((id: string) => id.trim()).filter(Boolean);
})();

/**
 * Emails autorizados con sus roles.
 * En producción, esto vendría de una tabla "Usuarios" en Airtable/Supabase.
 */
const AUTHORIZED_USERS: Record<string, { role: UserRole; name: string }> = {
  'andara14@gmail.com': { role: 'admin', name: 'David Ramos' },
  'david@dravaautomations.com': { role: 'admin', name: 'David Ramos' },
  'proevolutioncourse@gmail.com': { role: 'admin', name: 'Pro Evolution Course' },
  'alonsoynoelia17@gmail.com': { role: 'revisor', name: 'Alonso y Noelia' },
  'alonkickboxer@gmail.com': { role: 'revisor', name: 'Alonkickboxer' },
};

/**
 * Patrón para usuarios de test.
 * Los aliases andara14+test-*@gmail.com siempre tienen acceso admin.
 */
const TEST_USER_PATTERN = /^andara14\+test-.*@gmail\.com$/i;

/**
 * Patrón para detectar alias de admin con +admin
 */
const ADMIN_ALIAS_PATTERN = /^andara14\+admin@gmail\.com$/i;

/**
 * Patrón para detectar alias de revisor
 */
const REVISOR_ALIAS_PATTERN = /^andara14\+revisor@gmail\.com$/i;

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

// ============================================================
// Google OAuth
// ============================================================

/**
 * Payload decodificado de un Google ID token (JWT).
 * Solo los campos que nos interesan.
 */
interface GoogleJwtPayload {
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

/**
 * Decodifica el payload de un Google ID token (JWT) sin verificar firma.
 * La verificación criptográfica de la firma debe hacerse server-side.
 * Client-side esto es suficiente para el MVP: Google GSI ya valida el token
 * antes de entregarlo al callback.
 */
function decodeGoogleToken(credential: string): GoogleJwtPayload | null {
  try {
    const parts = credential.split('.');
    if (parts.length !== 3) return null;

    // El payload es la segunda parte, codificado en base64url
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    // Padding necesario para atob
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as GoogleJwtPayload;
  } catch {
    return null;
  }
}

/**
 * Autentica al usuario usando un Google ID token (credential) proveniente
 * del callback de Google Sign-In (GSI).
 *
 * Flujo:
 * 1. Decodifica el JWT para extraer email, name, picture
 * 2. Verifica el email contra la misma lógica que login()
 * 3. Crea sesión idéntica a login()
 */
export async function loginWithGoogle(credential: string): Promise<AuthResult> {
  const payload = decodeGoogleToken(credential);

  if (!payload || !payload.email) {
    return {
      success: false,
      error: 'No se pudo leer el token de Google. Inténtalo de nuevo.',
    };
  }

  if (!payload.email_verified) {
    return {
      success: false,
      error: 'La cuenta de Google no tiene el email verificado.',
    };
  }

  const normalizedEmail = payload.email.toLowerCase().trim();
  const displayName = payload.name ?? normalizedEmail;

  // Misma lógica de autorización que login()

  if (TEST_USER_PATTERN.test(normalizedEmail)) {
    return createSession(normalizedEmail, 'admin', displayName);
  }

  if (ADMIN_ALIAS_PATTERN.test(normalizedEmail)) {
    return createSession(normalizedEmail, 'admin', displayName);
  }

  if (REVISOR_ALIAS_PATTERN.test(normalizedEmail)) {
    return createSession(normalizedEmail, 'revisor', displayName);
  }

  const authorizedUser = AUTHORIZED_USERS[normalizedEmail];
  if (authorizedUser) {
    // Preferir el nombre real de Google sobre el nombre hardcodeado
    return createSession(normalizedEmail, authorizedUser.role, displayName || authorizedUser.name);
  }

  return {
    success: false,
    error: 'Cuenta de Google no autorizada. Contacta al administrador del sistema.',
  };
}

// ============================================================
// Magic Link
// ============================================================

/**
 * Solicita un magic link por email.
 * En produccion (Vercel) llama a la API serverless.
 * En dev (Vite) usa login directo como fallback.
 */
export async function sendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
  const normalized = email.toLowerCase().trim();

  try {
    const res = await fetch('/api/auth/send-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized }),
    });

    // If API doesn't exist (dev mode), the response will be HTML (Vite's index.html fallback)
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Dev mode fallback: simulate magic link by logging in directly
      console.warn('[Auth] Magic link API not available — using dev fallback');
      return devFallbackSendMagicLink(normalized);
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.error || 'Error al enviar el enlace' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Error de conexion. Intentalo de nuevo.' };
  }
}

/**
 * Dev fallback: simulates sending a magic link by directly creating a session.
 * Only used when the serverless API is not available (local Vite dev).
 */
async function devFallbackSendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
  await new Promise(resolve => setTimeout(resolve, 800));

  // Check authorization using same logic
  const isAuth = TEST_USER_PATTERN.test(email)
    || ADMIN_ALIAS_PATTERN.test(email)
    || REVISOR_ALIAS_PATTERN.test(email)
    || !!AUTHORIZED_USERS[email];

  if (!isAuth) {
    // Still return success to prevent enumeration (same as production)
    return { success: true };
  }

  // Store a dev token so verifyMagicLink can pick it up
  sessionStorage.setItem('proev_dev_magic_email', email);
  return { success: true };
}

/**
 * Verifica un token de magic link contra la API server-side.
 * Si es valido, crea la sesion local.
 */
export async function verifyMagicLink(token: string): Promise<AuthResult> {
  try {
    const res = await fetch('/api/auth/verify-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { success: false, error: 'Servicio no disponible. Intentalo de nuevo.' };
    }

    const data = await res.json();

    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Enlace invalido o expirado' };
    }

    return createSession(data.user.email, data.user.role as UserRole, data.user.name);
  } catch {
    return { success: false, error: 'Error de conexion. Intentalo de nuevo.' };
  }
}

/**
 * Dev fallback: verifies the magic link locally using sessionStorage.
 * Called from Login.tsx when user clicks "Ya he revisado mi correo" in dev mode.
 */
export function devVerifyMagicLink(): AuthResult {
  const email = sessionStorage.getItem('proev_dev_magic_email');
  sessionStorage.removeItem('proev_dev_magic_email');

  if (!email) {
    return { success: false, error: 'No hay enlace pendiente.' };
  }

  if (TEST_USER_PATTERN.test(email)) return createSession(email, 'admin', 'Test User');
  if (ADMIN_ALIAS_PATTERN.test(email)) return createSession(email, 'admin', 'Admin (alias)');
  if (REVISOR_ALIAS_PATTERN.test(email)) return createSession(email, 'revisor', 'Revisor (alias)');

  const user = AUTHORIZED_USERS[email];
  if (user) return createSession(email, user.role, user.name);

  return { success: false, error: 'Email no autorizado.' };
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
 * Obtiene o genera un Device ID único para este navegador.
 */
export function getDeviceId(): string {
  const DEVICE_KEY = 'proev_device_id';
  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    localStorage.setItem(DEVICE_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Verifica si el Device ID actual está en la whitelist de admin.
 * 
 * @returns true si el dispositivo está en whitelist, false si no
 */
export async function checkDeviceWhitelist(): Promise<boolean> {
  if (ADMIN_DEVICE_IDS.length === 0) return true; // Sin whitelist = permitir todo
  const currentId = getDeviceId();
  return ADMIN_DEVICE_IDS.includes(currentId);
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
