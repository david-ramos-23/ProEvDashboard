import { useState, useEffect } from 'react';
import styles from './Shared.module.css';

/** Fixed scroll-to-top button, visible after 400px scroll */
export function ScrollToTop({ aiOpen = false }: { aiOpen?: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      className={styles.scrollTop}
      style={{ right: aiOpen ? 388 : 28, transition: 'right 300ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Volver arriba"
      title="Volver arriba"
    >
      ↑
    </button>
  );
}
