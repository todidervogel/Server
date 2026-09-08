/**
 * Betriebe, die es nicht mehr gibt.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/data/seed.js        wirft geschlossene Betriebe aus dem Bestand     │
 * │  tools/osm-import.mjs    trennt den Hinweis schon beim Import ab         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ── Das Problem ───────────────────────────────────────────────────────────
 *
 * OpenStreetMap kennt kein Feld „geschlossen". Wer einen Betrieb nicht löschen
 * will — weil das Gebäude ja noch steht —, schreibt es in den Namen:
 *
 *     Lempert (dauerhaft geschlossen)
 *     Café Stollhofen (vorrübergehend Gesschlossen)
 *
 * Auf einer Betriebsseite steht das dann als Name. Es sieht nach einem Fehler
 * aus, und schlimmer: Es gibt eine Seite für einen Betrieb, den es nicht mehr
 * gibt. Niemand soll dort hinfahren.
 *
 * Deshalb wird hier getrennt: Der Name ist der Name, der Zustand ist ein Feld.
 * Wer **dauerhaft** geschlossen hat, kommt gar nicht erst in den Bestand.
 * Wer vorübergehend zu hat, bleibt drin und trägt einen Hinweis — sonst
 * verschwände jedes Lokal, das gerade Betriebsferien macht.
 *
 * Der Tippfehler „Gesschlossen" steht wirklich so in den Daten. Deshalb wird
 * großzügig gesucht statt auf richtige Schreibweise gehofft.
 */

/** Ein Klammerzusatz, der von einer Schließung spricht. */
export const ZUSATZ =
  /\s*[([]\s*[^)\]]*?(geschlossen|gesschlossen|closed|cerrado|permanentemente|dauerhaft|vorüber|vorrüber|renovier|umbau)[^)\]]*[)\]]\s*/i

/** Klingt der Zusatz nach „für immer"? */
const DAUERHAFT = /dauerhaft|permanent|closed_permanently|cerrado permanentemente/i

/**
 * Trennt den Namen vom Zustand.
 *
 * @returns { name, status } — status ist 'active', 'closed_reported'
 *          (vorübergehend) oder 'closed' (dauerhaft)
 */
export function nameUndZustand(roherName) {
  const name = String(roherName ?? '').trim()
  const treffer = ZUSATZ.exec(name)
  if (!treffer) return { name, status: 'active' }

  const sauber = name.replace(ZUSATZ, ' ').replace(/\s+/g, ' ').trim()
  return {
    name: sauber || name,
    status: DAUERHAFT.test(treffer[0]) ? 'closed' : 'closed_reported',
  }
}

/**
 * Räumt eine Liste importierter Betriebe auf.
 *
 * Nachträglich, nicht nur beim Import: `orte.js` kann aus einem Lauf stammen,
 * der diese Regel noch nicht kannte. Ein Bestand, der sich beim Laden selbst
 * prüft, ist einer weniger, bei dem man an den richtigen Zeitpunkt denken muss.
 */
export function nurBestehende(betriebe) {
  return betriebe
    .map((betrieb) => {
      const { name, status } = nameUndZustand(betrieb.name)
      /* Ein bereits gesetzter Zustand gilt weiter — er kommt aus Meldungen. */
      return { ...betrieb, name, status: status === 'active' ? betrieb.status : status }
    })
    .filter((betrieb) => betrieb.status !== 'closed')
}
