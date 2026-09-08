import { db, insert, nextId, update } from './store.js'

/**
 * Benachrichtigungen.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/domain/calls.js    notifications.list / unreadCount / markAllRead   │
 * │  src/domain/videos.js   meldet Freigabe und Ablehnung                    │
 * │  src/domain/social.js   meldet neue Folgende                             │
 * │  src/domain/reviews.js  meldet die Antwort eines Betriebs                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const nowIso = () => new Date().toISOString().slice(0, 19)

export function list(userId) {
  return db().notifications.filter((n) => n.userId === userId)
}

export function unreadCount(userId) {
  return db().notifications.filter((n) => n.userId === userId && n.unread).length
}

export function create(data) {
  const row = { id: nextId('notifications', 'n'), createdAt: nowIso(), unread: true, ...data }
  insert('notifications', row)
  return row
}

export function markAllRead(userId) {
  update((d) => ({
    notifications: d.notifications.map((n) => (n.userId === userId ? { ...n, unread: false } : n)),
  }))
  return true
}
