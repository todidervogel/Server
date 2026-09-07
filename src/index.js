import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { initialDatabase } from './data/seed.js'
import { createFileStore } from './store/file-store.js'
import { createApiServer } from './http/server.js'

const here = dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT ?? 4000)
const HOST = process.env.HOST ?? '0.0.0.0'
const DATA = process.env.DATA_FILE ?? resolve(here, '..', 'data', 'db.json')

const store = createFileStore(DATA, initialDatabase())
const server = createApiServer({ store, seedData: initialDatabase() })

server.listen(PORT, HOST, () => {
  console.log(`API läuft auf http://localhost:${PORT}`)
  console.log(`Daten in       ${DATA}`)
  console.log('')
  console.log('Zum Ausprobieren:')
  console.log(`  curl http://localhost:${PORT}/api/health`)
  console.log(`  curl http://localhost:${PORT}/api/g/trattoria-bella/speisekarte`)
  console.log('')
  console.log('Damit die Website darauf zugreift:')
  console.log(`  VITE_API=http://localhost:${PORT} npm run dev     (im Website-Repo)`)
})

/* Sauber beenden, damit die Datenbankdatei nicht halb geschrieben bleibt. */
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\nServer wird beendet.')
    server.close(() => process.exit(0))
  })
}
