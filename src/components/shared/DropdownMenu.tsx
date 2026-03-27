import { useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Shared.module.css';

interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  width?: number;
  /** Optional ref to align dropdown's right edge with (instead of trigger) */
  alignRef?: React.RefObject<HTMLElement | null>;
}

export function DropdownMenu({ open, onClose, triggerRef, children, width = 240, alignRef }: DropdownMenuProps) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const alignRect = alignRef?.current?.getBoundingClientRect();
    const rightEdge = alignRect ? alignRect.right : triggerRect.right;
    let left = rightEdge - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    setPos({ top: triggerRect.bottom + 6 + window.scrollY, left });
  }, [open, triggerRef, width, alignRef]);

  // Set aria-expanded on trigger
  useEffect(() => {
    if (triggerRef.current) triggerRef.current.setAttribute('aria-expanded', String(open));
    if (open && triggerRef.current) triggerRef.current.setAttribute('aria-haspopup', 'menu');
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = dropRef.current?.querySelectorAll<HTMLElement>('button, [role="menuitem"], a');
        if (!items?.length) return;
        const active = document.activeElement as HTMLElement;
        const idx = Array.from(items).indexOf(active);
        const next = e.key === 'ArrowDown'
          ? items[(idx + 1) % items.length]
          : items[(idx - 1 + items.length) % items.length];
        next?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div ref={dropRef} className={styles.dropdownPortal} role="menu" style={{ top: pos.top, left: pos.left, width }}>
      {children}
    </div>,
    document.body
  );
}
