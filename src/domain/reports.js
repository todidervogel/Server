import { db, insert, nextId, patch } from './store.js'
import * as admin from './admin.js'
import * as places from './places.js'

const today = () => new Date().toISOString().slice(0, 10)

const REASONS = ['spam', 'offensive', 'fake', 'wrong_info', 'venue_closed', 'wrong_place', 'other']
const TARGETS = ['video', 'review', 'profile', 'place']

export function list({ status } = {}) {
  const data = db()
  return status ? data.reports.filter((r) => r.status === status) : data.reports
}

/**
 * Mehrfachmeldungen zum selben Ziel werden gezählt, nicht vervielfacht.
 * Ab drei unabhängigen Meldungen „dauerhaft geschlossen" bekommt ein Betrieb
 * den Status closed_reported und eine Aufgabe bei der Moderation (8.7).
 */
export function create({ targetType, targetId, reason, note, reporterId, label }) {
  if (!TARGETS.includes(targetType)) return { ok: false, error: 'Unbekannter Meldetyp.' }
  const safeReason = REASONS.includes(reason) ? reason : 'other'

  const existing = db().reports.find(
    (r) => r.targetType === targetType && r.targetId === targetId && r.status === 'open',
  )

  if (existing) {
    patch('reports', existing.id, (r) => ({ count: r.count + 1 }))
    if (targetType === 'place' && safeReason === 'venue_closed' && existing.count + 1 >= 3) {
      places.setStatus(targetId, 'closed_reported')
    }
    return { ok: true, report: existing }
  }

  const row = {
    id: nextId('reports', 'm'),
    createdAt: today(),
    reporterId,
    targetType,
    targetId,
    label: String(label ?? targetId).slice(0, 160),
    reason: safeReason,
    note: String(note ?? '').slice(0, 1000),
    count: 1,
    status: 'open',
    handledBy: null,
  }
  insert('reports', row)
  return { ok: true, report: row }
}

export function resolve(id, status, adminId, who = 'system') {
  patch('reports', id, { status, handledBy: adminId ?? null })
  admin.log(status === 'resolved' ? 'Meldung bearbeitet' : 'Meldung abgewiesen', id, '', who)
  return true
}
