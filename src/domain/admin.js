import { db, insert, nextId, patch } from './store.js'
import { decoratePlace, publicUser } from './derive.js'

/**
 * Verwaltung: Übersicht, Einladungen, Vorschläge, Protokoll.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/domain/calls.js       admin.* — alles nur mit Rolle „admin"         │
 * │  src/domain/videos.js      ruft log() bei jeder Freigabe                 │
 * │  src/domain/users.js       ruft log() bei Sperre und Verwarnung          │
 * │  src/domain/reports.js     ruft log() beim Bearbeiten einer Meldung      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * `log()` ist der Grund, warum diese Datei von überall gerufen wird: Jede
 * Entscheidung eines Menschen über fremde Inhalte muss nachvollziehbar sein —
 * wer, wann, was, warum. Ohne das ist Moderation Willkür.
 */

const today = () => new Date().toISOString().slice(0, 10)
const nowIso = () => new Date().toISOString().slice(0, 19)

/** Protokoll — Begründungspflicht nach DSA (Konzept 10). */
export function log(action, object, note = '', who = 'system') {
  insert('auditLog', { id: nextId('auditLog', 'lg'), at: nowIso(), admin: who, action, object, note })
}

export function overview() {
  const data = db()
  return {
    queue: data.videos.filter((v) => v.status === 'pending_review').length,
    reports: data.reports.filter((r) => r.status === 'open').length,
    claims: data.places.filter((p) => p.claimStatus === 'pending').length,
    places: data.places.length,
    users: data.users.filter((u) => u.role === 'user').length,
    videos: data.videos.length,
    log: data.auditLog.slice(0, 5),
  }
}

export function users() {
  const data = db()
  return data.users.filter((u) => u.role === 'user').map((u) => publicUser(u, data))
}

export function places() {
  const data = db()
  return data.places.map((p) => decoratePlace(p, { data }))
}

export function invites() {
  const data = db()
  return data.invites.map((i) => ({ ...i, placeName: data.places.find((p) => p.id === i.placeId)?.name ?? null }))
}

export function createInvite(placeId, email, who = 'system') {
  const row = { id: nextId('invites', 'i'), placeId: placeId ?? null, email, sentAt: today(), status: 'sent' }
  insert('invites', row)
  log('Einladung verschickt', email, '', who)
  return row
}

export function resendInvite(id) {
  patch('invites', id, { sentAt: today(), status: 'sent' })
  return true
}

export function suggestions() {
  return db().suggestions
}

export function createSuggestion(data) {
  const row = {
    id: nextId('suggestions', 's'),
    createdAt: today(),
    status: 'open',
    ...data,
  }
  insert('suggestions', row)
  return row
}

export function resolveSuggestion(id, status, who = 'system') {
  patch('suggestions', id, { status })
  log(status === 'created' ? 'Betrieb angelegt' : 'Vorschlag abgelehnt', id, '', who)
  return true
}

export function auditLog() {
  return db().auditLog
}
