import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSqliteStore } from '../src/store/sqlite-store.js'
import { setSitzungen } from '../src/http/tokens.js'
import { createApiServer } from '../src/http/server.js'
import { initialDatabase } from '../src/data/seed.js'

/**
 * Prüft das, wonach ausdrücklich gefragt wurde: Bleiben die Daten nach einem
 * Neustart des Servers da?
 *
 * ┌─ Was geprüft wird ───────────────────────────────────────────────────────┐
 * │  src/store/sqlite-store.js   Tabellen, Schreiben, Wiederlesen            │
 * │  src/store/zugaenge.js       Passwörter gehasht, nicht lesbar            │
 * │  src/store/sitzungen.js      Anmeldung übersteht den Neustart            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Der Neustart wird echt nachgestellt: Server zu, Store zu, alles neu aus
 * derselben Datei. Ein Test, der nur denselben Store weiterbenutzt, würde
 * genau das nicht prüfen.
 */

const ordner = mkdtempSync(join(tmpdir(), 'tellerrand-'))
const datei = join(ordner, 'test.db')

const ergebnisse = []
const pruefe = (name, bedingung, detail = '') => ergebnisse.push([!!bedingung, name, bedingung ? '' : detail])

/** Startet einen Server auf derselben Datei — wie nach einem Neustart. */
async function starten() {
  const store = createSqliteStore(datei, initialDatabase())
  setSitzungen(store.sitzungen)
  const server = createApiServer({ store, log: () => {} })
  await new Promise((fertig) => server.listen(0, '127.0.0.1', fertig))
  const basis = `http://127.0.0.1:${server.address().port}`

  const api = async (pfad, { method = 'GET', body, token } = {}) => {
    const antwort = await fetch(`${basis}${pfad}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: antwort.status, body: await antwort.json() }
  }

  return {
    store,
    api,
    rpc: (method, args = [], token) => api('/api/rpc', { method: 'POST', body: { method, args }, token }),
    stoppen: () => new Promise((fertig) => server.close(() => { store.schliessen(); fertig() })),
  }
}

/* --- Erster Start --------------------------------------------------------- */
let s = await starten()
pruefe('Neue Datenbank wird als neu erkannt', s.store.neu)
pruefe('Der Ausgangsbestand ist drin', s.store.get().places.length > 100,
  `${s.store.get().places.length} Betriebe`)

const anmelden = async (kennung, passwort) =>
  (await s.api('/api/auth/login', { method: 'POST', body: { identifier: kennung, password: passwort } }))

const admin = await anmelden('topic', 'admin')
pruefe('Anmeldung mit dem bestellten Zugang', !!admin.body.token)
pruefe('Falsches Passwort wird abgewiesen', (await anmelden('topic', 'falsch')).status === 401)

/* Ein neues Konto anlegen — genau das, was ein echter Mensch als Erstes tut. */
const neu = await s.api('/api/auth/register', {
  method: 'POST',
  body: { email: 'anna@beispiel.de', username: 'anna', name: 'Anna', password: 'Geheim123!' },
})
pruefe('Registrierung legt ein Konto an', neu.status === 201 && !!neu.body.token)
const annaId = neu.body.user?.id

/* Etwas tun, das gespeichert werden muss. */
const einBetrieb = s.store.get().places[0].id
await s.rpc('social.toggleSave', [null, 'place', einBetrieb], neu.body.token)
await s.rpc('search.remember', ['pizza'], neu.body.token)

const adminToken = admin.body.token
const annaToken = neu.body.token

await s.stoppen()

/* --- Neustart ------------------------------------------------------------- */
s = await starten()
pruefe('Nach dem Neustart ist die Datenbank nicht mehr neu', !s.store.neu)
pruefe('Die Betriebe sind noch da', s.store.get().places.length > 100)
pruefe('Das neue Konto ist noch da', s.store.get().users.some((u) => u.id === annaId))
pruefe('Der Merkzettel ist noch da',
  s.store.get().saves.some((g) => g.userId === annaId && g.targetId === einBetrieb))
pruefe('Der Suchverlauf ist noch da', s.store.get().searchHistory.includes('pizza'))

pruefe('Das Passwort gilt nach dem Neustart',
  (await anmelden('anna@beispiel.de', 'Geheim123!')).status === 200)
pruefe('Die Anmeldung übersteht den Neustart',
  (await s.api('/api/auth/me', { token: annaToken })).status === 200)

/* --- Passwörter ----------------------------------------------------------- */
/*
 * Alle Dateien im Ordner, nicht nur die Datenbank: Im WAL-Modus stehen frische
 * Schreibvorgänge zuerst in `test.db-wal`. Nur die Hauptdatei zu prüfen hätte
 * genau das übersehen, was man am ehesten übersieht.
 */
const alleBytes = Buffer.concat(readdirSync(ordner).map((name) => readFileSync(join(ordner, name))))
pruefe('Kein Passwort steht im Klartext in einer der Dateien',
  !alleBytes.includes(Buffer.from('Geheim123!')) && !alleBytes.includes(Buffer.from('12345aA?')))
pruefe('Zu jedem Konto gibt es genau einen Zugang',
  s.store.zugaenge.anzahl() === s.store.get().users.length,
  `${s.store.zugaenge.anzahl()} Zugänge, ${s.store.get().users.length} Konten`)
pruefe('Im Nutzerobjekt steht kein Passwortfeld',
  s.store.get().users.every((u) => !('password' in u)))

/* Gleiches Passwort, verschiedene Konten — verschiedene Hashes (eigenes Salz). */
s.store.zugaenge.setzen('a1', 'DasselbeWort1!')
const hashA = s.store.datenbank.prepare('SELECT hash FROM zugaenge WHERE userId = ?').get('a1').hash
s.store.zugaenge.setzen(annaId, 'DasselbeWort1!')
const hashB = s.store.datenbank.prepare('SELECT hash FROM zugaenge WHERE userId = ?').get(annaId).hash
pruefe('Gleiches Passwort ergibt verschiedene Hashes', hashA !== hashB)

/* --- Abmelden und Zurücksetzen -------------------------------------------- */
await s.api('/api/auth/logout', { method: 'POST', token: annaToken })
pruefe('Nach dem Abmelden gilt die Anmeldung nicht mehr',
  (await s.api('/api/auth/me', { token: annaToken })).status === 401)

const zurueck = await s.api('/api/reset', { method: 'POST', token: adminToken })
pruefe('Zurücksetzen darf nur die Verwaltung',
  (await s.api('/api/reset', { method: 'POST' })).status === 403)
pruefe('Zurücksetzen räumt neue Konten weg',
  zurueck.status === 200 && !s.store.get().users.some((u) => u.id === annaId))

await s.stoppen()
rmSync(ordner, { recursive: true, force: true })

/* --- Ergebnis ------------------------------------------------------------- */
const daneben = ergebnisse.filter(([ok]) => !ok)
ergebnisse.forEach(([ok, name, detail]) => console.log(`${ok ? '  ok  ' : 'FEHLER'} ${name}${detail ? ` — ${detail}` : ''}`))
console.log(`\n${ergebnisse.length - daneben.length} von ${ergebnisse.length} bestanden.`)
if (daneben.length) process.exitCode = 1
