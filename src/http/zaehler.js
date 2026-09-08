/**
 * Zählt mit, was der Server tut.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/http/server.js   zählt jede Anfrage, liefert GET /api/status        │
 * │  .github/workflows/server-ngrok.yml   zeigt es im Lauf jede halbe Minute │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ── Wozu ──────────────────────────────────────────────────────────────────
 *
 * Ein Server, der über einen Workflow läuft, ist eine Blackbox: Man startet
 * ihn, bekommt eine Adresse, und danach steht im Protokoll eine halbe Stunde
 * lang nichts. Ob überhaupt jemand etwas abruft, ob die Karte Kacheln holt,
 * ob sich jemand angemeldet hat, sieht man nicht.
 *
 * Diese Zähler machen das sichtbar. Sie kosten nichts: ein paar Zahlen im
 * Arbeitsspeicher, hochgezählt in der Anfrageschleife.
 *
 * Sie sind absichtlich **nicht** dauerhaft. Beim Neustart fangen sie bei null
 * an, und das ist richtig so: Sie beschreiben diesen Lauf, nicht die
 * Geschichte des Projekts. Was dauerhaft ist, steht in der Datenbank.
 */

const start = Date.now()

const zaehler = {
  gesamt: 0,
  karte: 0,
  bilder: 0,
  rpc: 0,
  anmeldung: 0,
  sonstiges: 0,
  fehler: 0,
}

let letzteAnfrage = null

/** Ordnet einen Pfad einer Spalte zu. Grob genug, um lesbar zu bleiben. */
function bereich(pfad) {
  if (pfad.startsWith('/api/karte/')) return 'karte'
  if (pfad.startsWith('/api/bild/')) return 'bilder'
  if (pfad === '/api/rpc') return 'rpc'
  if (pfad.startsWith('/api/auth/')) return 'anmeldung'
  return 'sonstiges'
}

/**
 * Eine Anfrage ist durch.
 * @param status  der HTTP-Status, damit Fehler getrennt gezählt werden
 */
export function zaehlen(pfad, status) {
  zaehler.gesamt += 1
  zaehler[bereich(pfad)] += 1
  if (status >= 400) zaehler.fehler += 1
  letzteAnfrage = Date.now()
}

/** Der Stand für GET /api/status. */
export function stand({ sitzungen = 0, betriebe = 0 } = {}) {
  const jetzt = Date.now()
  return {
    ok: true,
    seit: new Date(start).toISOString(),
    laufzeitSek: Math.round((jetzt - start) / 1000),
    anfragen: { ...zaehler },
    letzteAnfrageVorSek: letzteAnfrage ? Math.round((jetzt - letzteAnfrage) / 1000) : null,
    sitzungen,
    betriebe,
    speicherMb: Math.round(process.memoryUsage().rss / 1048576),
  }
}

/**
 * Eine Zeile für das Protokoll des Workflows.
 *
 * Bewusst kurz und in fester Breite: Im Protokoll stehen diese Zeilen
 * untereinander, und dann liest man Veränderungen an den Zahlen ab, ohne
 * jede Zeile ganz zu lesen.
 */
export function zeile(zusatz = {}) {
  const s = stand(zusatz)
  const dauer = `${String(Math.floor(s.laufzeitSek / 60)).padStart(3)} min`
  const zuletzt = s.letzteAnfrageVorSek === null
    ? 'noch nichts'
    : `vor ${s.letzteAnfrageVorSek}s`
  return `${dauer} | Anfragen ${String(s.anfragen.gesamt).padStart(5)}`
    + ` (Karte ${s.anfragen.karte}, RPC ${s.anfragen.rpc}, Bilder ${s.anfragen.bilder},`
    + ` Anmeldung ${s.anfragen.anmeldung}, Fehler ${s.anfragen.fehler})`
    + ` | Sitzungen ${s.sitzungen} | zuletzt ${zuletzt} | ${s.speicherMb} MB`
}
