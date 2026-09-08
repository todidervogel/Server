import { pngLesen, pngSchreiben } from './kachelbild.js'

/**
 * Der Kartenstil, und zwar unser eigener.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/http/karte.js       färbt jede geholte Kachel damit ein             │
 * │  src/http/kachelbild.js  liest und schreibt die PNG-Dateien              │
 * │  docs/KARTE.md           erklärt, was hier geht und was nicht            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ── Worum es geht ─────────────────────────────────────────────────────────
 *
 * Die Kacheln kommen als fertige Bilder von OpenStreetMap. Im **Standardstil**
 * und ausdrücklich nicht im deutschen Stil von openstreetmap.de: Der ist eine
 * eigene Darstellung mit anderen Farben und deutschen Beschriftungen. Welche
 * Adresse gilt, steht in `karte.js`.
 *
 * Fertige Bilder heißt: Wir können nicht bestimmen, welche Straße wie dick
 * gezeichnet wird. Was wir bestimmen können, ist die Farbe. Und das reicht
 * erstaunlich weit, denn der Unterschied zwischen der Karte von OpenStreetMap
 * und der von Google ist zum größten Teil Farbe: entsättigter, heller,
 * weniger Kontrast.
 *
 * ── Wie man den Stil ändert ───────────────────────────────────────────────
 *
 * Die Zahlen unten. Mehr nicht. Ein neuer Stil ist ein neuer Eintrag in
 * `STILE`, danach:
 *
 *     KARTE_STIL=meiner node src/index.js
 *
 * Die Kacheln liegen je Stil getrennt im Zwischenspeicher, ein Wechsel wirft
 * also nichts weg.
 *
 * ── Was hier nicht geht ───────────────────────────────────────────────────
 *
 * Beschriftungen entfernen, Straßen umfärben, Hausnummern ausblenden. Dafür
 * bräuchte es die Rohdaten statt der Bilder: eine PostgreSQL-Datenbank mit
 * PostGIS, osm2pgsql, ein Kartenblatt und einen Renderer. Das ist ein eigenes
 * Vorhaben, siehe docs/KARTE.md. Bis dahin ist Farbe das, was geht, und es
 * kostet nichts.
 */

/**
 * Ein Stil ist eine Handvoll Zahlen.
 *
 *   helligkeit   1 lässt alles, wie es ist. Über 1 heller.
 *   saettigung   1 unverändert, 0 grau, über 1 kräftiger.
 *   kontrast     1 unverändert. Unter 1 flacher, das wirkt ruhiger.
 *   umkehren     true dreht hell und dunkel, für eine dunkle Karte.
 *   tonung       [r, g, b] Anteil, der über alles gelegt wird, 0 bis 1.
 *   staerke      wie stark die Tönung wirkt, 0 bis 1.
 */
export const STILE = {
  /* Wie er von OpenStreetMap kommt. Nichts wird angefasst. */
  roh: null,

  /*
   * Ruhiger. Etwas heller, deutlich entsättigt, weniger Kontrast, ein Hauch
   * Warmton. Das ist der Stil, der dem Bild von Google Maps am nächsten kommt,
   * ohne dass wir deren Kacheln benutzen (was ohnehin nicht erlaubt wäre).
   */
  ruhig: {
    helligkeit: 1.06,
    saettigung: 0.62,
    kontrast: 0.92,
    umkehren: false,
    tonung: [1.0, 0.98, 0.94],
    staerke: 0.14,
  },

  /*
   * Dunkel. Umkehren allein ergäbe eine Karte mit orangefarbenem Wasser: Aus
   * Blau wird beim Umkehren Gelb. Deshalb danach kräftig entsättigen und blau
   * tönen, dann bleibt Wasser dunkelblau und Grünflächen bleiben grünlich.
   */
  dunkel: {
    helligkeit: 0.92,
    saettigung: 0.45,
    kontrast: 0.9,
    umkehren: true,
    tonung: [0.16, 0.20, 0.30],
    staerke: 0.5,
  },
}

/** Gibt es diesen Stil? */
export const kennt = (name) => Object.hasOwn(STILE, name)

const klemmen = (wert) => (wert < 0 ? 0 : wert > 255 ? 255 : wert | 0)

/**
 * Färbt eine Kachel um.
 *
 * Gibt bei `roh`, bei unbekanntem Stil oder wenn sich das Bild nicht lesen
 * lässt die **unveränderte** Datei zurück. Eine Karte, die manchmal anders
 * aussieht, wäre schlimmer als eine, die immer gleich aussieht.
 *
 * @param datei  die PNG-Kachel, wie sie vom Anbieter kam
 * @param name   Schlüssel aus STILE
 */
export function einfaerben(datei, name) {
  const stil = STILE[name]
  if (!stil) return datei

  const bild = pngLesen(datei)
  if (!bild) return datei

  const { punkte } = bild
  const { helligkeit, saettigung, kontrast, umkehren, tonung, staerke } = stil

  for (let i = 0; i < punkte.length; i += 3) {
    let r = punkte[i]
    let g = punkte[i + 1]
    let b = punkte[i + 2]

    if (umkehren) { r = 255 - r; g = 255 - g; b = 255 - b }

    /* Grauwert nach der üblichen Gewichtung: Grün wiegt am schwersten. */
    const grau = 0.299 * r + 0.587 * g + 0.114 * b
    r = grau + (r - grau) * saettigung
    g = grau + (g - grau) * saettigung
    b = grau + (b - grau) * saettigung

    r *= helligkeit; g *= helligkeit; b *= helligkeit

    /* Kontrast um die Bildmitte, nicht um Null. Sonst wird alles dunkler. */
    r = 128 + (r - 128) * kontrast
    g = 128 + (g - 128) * kontrast
    b = 128 + (b - 128) * kontrast

    if (staerke > 0) {
      r = r * (1 - staerke) + 255 * tonung[0] * staerke
      g = g * (1 - staerke) + 255 * tonung[1] * staerke
      b = b * (1 - staerke) + 255 * tonung[2] * staerke
    }

    punkte[i] = klemmen(r)
    punkte[i + 1] = klemmen(g)
    punkte[i + 2] = klemmen(b)
  }

  return pngSchreiben(punkte, bild.breite, bild.hoehe)
}
