import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { initialDatabase } from './data/seed.js'
import { createSqliteStore } from './store/sqlite-store.js'
import { setSitzungen } from './http/tokens.js'
import { setKachelordner } from './http/karte.js'
import { createApiServer } from './http/server.js'

/**
 * Der Einstiegspunkt: Datenbank öffnen, Server starten, sauber beenden.
 *
 * ┌─ Was von hier aus zusammengesetzt wird ──────────────────────────────────┐
 * │  src/data/seed.js           der Bestand beim allerersten Start           │
 * │  src/store/sqlite-store.js  die Datenbank (Tabellen, Passwörter, …)      │
 * │  src/http/tokens.js         Anmeldungen — hier eingehängt                │
 * │  src/http/server.js         die HTTP-Schnittstelle                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 *   node src/index.js                       Standard: data/tellerrand.db
 *   PORT=4000 node src/index.js             anderer Port
 *   DATA_FILE=/pfad/zur.db node src/index.js
 */

/*
 * `node:sqlite` ist in Node 22 noch als „experimentell“ gekennzeichnet und
 * meldet das bei jedem Start. Die Meldung sagt nichts über diesen Server aus
 * und steht sonst vor jeder Startausgabe. Alle anderen Warnungen bleiben.
 */
const warnungen = process.listeners('warning')
process.removeAllListeners('warning')
process.on('warning', (warnung) => {
  if (warnung.name === 'ExperimentalWarning' && /SQLite/i.test(warnung.message)) return
  for (const alt of warnungen) alt(warnung)
})

const hier = dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT ?? 4000)
const HOST = process.env.HOST ?? '0.0.0.0'
const DATEI = process.env.DATA_FILE ?? resolve(hier, '..', 'data', 'tellerrand.db')
/* Die Kacheln liegen neben der Datenbank — ein Ordner, ein Backup. */
const KACHELN = process.env.TILE_DIR ?? resolve(dirname(DATEI), 'kacheln')

const store = createSqliteStore(DATEI, initialDatabase())
setSitzungen(store.sitzungen)
setKachelordner(KACHELN)

const server = createApiServer({ store })

server.listen(PORT, HOST, () => {
  const bestand = store.get()
  console.log(`API läuft auf http://localhost:${PORT}`)
  console.log(`Datenbank     ${DATEI}`)
  console.log(`Kacheln       ${KACHELN}`)
  console.log(`Bestand       ${bestand.places.length} Betriebe, ${bestand.users.length} Konten, `
    + `${bestand.videos.length} Videos, ${bestand.reviews.length} Bewertungen`)
  console.log('')
  console.log('Zum Ausprobieren:')
  console.log(`  curl http://localhost:${PORT}/api/health`)
  console.log(`  curl "http://localhost:${PORT}/api/places?lat=48.53&lng=8.08&radiusKm=5"`)
  console.log('')
  console.log('Damit die Website darauf zugreift:')
  console.log(`  VITE_API=http://localhost:${PORT} npm run dev     (im Website-Repo)`)

  /*
   * Ein Platzhalterpasswort auf einem Server, der über ngrok im Netz steht,
   * ist kein Schönheitsfehler. Solange es da ist, wird beim Start daran
   * erinnert — leise wegzulassen wäre das Gegenteil von hilfreich.
   */
  if (store.zugaenge.pruefen('a1', 'admin')) {
    console.log('')
    console.log('  ⚠  Der Verwaltungszugang „topic" hat noch das Platzhalterpasswort.')
    console.log('     Ändern über Einstellungen → Passwort, bevor der Server öffentlich läuft.')
  }
})

/* Sauber beenden: Verbindungen zu, Datenbank zu. */
let beendet = false
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (beendet) return
    beendet = true
    console.log('\nServer wird beendet.')
    server.close(() => {
      store.schliessen()
      process.exit(0)
    })
  })
}
