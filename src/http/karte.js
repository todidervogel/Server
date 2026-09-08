import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ersatzkachel } from './kachelbild.js'
import { einfaerben, kennt, STILE } from './kartenstil.js'

/**
 * Die Karte, serverseitig.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/http/server.js            hängt die Adressen ein                    │
 * │  src/http/kachelbild.js        zeichnet den Ersatz, wenn nichts kommt    │
 * │  src/http/kartenstil.js        färbt die Kacheln um, unser eigener Stil  │
 * │  src/domain/places.js          liefert die Betriebe für die Marker       │
 * │  Website-/src/components/MapTiles.jsx   holt die Kacheln von hier        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ── Was hier passiert ─────────────────────────────────────────────────────
 *
 *   GET /api/karte/stil                  welcher Stil, welche Nennung
 *   GET /api/karte/kachel/:z/:x/:y.png   eine Kachel
 *   GET /api/karte/betriebe?…            was in diesem Ausschnitt liegt
 *
 * Die Kacheln laufen bewusst über den eigenen Server und nicht direkt vom
 * Gerät zum Kachelanbieter. Vier Gründe, alle praktisch:
 *
 *   1. **Ein Ausgang.** Die App spricht mit einer einzigen Adresse. Wo der
 *      Netzzugang eng ist, in dieser Entwicklungsumgebung zum Beispiel,
 *      muss nur eine Verbindung erlaubt sein, nicht zwei.
 *   2. **Zwischenspeicher.** Eine Kachel wird einmal geholt und danach von
 *      der Platte bedient. Beim zweiten Blick auf dieselbe Gegend entsteht
 *      kein Netzverkehr mehr, auf dem Handy zählt das doppelt.
 *   3. **Höflichkeit.** Die freien Kachelserver leben von Spenden und
 *      erwarten, dass man sich zu erkennen gibt und nicht dieselbe Kachel
 *      hundertmal holt. Über einen Server ist beides leicht einzuhalten.
 *   4. **Ein Wechsel bleibt eine Zeile.** Wird der Stil getauscht, ändert
 *      sich hier eine Zeile und nichts in App und Website.
 *
 * ── Welche Kacheln ────────────────────────────────────────────────────────
 *
 * `tile.openstreetmap.org`, der **gewöhnliche Standardstil**, der, den man auf
 * openstreetmap.org sieht, wenn man nichts umstellt.
 *
 * Ausdrücklich **nicht** `tile.openstreetmap.de`. Das ist der deutsche Stil:
 * eigene Farben, deutsche Beschriftungen, andere Gewichtung. Wer ihn will,
 * trägt ihn unten als eigene Quelle ein; von selbst kommt er nie.
 *
 * Ausdrücklich auch nicht die Verkehrsansicht, die Bahnlinien und
 * Haltestellen betont.
 *
 * ── Und unser eigener Stil darüber ────────────────────────────────────────
 *
 * Die Kacheln kommen als fertige Bilder. Farbe können wir trotzdem selbst
 * bestimmen: `src/http/kartenstil.js` färbt jede Kachel um, bevor sie
 * ausgeliefert wird, nach ein paar Zahlen, die dort zum Ändern stehen.
 *
 *     KARTE_STIL=ruhig node src/index.js     heller und entsättigt
 *     KARTE_STIL=dunkel node src/index.js    für den Dunkelmodus
 *
 * Voreingestellt ist `roh`, also unverändert. Was damit **nicht** geht,
 * nämlich Straßen und Beschriftungen ändern, und was es dafür bräuchte, steht
 * in docs/KARTE.md.
 *
 * Weltweit ist das ohnehin: Es gibt keine Gegend ohne Kacheln.
 */

const hier = dirname(fileURLToPath(import.meta.url))

/* --- Der Stil -------------------------------------------------------------- */

