import { deflateSync } from 'node:zlib'

/**
 * Erzeugt Kacheln selbst — für den Fall, dass keine zu bekommen sind.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/http/karte.js   wenn der Kachelserver nicht antwortet               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ── Warum überhaupt ───────────────────────────────────────────────────────
 *
 * Eine Karte, deren Kacheln nicht kommen, sieht im Browser aus wie ein Loch:
 * kaputte Bildsymbole auf weißem Grund, und die Marker schweben im Nichts.
 * Ein selbst gezeichneter, ruhiger Untergrund mit feinem Raster sieht dagegen
 * nach „Karte lädt gleich" aus — die Marker stehen an derselben Stelle, und
 * man kann weiterarbeiten.
 *
 * Ohne Fremdbibliothek: Ein PNG ist eine Signatur, drei Blöcke und je eine
 * Prüfsumme. Die Bildpunkte kommen durch `deflate` aus `node:zlib`, das in
 * Node ohnehin mitgeliefert wird — genau das Format, das ein PNG erwartet.
 */

const GROESSE = 256

/* --- PNG von Hand --------------------------------------------------------- */

const SIGNATUR = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** CRC-32, wie die PNG-Spezifikation ihn vorschreibt (ISO 3309). */
const CRC_TABELLE = (() => {
  const tabelle = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabelle[n] = c
  }
  return tabelle
})()

function crc32(daten) {
  let c = -1
  for (const byte of daten) c = CRC_TABELLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

/** Ein PNG-Block: Länge, Kennung, Inhalt, Prüfsumme. */
function block(kennung, inhalt) {
  const laenge = Buffer.alloc(4)
  laenge.writeUInt32BE(inhalt.length)
  const koerper = Buffer.concat([Buffer.from(kennung, 'ascii'), inhalt])
  const pruefsumme = Buffer.alloc(4)
  pruefsumme.writeUInt32BE(crc32(koerper))
  return Buffer.concat([laenge, koerper, pruefsumme])
}

/**
 * Baut aus Bildpunkten ein PNG.
 * @param punkte  RGB, drei Bytes je Punkt, zeilenweise
 */
function alsPng(punkte, breite = GROESSE, hoehe = GROESSE) {
  const kopf = Buffer.alloc(13)
  kopf.writeUInt32BE(breite, 0)
  kopf.writeUInt32BE(hoehe, 4)
  kopf[8] = 8   /* 8 Bit je Kanal */
  kopf[9] = 2   /* Farbtyp 2: RGB ohne Durchsichtigkeit */

  /* Jede Zeile beginnt mit einem Filterbyte — 0 heißt „unverändert". */
  const mitFilter = Buffer.alloc(hoehe * (1 + breite * 3))
  for (let y = 0; y < hoehe; y += 1) {
    punkte.copy(mitFilter, y * (1 + breite * 3) + 1, y * breite * 3, (y + 1) * breite * 3)
  }

  return Buffer.concat([
    SIGNATUR,
    block('IHDR', kopf),
    block('IDAT', deflateSync(mitFilter, { level: 9 })),
    block('IEND', Buffer.alloc(0)),
  ])
}

/* --- Der Ersatzuntergrund -------------------------------------------------- */

/* Dieselben Töne wie in der Karte: heller Grund, kaum sichtbares Raster. */
const GRUND = [0xf5, 0xf3, 0xef]
const RASTER = [0xe6, 0xe2, 0xdb]

function zeichnen() {
  const punkte = Buffer.alloc(GROESSE * GROESSE * 3)
  for (let y = 0; y < GROESSE; y += 1) {
    for (let x = 0; x < GROESSE; x += 1) {
      const linie = x % 64 === 0 || y % 64 === 0
      const farbe = linie ? RASTER : GRUND
      const i = (y * GROESSE + x) * 3
      punkte[i] = farbe[0]
      punkte[i + 1] = farbe[1]
      punkte[i + 2] = farbe[2]
    }
  }
  return alsPng(punkte)
}

/*
 * Einmal zeichnen, immer wieder ausliefern: Die Kachel sieht überall gleich
 * aus, es gibt nichts zu variieren.
 */
let fertig = null

/** Der Ersatz für eine Kachel, die nicht zu bekommen war. */
export function ersatzkachel() {
  fertig ??= zeichnen()
  return fertig
}
