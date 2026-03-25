import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Reads `?highlight=recXXX` from the URL, scrolls to the matching row,
 * applies a pulse animation, then cleans up the param.
 *
 * The target element is found via `[data-row-id="recXXX"]`.
 */
export function useHighlightRow() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (!highlightId) return;

    // Give the page time to render data
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-row-id="${highlightId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('highlight-pulse');
        // Remove animation class and query param after animation
        setTimeout(() => {
          el.classList.remove('highlight-pulse');
          setSearchParams((prev) => {
            prev.delete('highlight');
            return prev;
          }, { replace: true });
        }, 2000);
      } else {
        // Element not found — clean up param anyway
        setSearchParams((prev) => {
          prev.delete('highlight');
          return prev;
        }, { replace: true });
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [searchParams, setSearchParams]);
}
