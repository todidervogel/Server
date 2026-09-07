import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createMemoryStore } from '../domain/store.js'

/**
 * Datenhaltung in einer JSON-Datei.
 *
 * Für einen internen Test genau richtig: nachvollziehbar, ohne
 * Datenbankinstallation, jederzeit im Editor zu öffnen. Für den echten
 * Betrieb wird das durch PostgreSQL ersetzt — die Fachlogik darüber bleibt.
 */
const VERSION = 3

export function createFileStore(path, initial) {
  mkdirSync(dirname(path), { recursive: true })

  let data = initial
  if (existsSync(path)) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'))
      if (raw?.version === VERSION && raw.data) data = raw.data
      else console.warn(`[Daten] ${path} hat eine andere Fassung — beginne von vorn.`)
    } catch (error) {
      console.warn(`[Daten] ${path} ließ sich nicht lesen (${error.message}) — beginne von vorn.`)
    }
  }

  /* Erst daneben schreiben, dann umbenennen: So bleibt bei einem Absturz
     mitten im Schreiben die alte Datei heil. */
  const persist = (next) => {
    const temp = `${path}.tmp`
    writeFileSync(temp, JSON.stringify({ version: VERSION, data: next }, null, 2))
    renameSync(temp, path)
  }

  const store = createMemoryStore(data, persist)
  persist(data)

  return {
    ...store,
    /** Setzt alles auf den Auslieferungsstand zurück. */
    reset: () => store.replace(structuredClone(initial)),
  }
}
