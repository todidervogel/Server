import { randomBytes } from 'node:crypto'

/**
 * Anmeldungen, in der Datenbank, nicht im Arbeitsspeicher.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/index.js       hängt sie beim Start ein                             │
 * │  src/http/tokens.js reicht sie an den HTTP-Teil weiter                   │
 * │  src/http/rpc.js    macht aus einem Merkmal ein Konto                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Vorher lagen die Anmeldungen in einer Map im Arbeitsspeicher. Jeder
 * Neustart, und über ngrok startet der Server öfter, als einem lieb ist,
 * hat alle Angemeldeten hinausgeworfen, mitten in dem, was sie gerade taten.
 *
 * Jetzt steht jede Sitzung in der Datenbank und übersteht den Neustart.
 *
 * Das Merkmal ist ein Zufallswert aus 32 Bytes (256 Bit), erzeugt mit dem
 * Zufallsgenerator des Betriebssystems. Erraten lässt sich das nicht.
 * Gespeichert wird es hier im Klartext, anders als bei einem Passwort geht
 * das nicht anders, weil der Server bei jeder Anfrage danach suchen muss.
 * Dafür läuft es ab und lässt sich einzeln widerrufen.
 */

const GUELTIG_TAGE = 30

const jetzt = () => Date.now()
const iso = (ms) => new Date(ms).toISOString()

export function createSitzungen(datenbank) {
  datenbank.exec(`CREATE TABLE IF NOT EXISTS "sitzungen" (
  "token"     TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "erstellt"  TEXT NOT NULL,
  "gesehen"   TEXT NOT NULL,
  "laeuftAb"  TEXT NOT NULL
)`)
  datenbank.exec('CREATE INDEX IF NOT EXISTS "idx_sitzungen_userId" ON "sitzungen" ("userId")')

  const anlegen = datenbank.prepare(
    'INSERT INTO "sitzungen" ("token","userId","erstellt","gesehen","laeuftAb") VALUES (?,?,?,?,?)')
  const suchen = datenbank.prepare('SELECT * FROM "sitzungen" WHERE "token" = ?')
  const gesehen = datenbank.prepare('UPDATE "sitzungen" SET "gesehen" = ? WHERE "token" = ?')
  const loeschen = datenbank.prepare('DELETE FROM "sitzungen" WHERE "token" = ?')
  const aufraeumen = datenbank.prepare('DELETE FROM "sitzungen" WHERE "laeuftAb" < ?')

  /* Abgelaufenes einmal beim Start wegräumen. */
  aufraeumen.run(iso(jetzt()))

  return {
    ausstellen(userId) {
      const token = randomBytes(32).toString('base64url')
      const start = jetzt()
      anlegen.run(token, userId, iso(start), iso(start), iso(start + GUELTIG_TAGE * 86400_000))
      return token
    },

    nutzerZu(token) {
      if (!token) return null
      const zeile = suchen.get(token)
      if (!zeile) return null
      if (Date.parse(zeile.laeuftAb) < jetzt()) { loeschen.run(token); return null }
      /* Wann zuletzt benutzt, nützlich, wenn jemand fragt, wer angemeldet ist. */
      gesehen.run(iso(jetzt()), token)
      return zeile.userId
    },

    widerrufen: (token) => { if (token) loeschen.run(token) },
    alleVon: (userId) => datenbank.prepare('DELETE FROM "sitzungen" WHERE "userId" = ?').run(userId),
    anzahl: () => datenbank.prepare('SELECT COUNT(*) AS n FROM "sitzungen"').get().n,
  }
}
