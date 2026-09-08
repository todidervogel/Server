import { deflateSync, inflateSync } from 'node:zlib'

/**
 * Erzeugt Kacheln selbst, für den Fall, dass keine zu bekommen sind.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/http/karte.js       wenn der Kachelserver nicht antwortet           │
 * │  src/http/kartenstil.js  liest und schreibt Kacheln, um sie einzufärben  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ── Warum überhaupt ───────────────────────────────────────────────────────
 *
 * Eine Karte, deren Kacheln nicht kommen, sieht im Browser aus wie ein Loch:
 * kaputte Bildsymbole auf weißem Grund, und die Marker schweben im Nichts.
 * Ein selbst gezeichneter, ruhiger Untergrund mit feinem Raster sieht dagegen
 * nach „Karte lädt gleich" aus, die Marker stehen an derselben Stelle, und
 * man kann weiterarbeiten.
 *
 * Ohne Fremdbibliothek: Ein PNG ist eine Signatur, drei Blöcke und je eine
 * Prüfsumme. Die Bildpunkte kommen durch `deflate` aus `node:zlib`, das in
 * Node ohnehin mitgeliefert wird, genau das Format, das ein PNG erwartet.
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

  /* Jede Zeile beginnt mit einem Filterbyte, 0 heißt „unverändert". */
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

/* --- PNG lesen ------------------------------------------------------------- */

/**
 * Zerlegt ein PNG in Bildpunkte.
 *
 * Gebraucht, seit der Server Kacheln nicht nur ausliefert, sondern auch
 * umfärben kann (src/http/kartenstil.js). Ohne Fremdbibliothek, aus demselben
 * Grund wie überall hier: `npm install` soll nichts nachladen.
 *
 * Unterstützt wird, was Kachelserver wirklich liefern: 8 Bit je Kanal, ohne
 * Zeilensprung, in Graustufen, Palette, RGB oder RGBA. Alles andere gibt
 * `null` zurück, und der Aufrufer liefert die Kachel dann unverändert aus.
 * Ein falsch entschlüsseltes Bild wäre schlimmer als ein unbearbeitetes.
 *
 * @returns { breite, hoehe, punkte } mit drei Bytes je Punkt, oder null
 */
export function pngLesen(datei) {
  try {
    if (datei.length < 8 || datei.readUInt32BE(0) !== 0x89504e47) return null

    let pos = 8
    let kopf = null
    let palette = null
    const teile = []

    while (pos + 8 <= datei.length) {
      const laenge = datei.readUInt32BE(pos)
      const kennung = datei.toString('ascii', pos + 4, pos + 8)
      const inhalt = datei.subarray(pos + 8, pos + 8 + laenge)
      pos += 12 + laenge

      if (kennung === 'IHDR') {
        kopf = {
          breite: inhalt.readUInt32BE(0),
          hoehe: inhalt.readUInt32BE(4),
          tiefe: inhalt[8],
          farbtyp: inhalt[9],
          zeilensprung: inhalt[12],
        }
      } else if (kennung === 'PLTE') palette = Buffer.from(inhalt)
      else if (kennung === 'IDAT') teile.push(inhalt)
      else if (kennung === 'IEND') break
    }

    if (!kopf || kopf.tiefe !== 8 || kopf.zeilensprung !== 0) return null

    const kanaele = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[kopf.farbtyp]
    if (!kanaele) return null
    if (kopf.farbtyp === 3 && !palette) return null

    const roh = inflateSync(Buffer.concat(teile))
    const zeilenbreite = kopf.breite * kanaele
    if (roh.length < kopf.hoehe * (zeilenbreite + 1)) return null

    /* Filter rückgängig machen, wie es die Spezifikation beschreibt. */
    const flach = Buffer.alloc(kopf.hoehe * zeilenbreite)
    let quelle = 0
    for (let y = 0; y < kopf.hoehe; y += 1) {
      const filter = roh[quelle]
      quelle += 1
      const zeile = flach.subarray(y * zeilenbreite, (y + 1) * zeilenbreite)
      const oben = y > 0 ? flach.subarray((y - 1) * zeilenbreite, y * zeilenbreite) : null

      for (let x = 0; x < zeilenbreite; x += 1) {
        const wert = roh[quelle + x]
        const links = x >= kanaele ? zeile[x - kanaele] : 0
        const drueber = oben ? oben[x] : 0
        const schraeg = oben && x >= kanaele ? oben[x - kanaele] : 0

        let ergebnis
        if (filter === 0) ergebnis = wert
        else if (filter === 1) ergebnis = wert + links
        else if (filter === 2) ergebnis = wert + drueber
        else if (filter === 3) ergebnis = wert + ((links + drueber) >> 1)
        else if (filter === 4) ergebnis = wert + paeth(links, drueber, schraeg)
        else return null
        zeile[x] = ergebnis & 0xff
      }
      quelle += zeilenbreite
    }

    /* Auf drei Bytes je Punkt bringen, egal wie es ankam. */
    const punkte = Buffer.alloc(kopf.breite * kopf.hoehe * 3)
    for (let i = 0, ziel = 0; i < kopf.breite * kopf.hoehe; i += 1, ziel += 3) {
      const q = i * kanaele
      if (kopf.farbtyp === 3) {
        const eintrag = flach[q] * 3
        punkte[ziel] = palette[eintrag]
        punkte[ziel + 1] = palette[eintrag + 1]
        punkte[ziel + 2] = palette[eintrag + 2]
      } else if (kopf.farbtyp === 0 || kopf.farbtyp === 4) {
        punkte[ziel] = flach[q]
        punkte[ziel + 1] = flach[q]
        punkte[ziel + 2] = flach[q]
      } else {
        punkte[ziel] = flach[q]
        punkte[ziel + 1] = flach[q + 1]
        punkte[ziel + 2] = flach[q + 2]
      }
    }

    return { breite: kopf.breite, hoehe: kopf.hoehe, punkte }
  } catch {
    /* Ein kaputtes Bild ist kein Grund, die Karte anzuhalten. */
    return null
  }
}

/** Der Paeth-Vorhersagefilter aus der PNG-Spezifikation. */
function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/** Aus Bildpunkten wieder ein PNG. Gegenstück zu `pngLesen`. */
export function pngSchreiben(punkte, breite, hoehe) {
  return alsPng(punkte, breite, hoehe)
}
