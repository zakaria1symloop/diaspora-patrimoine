'use client';
// NOT-032 — displaying the screen of an object (a dossier, on any of its tabs) marks read its unread notifications.
import { useEffect } from 'react';
import { apiCall } from '@/lib/auth-client';
import { useOptionalSpace } from './SpaceContext';

export function MarkRead({ entityType, entityId }: { entityType: 'Dossier' | 'Lead' | 'Conversation'; entityId: string }) {
  const setUnread = useOptionalSpace()?.setUnread;
  useEffect(() => {
    void apiCall<{ unread: number }>('/client/notifications/read', { method: 'POST', body: { entityType, entityId }, retryOnAuth: true }).then((r) => {
      if (r.ok) setUnread?.(r.data.unread);
    });
  }, [entityType, entityId, setUnread]);
  return null;
}
