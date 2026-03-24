/**
 * Hook de notificaciones con polling cada 60 segundos.
 *
 * Compara conteos actuales contra los últimos valores guardados en
 * localStorage para detectar elementos nuevos sin WebSocket.
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchRevisionStats } from '@/data/adapters/airtable/RevisionesAdapter';
import { fetchColaEmails } from '@/data/adapters/airtable/ColaEmailsAdapter';
import { ESTADO_EMAIL } from '@/utils/constants';
import { fetchHistorial } from '@/data/adapters/airtable/HistorialAdapter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  type: 'review' | 'email' | 'activity';
  message: string;
  timestamp: string;
  read: boolean;
}

interface NotificationSnapshot {
  pendingReviews: number;
  pendingEmails: number;
  latestHistorialId: string | null;
}

interface StoredNotifications {
  snapshot: NotificationSnapshot;
  notifications: Notification[];
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'proev_notifications';

function loadStored(): StoredNotifications | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredNotifications;
  } catch {
    return null;
  }
}

function saveStored(data: StoredNotifications): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage quota issues are non-fatal
  }
}

// ---------------------------------------------------------------------------
// Data fetcher – runs on every poll cycle
// ---------------------------------------------------------------------------

async function fetchNotificationData(): Promise<{
  pendingReviews: number;
  pendingEmails: number;
  latestHistorialId: string | null;
  historialDescription: string;
}> {
  const [revisionStats, colaEmails, historial] = await Promise.all([
    fetchRevisionStats(),
    fetchColaEmails({ estado: ESTADO_EMAIL.PENDIENTE_APROBACION }),
    fetchHistorial({ maxRecords: 5 }),
  ]);

  const latestEntry = historial[0] ?? null;

  return {
    pendingReviews: revisionStats.pendientes,
    pendingEmails: colaEmails.length,
    latestHistorialId: latestEntry?.id ?? null,
    historialDescription: latestEntry?.resumenAutomatico ?? latestEntry?.descripcion ?? '',
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications-poll'],
    queryFn: async () => {
      const current = await fetchNotificationData();
      const stored = loadStored();

      const prevSnapshot: NotificationSnapshot = stored?.snapshot ?? {
        pendingReviews: current.pendingReviews,
        pendingEmails: current.pendingEmails,
        latestHistorialId: current.latestHistorialId,
      };

      // Carry over existing notifications (preserve read state)
      const existingNotifications: Notification[] = stored?.notifications ?? [];

      const newNotifications: Notification[] = [];
      const now = new Date().toISOString();

      // New pending video reviews
      if (current.pendingReviews > prevSnapshot.pendingReviews) {
        const delta = current.pendingReviews - prevSnapshot.pendingReviews;
        newNotifications.push({
          id: `review-${now}`,
          type: 'review',
          message: `${delta} __notifications.newReviews__`,
          timestamp: now,
          read: false,
        });
      }

      // New pending email approvals
      if (current.pendingEmails > prevSnapshot.pendingEmails) {
        const delta = current.pendingEmails - prevSnapshot.pendingEmails;
        newNotifications.push({
          id: `email-${now}`,
          type: 'email',
          message: `${delta} __notifications.newEmails__`,
          timestamp: now,
          read: false,
        });
      }

      // New historial activity (different latest ID)
      if (
        current.latestHistorialId !== null &&
        current.latestHistorialId !== prevSnapshot.latestHistorialId &&
        prevSnapshot.latestHistorialId !== null
      ) {
        newNotifications.push({
          id: `activity-${now}`,
          type: 'activity',
          message: current.historialDescription || '__notifications.newActivity__',
          timestamp: now,
          read: false,
        });
      }

      // Merge: new notifications first, keep at most 20 total
      const merged = [...newNotifications, ...existingNotifications].slice(0, 20);

      const nextStored: StoredNotifications = {
        snapshot: {
          pendingReviews: current.pendingReviews,
          pendingEmails: current.pendingEmails,
          latestHistorialId: current.latestHistorialId,
        },
        notifications: merged,
      };

      saveStored(nextStored);
      return nextStored;
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
  });

  const notifications = data?.notifications ?? loadStored()?.notifications ?? [];

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markAllRead = useCallback(() => {
    const stored = loadStored();
    if (!stored) return;

    const updated: StoredNotifications = {
      ...stored,
      notifications: stored.notifications.map((n) => ({ ...n, read: true })),
    };
    saveStored(updated);

    // Update cache directly — no refetch needed, just marking read state
    queryClient.setQueryData(['notifications-poll'], updated);
  }, [queryClient]);

  const markOneRead = useCallback((id: string) => {
    const stored = loadStored();
    if (!stored) return;

    const updated: StoredNotifications = {
      ...stored,
      notifications: stored.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    };
    saveStored(updated);
    queryClient.setQueryData(['notifications-poll'], updated);
  }, [queryClient]);

  return { notifications, unreadCount, markAllRead, markOneRead };
}
