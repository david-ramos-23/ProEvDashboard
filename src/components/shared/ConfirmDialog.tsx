import { useEffect, useRef } from 'react';
import styles from './Shared.module.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'success' | 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  success: { background: 'var(--color-accent-success, #16a34a)', color: '#fff' },
  danger: { background: 'var(--color-accent-danger, #dc2626)', color: '#fff' },
  warning: { background: 'var(--color-accent-warning, #f59e0b)', color: '#fff' },
};

export function ConfirmDialog({
  open,
  title,
  message,
  icon,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'success',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = dialogRef.current;
    if (panel) {
      const firstBtn = panel.querySelector<HTMLElement>('button');
      firstBtn?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCancel(); return; }
      if (e.key === 'Tab' && panel) {
        const focusable = panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className={styles.confirmOverlay} onClick={onCancel}>
      <div
        ref={dialogRef}
        className={styles.confirmPanel}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        {icon && <div className={styles.confirmIcon}>{icon}</div>}
        <div className={styles.confirmTitle} id="confirm-title">{title}</div>
        {message && <div className={styles.confirmMessage} id="confirm-message">{message}</div>}
        <div className={styles.confirmActions}>
          <button className={styles.confirmCancel} onClick={onCancel}>{cancelLabel}</button>
          <button
            className={styles.confirmOk}
            style={VARIANT_STYLES[variant]}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
