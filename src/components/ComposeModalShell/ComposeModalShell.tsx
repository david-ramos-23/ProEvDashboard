import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './ComposeModalShell.module.css';

/**
 * Shared chrome for compose-style modals: portal, overlay, focus trap, Escape-to-close,
 * `role="dialog"`, and a generic success state. Extracted from `EmailComposeModal` so
 * `BulkComposeModal` reuses the same behaviour without duplicating it.
 */
export interface ComposeModalShellProps {
  open: boolean;
  onClose: () => void;
  /** While true, Escape and overlay-click do not close the modal (e.g. mid-submit). */
  isBusy?: boolean;
  /** id of the element that labels the dialog (title or success heading) */
  titleId: string;
  showSuccess?: boolean;
  successIcon?: ReactNode;
  successTitle?: ReactNode;
  successDescription?: ReactNode;
  successCloseLabel?: ReactNode;
  children: ReactNode;
}

export function ComposeModalShell({
  open,
  onClose,
  isBusy = false,
  titleId,
  showSuccess = false,
  successIcon = '✓',
  successTitle,
  successDescription,
  successCloseLabel,
  children,
}: ComposeModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape key
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel) {
      const firstInput = panel.querySelector<HTMLElement>('select, input, textarea, button');
      firstInput?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) {
        onClose();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const focusable = panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isBusy, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={styles.overlay} onClick={!isBusy ? onClose : undefined}>
      <div
        ref={panelRef}
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {showSuccess ? (
          <div className={styles.successState}>
            <div className={styles.successIcon} aria-hidden="true">{successIcon}</div>
            <h2 id={titleId} className={styles.successTitle}>{successTitle}</h2>
            <p className={styles.successDescription}>{successDescription}</p>
            <button className={styles.closeButton} onClick={onClose}>{successCloseLabel}</button>
          </div>
        ) : children}
      </div>
    </div>,
    document.body
  );
}
