import { useEffect } from 'react';
import { ScrollToTop } from 'dashboard';

// The real component is a position:fixed button that only mounts after the page
// is scrolled past 400px. To show it statically we fake a scrolled window and
// fire the scroll event the component listens for.
function Forced() {
  useEffect(() => {
    try {
      Object.defineProperty(window, 'scrollY', { configurable: true, get: () => 600 });
    } catch { /* noop */ }
    window.dispatchEvent(new Event('scroll'));
  }, []);
  return (
    <div style={{ height: 200, position: 'relative', background: 'var(--color-bg-primary)' }}>
      <ScrollToTop />
    </div>
  );
}

/** Fixed "back to top" control, shown after scrolling (forced visible here). */
export const Boton = () => <Forced />;
