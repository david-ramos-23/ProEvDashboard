/**
 * NotificationBell
 *
 * Bell icon with unread-count badge and a glassmorphism dropdown panel.
 * Navigates to the relevant page when a notification is clicked.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import styles from './NotificationBell.module.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

function routeForNotification(n: Notification): string {
  switch (n.type) {
    case 'review':
      return '/revisor/videos';
    case 'email':
      return '/revisor/emails';
    case 'activity':
    default:
      return '/admin/dashboard';
  }
}

function dotClass(type: Notification['type']): string {
  switch (type) {
    case 'review':
      return styles.dotReview;
    case 'email':
      return styles.dotEmail;
    case 'activity':
    default:
      return styles.dotActivity;
  }
}

/**
 * Resolves the stored message token into a human-readable string.
 *
 * Messages that contain __placeholder__ tokens (set by the hook) are
 * translated here. Plain strings (e.g. historial descriptions) are
 * returned as-is.
 */
function resolveMessage(message: string, t: (key: string) => string): string {
  // Pattern: "<count> __notifications.key__"
  const match = message.match(/^(\d+)\s+__(.+)__$/);
  if (match) {
    return `${match[1]} ${t(match[2])}`;
  }
  // Bare token: "__notifications.key__"
  const bareMatch = message.match(/^__(.+)__$/);
  if (bareMatch) {
    return t(bareMatch[1]);
  }
  return message;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, markOneRead, clearAll } = useNotifications();

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [open, handleOutsideClick]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function handleNotificationClick(n: Notification) {
    if (!n.read) markOneRead(n.id);
    setOpen(false);
    const route = routeForNotification(n);
    const url = n.targetId ? `${route}?highlight=${n.targetId}` : route;
    navigate(url);
  }

  function handleMarkAllRead(e: React.MouseEvent) {
    e.stopPropagation();
    markAllRead();
  }

  function handleClearAll(e: React.MouseEvent) {
    e.stopPropagation();
    clearAll();
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      {/* Bell trigger button */}
      <button
        type="button"
        className={`${styles.bellBtn} ${open ? styles.bellBtnActive : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t('notifications.title')}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {/* Bell SVG – inline to avoid external asset dependency */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span className={styles.badge} aria-label={`${unreadCount} unread`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className={styles.dropdown}
          role="dialog"
          aria-label={t('notifications.title')}
        >
          {/* Header */}
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>{t('notifications.title')}</span>
            <div className={styles.headerActions}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className={styles.markAllBtn}
                  onClick={handleMarkAllRead}
                >
                  {t('notifications.markAllRead')}
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  className={styles.clearAllBtn}
                  onClick={handleClearAll}
                  aria-label="Clear all notifications"
                >
                  {t('notifications.clearAll')}
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className={styles.list} role="list">
            {notifications.length === 0 ? (
              <p className={styles.empty}>{t('notifications.empty')}</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="listitem"
                  className={`${styles.item} ${!n.read ? styles.itemUnread : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <span className={`${styles.dot} ${dotClass(n.type)}`} aria-hidden="true" />
                  <span className={styles.itemBody}>
                    <span className={styles.itemMessage}>
                      {resolveMessage(n.message, t)}
                    </span>
                    <span className={styles.itemTime}>
                      {formatRelativeTime(n.timestamp)}
                    </span>
                  </span>
                  {!n.read && (
                    <span className={styles.unreadDot} aria-hidden="true" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
