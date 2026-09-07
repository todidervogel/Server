import { db, insert, nextId, patch } from './store.js'
import { publicUser } from './derive.js'

/**
 * Anmeldung.
 *
 * Die Passwörter stehen im Klartext neben den Konten. Das ist für einen
 * Prototyp mit erfundenen Zugängen vertretbar und für alles andere nicht —
 * beim Umzug auf einen echten Dienst übernimmt der die Anmeldung samt
 * Hashing, und diese Datei fällt weg.
 */

const today = () => new Date().toISOString().slice(0, 10)

export function findByLogin(identifier) {
  const value = String(identifier ?? '').trim().toLowerCase()
  return db().users.find(
    (u) => u.email.toLowerCase() === value || u.username.toLowerCase() === value.replace(/^@/, ''),
  ) ?? null
}

export function login(identifier, password) {
  const user = findByLogin(identifier)
  if (!user) return { ok: false, error: 'unknownAccount' }
  if (user.password !== password) return { ok: false, error: 'wrongPassword' }
  if (user.status === 'banned') return { ok: false, error: 'blocked' }
  return { ok: true, user: publicUser(user), mustChangePassword: !!user.mustChangePassword }
}

/** Prüft, ob E-Mail und Benutzername noch frei sind. */
export function canRegister({ email, username }) {
  const taken = db().users.find(
    (u) => u.email.toLowerCase() === String(email).toLowerCase()
      || u.username.toLowerCase() === String(username).toLowerCase(),
  )
  return taken ? { ok: false, error: 'accountExists' } : { ok: true }
}

export function register({ email, username, name, phone, password }) {
  const free = canRegister({ email, username })
  if (!free.ok) return free

  const user = {
    id: nextId('users', 'u'),
    username: String(username).trim().toLowerCase(),
    name: String(name || username).trim(),
    email: String(email).trim(),
    phone: String(phone ?? '').trim(),
    password,
    role: 'user',
    /* Profile sind standardmäßig privat (Konzept 8.6). */
    private: true,
    joined: today(),
    bio: '',
    radius: 5,
    status: 'active',
    reportCount: 0,
    notify: { follows: true, likes: true, replies: true, moderation: true },
  }
  insert('users', user)
  return { ok: true, user: publicUser(user) }
}

export function changePassword(id, password) {
  patch('users', id, { password, mustChangePassword: false })
  return { ok: true }
}

/** Das vollständige Konto inklusive Rolle — nur für die Rechteprüfung. */
export function accountOf(id) {
  const user = db().users.find((u) => u.id === id)
  if (!user) return null
  const { password, ...rest } = user
  return rest
}
