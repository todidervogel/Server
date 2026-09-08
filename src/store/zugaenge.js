import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Passwörter, gehasht, gesalzen, getrennt vom Konto.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/index.js            hängt sie beim Start in den Store               │
 * │  src/domain/store.js     ruft pruefen()/setzen() über den Store          │
 * │  src/domain/auth.js      fragt „stimmt das Passwort?", mehr nicht        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ── Warum eine eigene Tabelle ─────────────────────────────────────────────
 *
 * Weil ein Feld, das es im Nutzerobjekt nicht gibt, auch nicht versehentlich
 * in einer Antwort landen kann. Vorher stand das Passwort im Klartext neben
 * dem Konto, und an drei Stellen im Code musste daran gedacht werden, es
 * wieder herauszunehmen (`const { password, ...rest }`). Eine davon zu
 * vergessen hätte gereicht.
 *
 * Jetzt liegen die Zugangsdaten in `zugaenge`. Wer ein Konto liest, bekommt
 * kein Passwort, es steht dort nicht.
 *
 * ── Das Verfahren ─────────────────────────────────────────────────────────
 *
 * scrypt, wie es im RFC 7914 steht und in `node:crypto` mitgeliefert wird.
 * Absichtlich langsam und speicherhungrig: Wer die Datenbank stiehlt, kann
 * nicht Millionen Kandidaten pro Sekunde durchprobieren.
 *
 *   N = 16384   Rechenaufwand (etwa 60 ms je Prüfung)
 *   r = 8       Blockgröße
 *   p = 1       ohne Parallelität
 *
 * Jeder Zugang hat sein eigenes Salz. Zwei Konten mit demselben Passwort
 * haben deshalb verschiedene Hashes, eine vorberechnete Tabelle nützt
 * nichts.
 *
 * Verglichen wird mit `timingSafeEqual`. Ein gewöhnlicher Vergleich bricht
 * beim ersten falschen Byte ab; aus der Dauer ließe sich der Hash Byte für
 * Byte erraten.
 *
 * Das Verfahren steht in der Zeile mit dabei. Wird es später gewechselt,
 * lassen sich alte Zugänge weiter prüfen und beim nächsten Anmelden
 * stillschweigend umstellen.
 */

const VERFAHREN = 'scrypt-16384-8-1'
const OPTIONEN = { N: 16384, r: 8, p: 1 }
const LAENGE = 64

const hashen = (klartext, salz) =>
  scryptSync(String(klartext), salz, LAENGE, OPTIONEN).toString('hex')

/**
 * @param datenbank  offene SQLite-Verbindung aus src/store/sqlite-store.js
 */
export function createZugaenge(datenbank) {
  datenbank.exec(`CREATE TABLE IF NOT EXISTS "zugaenge" (
  "userId"    TEXT PRIMARY KEY,
  "verfahren" TEXT NOT NULL,
  "salz"      TEXT NOT NULL,
  "hash"      TEXT NOT NULL,
  "gesetztAm" TEXT NOT NULL
)`)

  const lesen = datenbank.prepare('SELECT * FROM "zugaenge" WHERE "userId" = ?')
  const schreiben = datenbank.prepare(
    `INSERT OR REPLACE INTO "zugaenge" ("userId", "verfahren", "salz", "hash", "gesetztAm")
     VALUES (?, ?, ?, ?, ?)`)
  const entfernen = datenbank.prepare('DELETE FROM "zugaenge" WHERE "userId" = ?')

  function setzen(userId, klartext) {
    const salz = randomBytes(16).toString('hex')
    schreiben.run(userId, VERFAHREN, salz, hashen(klartext, salz), new Date().toISOString())
    return true
  }

  function pruefen(userId, klartext) {
    const zeile = lesen.get(userId)
    if (!zeile) return false
    if (zeile.verfahren !== VERFAHREN) return false

    const erwartet = Buffer.from(zeile.hash, 'hex')
    const bekommen = Buffer.from(hashen(klartext, zeile.salz), 'hex')
    if (erwartet.length !== bekommen.length) return false
    return timingSafeEqual(erwartet, bekommen)
  }

  return {
    pruefen,
    setzen,
    entfernen: (userId) => { entfernen.run(userId); return true },
    hat: (userId) => !!lesen.get(userId),
    anzahl: () => datenbank.prepare('SELECT COUNT(*) AS n FROM "zugaenge"').get().n,
  }
}
