/**
 * Pagina Login - autenticacion con Magic Link + Google Sign-In.
 *
 * Flujos:
 * 1. Magic Link: email -> API envia enlace -> usuario clickea -> verifica token
 * 2. Google Sign-In (GSI) si VITE_GOOGLE_CLIENT_ID esta configurado
 * 3. Token en URL: verifica automaticamente al cargar la pagina
 */

import { useState, FormEvent, useEffect, useRef } from 'react';
import styles from './Login.module.css';
import { useTranslation } from '@/i18n';

// ── Google GSI types ──────────────────────────────────────────────────────────
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

type LoginState = 'idle' | 'sending' | 'sent' | 'verifying';

interface LoginProps {
  onGoogleLogin: (credential: string) => Promise<string | null>;
  onSendMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
  onVerifyMagicLink: (token: string) => Promise<string | null>;
  onDevVerify?: () => { success: boolean; error?: string };
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const IS_DEV = import.meta.env.DEV;

export default function LoginPage({
  onGoogleLogin,
  onSendMagicLink,
  onVerifyMagicLink,
  onDevVerify,
}: LoginProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [state, setState] = useState<LoginState>('idle');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // ── Check for magic link token in URL on mount ────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setState('verifying');
      window.history.replaceState({}, '', '/login');
      onVerifyMagicLink(token).then(err => {
        if (err) {
          setError(err);
          setState('idle');
        }
      });
    }
  }, [onVerifyMagicLink]);

  // ── Initialize Google GSI ─────────────────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          setState('verifying');
          setError('');
          const errorMsg = await onGoogleLogin(response.credential);
          if (errorMsg) {
            setError(errorMsg);
            setState('idle');
          }
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

  // ── Send magic link ───────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError('');

    const result = await onSendMagicLink(email);
    if (result.success) {
      setState('sent');
    } else {
      setError(result.error || 'Error al enviar el enlace');
      setState('idle');
    }
  };

  const isLoading = state === 'sending' || state === 'verifying';

  return (
    <div className={styles.container}>
      <video
        className={styles.videoBg}
        src="https://alonsoynoeliaonline.com/wp-content/uploads/2026/02/hero-completo.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className={styles.videoOverlay} />

      <div className={styles.card}>
        <div className={styles.header}>
          <img
            src="/logo-navbar.png"
            alt="FOCUS Dance Studio"
            className={styles.logoImg}
          />
          <p className={styles.logoProev}>ProEv</p>
          <p className={styles.subtitle}>Dashboard</p>
        </div>

        {state === 'verifying' ? (
          /* ── Verifying token state ─────────────────────────────────── */
          <div className={styles.sentState}>
            <span className={styles.spinner} />
            <p className={styles.sentTitle}>Verificando acceso...</p>
          </div>
        ) : state === 'sent' ? (
          /* ── Email sent state ──────────────────────────────────────── */
          <div className={styles.sentState}>
            <div className={styles.sentIcon}>&#9993;</div>
            <p className={styles.sentTitle}>Revisa tu correo</p>
            <p className={styles.sentDesc}>
              Enviamos un enlace de acceso a <strong>{email}</strong>.
              Expira en 10 minutos.
            </p>
            {IS_DEV && onDevVerify && (
              <button
                className={styles.submitBtn}
                style={{ marginTop: 8, width: '100%' }}
                onClick={() => {
                  const result = onDevVerify();
                  if (result.success) return; // session created, App re-renders
                  setError(result.error || 'Error');
                  setState('idle');
                }}
              >
                <span className={styles.btnText}>[DEV] Acceder sin email</span>
                <span className={styles.btnSpinner}><span className={styles.spinner} /></span>
              </button>
            )}
            <button
              className={styles.backBtn}
              onClick={() => { setState('idle'); setError(''); }}
            >
              Usar otro email
            </button>
          </div>
        ) : (
          /* ── Default: email form ───────────────────────────────────── */
          <>
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
                className={`${styles.submitBtn} ${state === 'sending' ? styles.submitBtnLoading : ''}`}
                disabled={isLoading || !email}
              >
                <span className={styles.btnText}>{t('login.magicLink') || 'Enviar enlace de acceso'}</span>
                <span className={styles.btnSpinner}><span className={styles.spinner} /></span>
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
          </>
        )}

        <div className={styles.footer}>
          <p>{t('login.footer')}</p>
        </div>
      </div>
    </div>
  );
}
