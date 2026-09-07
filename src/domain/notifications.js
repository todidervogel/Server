import { db, insert, nextId, update } from './store.js'

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
