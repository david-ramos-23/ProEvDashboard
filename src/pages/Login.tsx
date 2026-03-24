/**
 * Página Login — autenticación con AuthService.
 *
 * Diseño premium dark con glassmorphism.
 * Soporta:
 * - Email directo contra lista de usuarios autorizados
 * - Google Sign-In (GSI) si VITE_GOOGLE_CLIENT_ID está configurado
 */

import { useState, FormEvent, useEffect, useRef } from 'react';
import styles from './Login.module.css';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/hooks/useTheme';

// ── Google GSI types (la librería se carga vía script tag en index.html) ──────
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              width?: number | string;
              text?: string;
              shape?: string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface LoginProps {
  /** Retorna null si ok, string error si falla */
  onLogin: (email: string) => Promise<string | null>;
  /** Retorna null si ok, string error si falla. Recibe el credential JWT de Google. */
  onGoogleLogin: (credential: string) => Promise<string | null>;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function LoginPage({ onLogin, onGoogleLogin }: LoginProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Inicializar Google GSI una vez que el script externo esté disponible
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          setIsLoading(true);
          setError('');
          const errorMsg = await onGoogleLogin(response.credential);
          if (errorMsg) {
            setError(errorMsg);
          }
          setIsLoading(false);
        },
        auto_select: false,
        use_fedcm_for_prompt: true,
      });

      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'continue_with',
          shape: 'rectangular',
        });
      }
    };

    // El script puede estar ya cargado o aún cargando
    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const script = document.querySelector<HTMLScriptElement>(
        'script[src*="accounts.google.com/gsi/client"]'
      );
      if (script) {
        script.addEventListener('load', initGoogle, { once: true });
      }
    }
  }, [onGoogleLogin]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const errorMsg = await onLogin(email);
    if (errorMsg) {
      setError(errorMsg);
    }

    setIsLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />
      <div className={styles.bgOrb3} />

      <div className={styles.card}>
        <div className={styles.header}>
          <img
            src={theme === 'dark' ? '/logo-navbar.png' : '/logo.webp'}
            alt="FOCUS Dance Studio"
            className={styles.logoImg}
          />
          <div className={styles.logoProevBadge}>
            <span className={styles.logoProevDot} />
            <span className={styles.logoProev}>ProEv</span>
          </div>
          <p className={styles.subtitle}>Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className={styles.error}>
              <span aria-hidden="true">&#9888;</span> {error}
            </div>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isLoading || !email}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner} />
                {t('login.loggingIn')}
              </>
            ) : (
              t('login.loginButton')
            )}
          </button>
        </form>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className={styles.divider}>
              <span className={styles.dividerLine} />
              <span className={styles.dividerText}>{t('login.orDivider')}</span>
              <span className={styles.dividerLine} />
            </div>

            <div
              ref={googleBtnRef}
              className={styles.googleBtn}
              aria-label={t('login.googleButton')}
            />
          </>
        )}

        <div className={styles.footer}>
          <p>{t('login.footer')}</p>
        </div>
      </div>
    </div>
  );
}
