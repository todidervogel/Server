import { db, patch, remove, update } from './store.js'
import { publicUser } from './derive.js'
import * as admin from './admin.js'

const nowIso = () => new Date().toISOString().slice(0, 19)

export function byUsername(username, viewerId) {
  const data = db()
  const user = data.users.find((u) => u.username === username)
  return user ? publicUser(user, data, viewerId) : null
}

export function byId(id, viewerId) {
  const data = db()
  const user = data.users.find((u) => u.id === id)
  return user ? publicUser(user, data, viewerId) : null
}

/** Nur Felder, die jemand an sich selbst ändern darf. */
const EDITABLE = ['name', 'bio', 'website', 'private', 'radius', 'notify', 'username']

export function save(id, changes) {
  const allowed = Object.fromEntries(Object.entries(changes).filter(([key]) => EDITABLE.includes(key)))

  /* Benutzernamen gibt es nur einmal. */
  if (allowed.username) {
    const taken = db().users.some((u) => u.id !== id && u.username.toLowerCase() === String(allowed.username).toLowerCase())
    if (taken) return { ok: false, error: 'Dieser Benutzername ist schon vergeben.' }
  }

  patch('users', id, allowed)
  return { ok: true }
}

export function setStatus(id, status, who = 'system') {
  patch('users', id, { status })
  admin.log(
    status === 'banned' ? 'Nutzer gesperrt' : status === 'warned' ? 'Nutzer verwarnt' : 'Sperre aufgehoben',
    id, '', who,
  )
  return true
}

/** Auskunft nach Art. 15/20 DSGVO — alles, was zu diesem Konto gehört. */
export function exportData(id) {
  const data = db()
  const user = data.users.find((u) => u.id === id)
  if (!user) return null
  const { password, ...profile } = user
  return {
    exportiertAm: nowIso(),
    profil: profile,
    videos: data.videos.filter((v) => v.authorId === id),
    bewertungen: data.reviews.filter((r) => r.authorId === id),
    gefaelltMir: data.likes.filter((l) => l.userId === id),
    gespeichert: data.saves.filter((s) => s.userId === id),
    folgt: data.follows.filter((f) => f.followerId === id),
    folgen: data.follows.filter((f) => f.followingId === id),
  }
}

/**
 * Löschung nach Art. 17: Profil und Videos verschwinden, Bewertungen bleiben
 * anonym erhalten — sonst verfälschen sich die Durchschnittswerte. Das ist
 * zulässig, muss aber in der Datenschutzerklärung stehen (Konzept 10).
 */
export function deleteAccount(id) {
  remove('videos', (v) => v.authorId === id)
  remove('likes', (l) => l.userId === id)
  remove('saves', (s) => s.userId === id)
  remove('follows', (f) => f.followerId === id || f.followingId === id)
  remove('notifications', (n) => n.userId === id)
  update((d) => ({
    reviews: d.reviews.map((r) => (r.authorId === id ? { ...r, authorId: null, anonymized: true } : r)),
    users: d.users.filter((u) => u.id !== id),
  }))
  return true
}
