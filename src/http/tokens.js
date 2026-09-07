import { randomUUID } from 'node:crypto'

/**
 * Sitzungen im Arbeitsspeicher.
 *
 * Bewusst einfach: ein zufälliges Merkmal je Anmeldung, gültig bis zum
 * Neustart oder bis zur Abmeldung. Kein JWT, keine Verlängerung — beim Umzug
 * auf einen echten Anmeldedienst fällt diese Datei ohnehin weg.
 */
const sessions = new Map()
const LIFETIME_MS = 1000 * 60 * 60 * 12

export function issue(userId) {
  const token = randomUUID()
  sessions.set(token, { userId, until: Date.now() + LIFETIME_MS })
  return token
}

export function userIdFor(token) {
  const session = sessions.get(token)
  if (!session) return null
  if (session.until < Date.now()) { sessions.delete(token); return null }
  return session.userId
}

export function revoke(token) {
  sessions.delete(token)
}

export function count() {
  return sessions.size
}
