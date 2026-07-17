import { ownerFetch } from './ownerApi';

export interface OwnerNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  booking_id: string | null;
  created_at: string;
}

export async function listNotifications() {
  return ownerFetch<{ data: OwnerNotification[]; unread_count: number }>('/api/owner/notifications');
}

export async function markNotificationRead(id: string) {
  return ownerFetch('/api/owner/notifications', { method: 'PATCH', body: { id } });
}

export async function markAllNotificationsRead() {
  return ownerFetch('/api/owner/notifications', { method: 'PATCH', body: { mark_all: true } });
}
