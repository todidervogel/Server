import { db, insert, nextId, patch, pruefePasswort, setzePasswort } from './store.js'
import { publicUser } from './derive.js'
import { BENUTZERNAME } from './users.js'

/**
 * Anmeldung, Registrierung, Passwort.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/http/server.js   /api/auth/login, /register, /password, /me         │
 * │  src/http/rpc.js      macht aus einer Sitzung ein Konto (accountOf)      │
 * │  src/domain/calls.js  prüft darüber Rollen und Rechte                    │
 * │  src/store/zugaenge.js   hält die Passwörter — hier steht keines         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Diese Datei sieht nie ein gespeichertes Passwort. Sie fragt den Store
 * „stimmt das?" und bekommt ja oder nein. Wie geprüft wird — auf dem Server
 * mit scrypt, im Browser im Alleinbetrieb ohne — entscheidet der Wirt.
 */

const today = () => new Date().toISOString().slice(0, 10)

/** Anmelden geht mit E-Mail **oder** Benutzernamen, mit oder ohne @. */
export function findByLogin(identifier) {
  const value = String(identifier ?? '').trim().toLowerCase()
  return db().users.find(
    (u) => u.email.toLowerCase() === value || u.username.toLowerCase() === value.replace(/^@/, ''),
  ) ?? null
}

export function login(identifier, password) {
  const user = findByLogin(identifier)
  /*
   * „Konto unbekannt" und „Passwort falsch" werden getrennt gemeldet, weil
   * die Oberfläche daraus unterschiedliche Hilfen macht. Das verrät, ob es
   * eine Adresse gibt — bei einem öffentlichen Dienst wäre das ein Fehler.
   * Vor dem ersten echten Betrieb wird daraus eine einzige Meldung.
   */
  if (!user) return { ok: false, error: 'unknownAccount' }
  if (!pruefePasswort(user.id, password)) return { ok: false, error: 'wrongPassword' }
  if (user.status === 'banned') return { ok: false, error: 'blocked' }
  return { ok: true, user: publicUser(user), mustChangePassword: !!user.mustChangePassword }
}

/** Prüft, ob der Benutzername die Form hat und E-Mail wie Name noch frei sind. */
export function canRegister({ email, username }) {
  if (!BENUTZERNAME.test(String(username ?? '').trim().toLowerCase())) {
    return { ok: false, error: 'invalidUsername' }
  }
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
    role: 'user',
    /* Profile sind standardmäßig privat (Konzept 8.6). */
    private: true,
    joined: today(),
    bio: '',
    website: '',
    radius: 5,
    status: 'active',
    reportCount: 0,
    /*
     * Im MVP wird noch nichts verschickt — es gibt keinen Mailversand und
     * keinen SMS-Anbieter. Die Verifizierung lässt sich deshalb überspringen
     * (siehe `verifizierungUeberspringen`), und die Anwendung merkt sich das,
     * damit sie später gezielt nachfragen kann.
     */
    emailVerified: false,
    phoneVerified: false,
    verificationSkipped: false,
    notify: { follows: true, likes: true, replies: true, moderation: true },
  }
  insert('users', user)
  setzePasswort(user.id, password)
  return { ok: true, user: publicUser(user) }
}

export function changePassword(id, password) {
  setzePasswort(id, password)
  patch('users', id, { mustChangePassword: false })
  return { ok: true }
}

/**
 * Verifizierung überspringen (MVP).
 *
 * Das Konto bleibt nutzbar, der offene Punkt bleibt sichtbar. Sobald es
 * Mail- und SMS-Versand gibt, lässt sich daran ablesen, wer nachträglich
 * gefragt werden muss — genau dafür wird es festgehalten statt vergessen.
 */
export function skipVerification(id) {
  patch('users', id, { verificationSkipped: true })
  return { ok: true }
}

/** Bestätigt einen Kanal. Den Code prüft, wer ihn verschickt hat. */
export function confirmVerification(id, kanal) {
  if (kanal !== 'email' && kanal !== 'phone') return { ok: false, error: 'unknownChannel' }
  patch('users', id, { [kanal === 'email' ? 'emailVerified' : 'phoneVerified']: true })
  return { ok: true }
}

/**
 * Das vollständige Konto inklusive Rolle — für die Rechteprüfung in
 * src/domain/calls.js und für /api/auth/me.
 *
 * Das `password` fliegt heraus, auch wenn es hier gar nicht mehr stehen
 * sollte: Im Alleinbetrieb der Website führt der einfache Store es weiter,
 * und diese Antwort geht über das Netz.
 */
export function accountOf(id) {
  const user = db().users.find((u) => u.id === id)
  if (!user) return null
  const { password, ...ohnePasswort } = user
  return ohnePasswort
}
