/**
 * Página Login — autenticación con AuthService.
 * 
 * Diseño premium dark con glassmorphism.
 * Verifica email contra usuarios autorizados vía AuthService.
 */

import { useState, FormEvent } from 'react';
import styles from './Login.module.css';

interface LoginProps {
  /** Retorna null si ok, string error si falla */
  onLogin: (email: string) => Promise<string | null>;
}

export default function LoginPage({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
          <h1 className={styles.logo}>ProEv</h1>
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
              <span>⚠️</span> {error}
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
                Verificando...
              </>
            ) : (
              'Acceder'
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <p>Sistema de gestión del curso Professional Evolution</p>
        </div>
      </div>
    </div>
  );
}
