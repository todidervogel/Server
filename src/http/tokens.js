/**
 * Anmeldungen für den HTTP-Teil.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/http/server.js   stellt beim Anmelden ein Merkmal aus               │
 * │  src/http/rpc.js      macht daraus bei jedem Aufruf ein Konto            │
 * │  src/index.js         hängt über setSitzungen() die Datenbank ein        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Diese Datei ist nur die Durchreiche. Wo die Sitzungen wirklich liegen,
 * steht in src/store/sitzungen.js — in der Datenbank, damit ein Neustart
 * niemanden abmeldet.
 *
 * Ohne eingehängte Sitzungsverwaltung — im Rauchtest zum Beispiel — hält sie
 * die Sitzungen im Arbeitsspeicher. Dann gilt: Neustart, alle draußen.
 */
import { randomBytes } from 'node:crypto'

const speicher = new Map()
const DAUER_MS = 1000 * 60 * 60 * 12

const imSpeicher = {
  ausstellen(userId) {
    const token = randomBytes(32).toString('base64url')
    speicher.set(token, { userId, bis: Date.now() + DAUER_MS })
    return token
  },
  nutzerZu(token) {
    const sitzung = speicher.get(token)
    if (!sitzung) return null
    if (sitzung.bis < Date.now()) { speicher.delete(token); return null }
    return sitzung.userId
  },
  widerrufen: (token) => { speicher.delete(token) },
  anzahl: () => speicher.size,
}

let sitzungen = imSpeicher

/** Hängt die Sitzungsverwaltung der Datenbank ein (src/index.js). */
export function setSitzungen(next) {
  sitzungen = next ?? imSpeicher
}

export const issue = (userId) => sitzungen.ausstellen(userId)
export const userIdFor = (token) => (token ? sitzungen.nutzerZu(token) : null)
export const revoke = (token) => { if (token) sitzungen.widerrufen(token) }
export const count = () => sitzungen.anzahl()