/**
 * Die Kartenstile.
 *
 * `standard` ist der gewöhnliche OpenStreetMap-Stil, der, den man auf
 * openstreetmap.org sieht, wenn man nichts umstellt. Er ist der Standard hier,
 * weil er so ausdrücklich bestellt wurde: **nicht** die Verkehrs- oder
 * ÖPNV-Ansicht, die Bahnlinien und Haltestellen betont.
 *
 * `voyager` ist heller und entsättigter und kommt dem Bild von Google Maps
 * näher. Er bleibt als Wahl stehen, ohne der Standard zu sein.
 *
 * Umstellen ohne Codeänderung:
 *
 *     KARTE_STIL=voyager node src/index.js
 */
const QUELLEN = {
  standard: {
    name: 'standard',
    quellen: [
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ],
    nennung: '© OpenStreetMap-Mitwirkende',
    maxZoom: 19,
  },
  voyager: {
    name: 'voyager',
    quellen: [
      'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ],
    nennung: '© OpenStreetMap-Mitwirkende, © CARTO',
    maxZoom: 19,
  },
}

const STIL = QUELLEN[process.env.KARTE_QUELLE] ?? QUELLEN.standard

/*
 * Der eigene Stil darüber. Voreingestellt `roh`, also unverändert: Wer nichts
 * einstellt, bekommt die Karte so, wie OpenStreetMap sie zeichnet.
 */
const EIGENER_STIL = kennt(process.env.KARTE_STIL ?? '') ? process.env.KARTE_STIL : 'roh'

/*
 * Wer die Kacheln holt. Beide Anbieter weisen Anfragen ohne Kennung ab, und
 * die Nutzungsordnung von OpenStreetMap verlangt sie ausdrücklich.
 */
const KENNUNG = 'tellerrand/1.0 (+https://github.com/todidervogel/Server)'

/* --- Zwischenspeicher ------------------------------------------------------ */

const HALTBAR_MS = 30 * 24 * 60 * 60 * 1000 /* 30 Tage, Karten ändern sich langsam. */
const HOECHSTZAHL = 20_000 /* etwa 250 MB; darüber fliegt das Älteste raus */

let ordner = resolve(hier, '..', '..', 'data', 'kacheln')
let seitAufraeumen = 0

/** Wo die Kacheln liegen. Setzt src/index.js, wenn die Datenbank woanders steht. */
export function setKachelordner(pfad) {
  ordner = pfad
}

/*
 * Je Quelle **und** je Stil ein eigener Ordner. Sonst läge unter demselben
 * Pfad mal die rohe und mal die eingefärbte Kachel, je nachdem, womit der
 * Server zuletzt lief.
 */
const kachelPfad = (z, x, y) =>
  join(ordner, `${STIL.name}-${EIGENER_STIL}`, String(z), String(x), `${y}.png`)

function ausSpeicher(pfad) {
  if (!existsSync(pfad)) return null
  try {
    const stand = statSync(pfad)
    return { inhalt: readFileSync(pfad), alt: Date.now() - stand.mtimeMs > HALTBAR_MS }
  } catch {
    return null
  }
}

function inSpeicher(pfad, inhalt) {
  try {
    mkdirSync(dirname(pfad), { recursive: true })
    writeFileSync(pfad, inhalt)
  } catch (fehler) {
    /* Volle Platte darf die Karte nicht anhalten, dann eben ohne Speicher. */
    console.warn(`[Karte] Konnte nicht zwischenspeichern: ${fehler.message}`)
  }
  seitAufraeumen += 1
  if (seitAufraeumen > 500) { seitAufraeumen = 0; aufraeumen() }
}

/**
 * Hält den Zwischenspeicher klein.
 *
 * Eine Weltkarte hat mehr Kacheln, als auf jede Platte passen. Gezählt wird
 * deshalb, und was am längsten nicht gebraucht wurde, geht zuerst.
 */
function aufraeumen() {
  try {
    const alle = []
    const durchgehen = (pfad) => {
      for (const eintrag of readdirSync(pfad, { withFileTypes: true })) {
        const voll = join(pfad, eintrag.name)
        if (eintrag.isDirectory()) durchgehen(voll)
        else alle.push({ pfad: voll, alter: statSync(voll).mtimeMs })
      }
    }
    if (!existsSync(ordner)) return
    durchgehen(ordner)
    if (alle.length <= HOECHSTZAHL) return

    alle.sort((a, b) => a.alter - b.alter)
    for (const { pfad } of alle.slice(0, alle.length - HOECHSTZAHL)) rmSync(pfad, { force: true })
    console.log(`[Karte] ${alle.length - HOECHSTZAHL} alte Kacheln weggeräumt.`)
  } catch (fehler) {
    console.warn(`[Karte] Aufräumen fehlgeschlagen: ${fehler.message}`)
  }
}

/* --- Kacheln holen --------------------------------------------------------- */

async function vomAnbieter(z, x, y) {
  let letzterFehler
  for (const vorlage of STIL.quellen) {
    const url = vorlage.replace('{z}', z).replace('{x}', x).replace('{y}', y)
    try {
      const antwort = await fetch(url, {
        headers: { 'user-agent': KENNUNG, accept: 'image/png,image/*' },
        /* Eine Kachel, die zehn Sekunden braucht, ist für eine Karte wertlos. */
        signal: AbortSignal.timeout(10_000),
      })
      if (!antwort.ok) throw new Error(`${antwort.status} ${antwort.statusText}`)
      const inhalt = Buffer.from(await antwort.arrayBuffer())
      /* Manche Anbieter antworten mit einer HTML-Fehlerseite und Status 200. */
      if (inhalt.length < 100 || inhalt[1] !== 0x50) throw new Error('keine PNG-Kachel')
      return inhalt
    } catch (fehler) {
      letzterFehler = fehler
    }
  }
  throw letzterFehler ?? new Error('keine Quelle erreichbar')
}

/**
 * Eine Kachel, aus dem Speicher, vom Anbieter oder selbst gezeichnet.
 *
 * Gibt immer ein Bild zurück. Ein Fehler an dieser Stelle wäre für die
 * Oberfläche nur ein Loch, an dem sie nichts ändern kann.
 */
export async function kachel(z, x, y) {
  const grenze = 2 ** z
  if (!Number.isInteger(z) || z < 0 || z > STIL.maxZoom) return { inhalt: ersatzkachel(), herkunft: 'ersatz' }
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= grenze || y >= grenze) {
    return { inhalt: ersatzkachel(), herkunft: 'ersatz' }
  }

  const pfad = kachelPfad(z, x, y)
  const gespeichert = ausSpeicher(pfad)
  if (gespeichert && !gespeichert.alt) return { inhalt: gespeichert.inhalt, herkunft: 'speicher' }

  try {
    const roh = await vomAnbieter(z, x, y)
    /* Erst einfärben, dann speichern: So wird jede Kachel nur einmal gerechnet. */
    const inhalt = einfaerben(roh, EIGENER_STIL)
    inSpeicher(pfad, inhalt)
    return { inhalt, herkunft: 'anbieter' }
  } catch (fehler) {
    /* Lieber eine alte Kachel als gar keine. */
    if (gespeichert) return { inhalt: gespeichert.inhalt, herkunft: 'speicher-alt' }
    return { inhalt: ersatzkachel(), herkunft: 'ersatz', fehler: fehler.message }
  }
}

/** Was die Oberfläche über den Stil wissen muss. */
export const stil = () => ({
  name: STIL.name,
  eigenerStil: EIGENER_STIL,
  nennung: STIL.nennung,
  maxZoom: STIL.maxZoom,
  kachelGroesse: 256,
  vorlage: '/api/karte/kachel/{z}/{x}/{y}.png',
  /* Damit die Oberfläche weiß, was einstellbar ist. */
  stileVerfuegbar: Object.keys(STILE),
})
