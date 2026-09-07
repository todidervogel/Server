/**
 * Holt echte Betriebe aus OpenStreetMap und schreibt sie als Beispieldaten.
 *
 *   node tools/osm-import.mjs                     alle Gegenden
 *   node tools/osm-import.mjs --gegend oberkirch  nur eine
 *   node tools/osm-import.mjs --max 80            weniger je Gegend
 *
 * Warum OpenStreetMap und nicht Google Maps: Die Daten von Google dürfen laut
 * Nutzungsbedingungen nicht übernommen werden, und ohne Bezahlkonto kommt man
 * ohnehin nicht heran. OSM liefert für diese Gegenden dieselben Betriebe, ist
 * frei nutzbar (ODbL, Namensnennung genügt) und war im Konzept von Anfang an
 * als Quelle vorgesehen.
 *
 * Läuft nicht in jeder Umgebung: Wo der Netzzugang Overpass nicht durchlässt,
 * übernimmt der Workflow „Testdaten holen" diese Arbeit auf einem Runner.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }

/* Mittelpunkt und Umkreis, genau wie bestellt. */
const GEGENDEN = [
  { key: 'alcossebre', name: 'Alcossebre', land: 'ES', lat: 40.2408, lng: 0.2706, km: 25 },
  { key: 'rheinmuenster', name: 'Rheinmünster', land: 'DE', lat: 48.7686, lng: 8.0511, km: 30 },
  { key: 'oberkirch', name: 'Oberkirch', land: 'DE', lat: 48.5333, lng: 8.0833, km: 30 },
]

/* Mehrere Spiegel: Ist einer überlastet, übernimmt der nächste. */
const SPIEGEL = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.openstreetmap.fr/api/interpreter',
]

const MAX = Number(flag('--max') ?? 120)
const nurGegend = flag('--gegend')

/* --- Overpass ------------------------------------------------------------- */

/*
 * Die Reihenfolge in der Ausgabezeile ist nicht beliebig: Erst wie
 * ausführlich (`tags`), dann welche Geometrie (`center`). Andersherum
 * antwortet Overpass mit „406 Not Acceptable“ — was wie ein Problem mit den
 * Kopfzeilen aussieht, aber ein Syntaxfehler ist.
 */
const abfrage = ({ lat, lng, km }) => `
[out:json][timeout:90];
(
  nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream|biergarten)$"](around:${km * 1000},${lat},${lng});
  nwr["shop"~"^(bakery|butcher|deli)$"](around:${km * 1000},${lat},${lng});
);
out tags center;`

/*
 * Overpass erwartet, dass man sich zu erkennen gibt, und weist Anfragen ohne
 * eigene Kennung ab. Node schickt von sich aus gar keine.
 */
const KENNUNG = 'tellerrand-mvp/1.0 (Testdaten-Import; https://github.com/todidervogel/Server)'

const warte = (ms) => new Promise((fertig) => setTimeout(fertig, ms))

/**
 * Holt eine Gegend — mit Geduld.
 *
 * Overpass ist ein Dienst, den Freiwillige bezahlen. Er sagt regelmäßig „zu
 * viele Anfragen“, besonders von GitHub-Runnern, deren Adressen sich viele
 * teilen. Ein einziger Versuch je Spiegel reicht deshalb nicht: Es wird
 * reihum probiert, mit wachsender Pause dazwischen.
 */
async function hole(gegend, { versuche = 4 } = {}) {
  let letzterFehler

  for (let runde = 0; runde < versuche; runde += 1) {
    for (const url of SPIEGEL) {
      try {
        const antwort = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
            'user-agent': KENNUNG,
          },
          body: new URLSearchParams({ data: abfrage(gegend) }),
          /*
           * Ohne Zeitlimit wartet `fetch` ewig. Ein Spiegel, der die
           * Verbindung annimmt und dann nichts mehr sagt, hält damit den
           * ganzen Lauf an — beim zweiten Versuch stand der Ablauf 25 Minuten
           * im selben Schritt, bis ich ihn abgebrochen habe. Overpass selbst
           * bekommt 90 Sekunden; nach 120 ist hier Schluss.
           */
          signal: AbortSignal.timeout(120_000),
        })

        if (antwort.status === 429 || antwort.status === 504) {
          throw new Error(`${antwort.status} — überlastet`)
        }
        if (!antwort.ok) {
          /* Bei 400 verrät Overpass im Text, was an der Abfrage nicht stimmt. */
          const text = (await antwort.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          throw new Error(`${antwort.status} ${antwort.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`)
        }

        const json = await antwort.json()
        return json.elements ?? []
      } catch (fehler) {
        letzterFehler = fehler
        console.warn(`  ${new URL(url).host}: ${fehler.message}`)
      }
    }

    if (runde < versuche - 1) {
      const pause = 15 * 2 ** runde
      console.log(`  … ${pause} Sekunden warten und noch einmal versuchen`)
      await warte(pause * 1000)
    }
  }

  throw letzterFehler
}

/* --- Übersetzung OSM → unser Datenmodell ---------------------------------- */

const KATEGORIE = {
  restaurant: 'restaurant', cafe: 'cafe', fast_food: 'imbiss', bar: 'bar',
  pub: 'bar', ice_cream: 'cafe', biergarten: 'bar',
  bakery: 'baeckerei', butcher: 'sonstiges', deli: 'sonstiges',
}

/* OSM schreibt Küchen englisch und mit Semikolon getrennt. */
const KUECHE = {
  italian: 'Italienisch', pizza: 'Pizza', german: 'Deutsch', regional: 'Regional',
  spanish: 'Spanisch', tapas: 'Tapas', mediterranean: 'Mediterran', seafood: 'Fisch',
  fish: 'Fisch', greek: 'Griechisch', turkish: 'Türkisch', kebab: 'Döner',
  asian: 'Asiatisch', chinese: 'Chinesisch', japanese: 'Japanisch', sushi: 'Sushi',
  thai: 'Thailändisch', vietnamese: 'Vietnamesisch', indian: 'Indisch',
  burger: 'Burger', steak_house: 'Steak', barbecue: 'Grill', french: 'Französisch',
  coffee_shop: 'Café', cake: 'Kuchen', ice_cream: 'Eis', bakery: 'Bäckerei',
  sandwich: 'Sandwich', international: 'International', vegan: 'Vegan',
  vegetarian: 'Vegetarisch', portuguese: 'Portugiesisch', paella: 'Paella',
  breakfast: 'Frühstück', pasta: 'Pasta', chicken: 'Hähnchen',
}

const kuechen = (tags) =>
  String(tags.cuisine ?? '').split(';').map((k) => KUECHE[k.trim()]).filter(Boolean)

/**
 * Was wird hier serviert? OSM sagt es selten direkt, aber die Küche verrät
 * genug für den ersten Blick — und genau darum ging es bei der Angebotszeile.
 */
function angebot(tags, kategorie) {
  const gefunden = new Set()
  const kueche = String(tags.cuisine ?? '').toLowerCase()
  const hat = (...w) => w.some((x) => kueche.includes(x))

  if (tags['diet:vegan'] === 'yes' || tags['diet:vegan'] === 'only') gefunden.add('vegan')
  if (tags['diet:vegetarian'] === 'yes' || tags['diet:vegetarian'] === 'only') gefunden.add('vegetarisch')
  if (tags['diet:gluten_free'] === 'yes') gefunden.add('glutenfrei')

  if (hat('seafood', 'fish', 'sushi', 'paella')) { gefunden.add('fisch'); gefunden.add('meeresfruechte') }
  if (hat('steak', 'barbecue', 'burger', 'kebab', 'chicken', 'grill')) gefunden.add('fleisch')
  if (hat('cake', 'ice_cream', 'dessert') || kategorie === 'baeckerei') gefunden.add('suesses')
  if (hat('vegan')) gefunden.add('vegan')
  if (hat('vegetarian')) gefunden.add('vegetarisch')

  if (kategorie === 'bar') gefunden.add('getraenke')
  if (kategorie === 'cafe') { gefunden.add('getraenke'); gefunden.add('suesses') }

  /* Ein Restaurant ohne jede Angabe: Fleisch und Vegetarisch sind die sichere Annahme. */
  if (!gefunden.size) { gefunden.add('fleisch'); gefunden.add('vegetarisch') }
  return [...gefunden]
}

/*
 * Öffnungszeiten als Minuten seit Mitternacht, wie im Datenmodell. OSM kann
 * `opening_hours` beliebig kompliziert schreiben; hier wird nur die einfache,
 * häufigste Form gelesen. Alles andere bleibt leer — lieber keine Zeiten als
 * falsche.
 */
const TAGE = { mo: 'mon', tu: 'tue', we: 'wed', th: 'thu', fr: 'fri', sa: 'sat', su: 'sun' }
const REIHE = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function tageListe(text) {
  const raus = []
  for (const stueck of text.split(',')) {
    const spanne = stueck.trim().toLowerCase().match(/^([a-z]{2})-([a-z]{2})$/)
    if (spanne) {
      const a = REIHE.indexOf(TAGE[spanne[1]])
      const b = REIHE.indexOf(TAGE[spanne[2]])
      if (a < 0 || b < 0) continue
      for (let i = a; ; i = (i + 1) % 7) { raus.push(REIHE[i]); if (i === b) break }
    } else {
      const eins = TAGE[stueck.trim().toLowerCase()]
      if (eins) raus.push(eins)
    }
  }
  return raus
}

function oeffnungszeiten(text) {
  if (!text) return null
  const hours = {}
  for (const teil of String(text).split(';')) {
    const treffer = teil.trim().match(/^([A-Za-z,\-]+)\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/)
    if (!treffer) continue
    const [, tageText, h1, m1, h2, m2] = treffer
    const von = Number(h1) * 60 + Number(m1)
    let bis = Number(h2) * 60 + Number(m2)
    if (bis <= von) bis += 24 * 60 /* über Mitternacht */
    for (const tag of tageListe(tageText)) (hours[tag] ??= []).push([von, bis])
  }
  return Object.keys(hours).length ? hours : null
}

const kuerzel = (text) =>
  String(text).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

const PREIS = { restaurant: '€€', bar: '€€', cafe: '€', imbiss: '€', baeckerei: '€', sonstiges: '€' }

const kategorieName = (k) => ({
  restaurant: 'Restaurant', cafe: 'Café', imbiss: 'Imbiss',
  bar: 'Bar', baeckerei: 'Bäckerei', sonstiges: 'Sonstiges',
}[k])

function umbauen(element, gegend, vergeben) {
  const tags = element.tags ?? {}
  if (!tags.name) return null
  const lat = element.lat ?? element.center?.lat
  const lng = element.lon ?? element.center?.lon
  if (lat == null || lng == null) return null

  const kategorie = KATEGORIE[tags.amenity] ?? KATEGORIE[tags.shop] ?? 'sonstiges'
  const kuechenListe = kuechen(tags)

  let slug = kuerzel(tags.name)
  if (!slug) return null
  if (vergeben.has(slug)) slug = `${slug}-${kuerzel(tags['addr:city'] ?? gegend.key)}`.slice(0, 70)
  if (vergeben.has(slug)) return null
  vergeben.add(slug)

  return {
    id: `osm-${element.type[0]}${element.id}`,
    slug,
    name: tags.name,
    osmId: `${element.type}/${element.id}`,
    cuisine: kuechenListe[0] ?? kategorieName(kategorie),
    tags: kuechenListe.length ? kuechenListe : [kategorieName(kategorie)],
    price: PREIS[kategorie],
    category: kategorie,
    serving: angebot(tags, kategorie),
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ')
      || tags['addr:place'] || '',
    zip: tags['addr:postcode'] ?? '',
    city: tags['addr:city'] ?? gegend.name,
    country: gegend.land,
    region: gegend.key,
    phone: tags.phone ?? tags['contact:phone'] ?? '',
    website: (tags.website ?? tags['contact:website'] ?? '').replace(/^https?:\/\//, ''),
    hours: oeffnungszeiten(tags.opening_hours),
    verified: false,
    claimStatus: 'unclaimed',
    claimedBy: null,
    status: 'active',
    hasCover: false,
  }
}

/* --- Lauf ----------------------------------------------------------------- */

const vergeben = new Set()
const alle = []
const bericht = []

let erste = true
for (const gegend of GEGENDEN) {
  if (nurGegend && nurGegend !== gegend.key) continue

  /* Zwischen zwei schweren Abfragen kurz Luft lassen — so steht es in der
     Nutzungsordnung von Overpass. */
  if (!erste) await warte(8000)
  erste = false

  console.log(`\n${gegend.name} (${gegend.km} km)…`)
  const elemente = await hole(gegend)
  console.log(`  ${elemente.length} Treffer von Overpass`)

  const betriebe = elemente
    .map((e) => umbauen(e, gegend, vergeben))
    .filter(Boolean)
    /* Mit Adresse zuerst — die sind für einen Test brauchbarer. */
    .sort((a, b) => (b.address ? 1 : 0) - (a.address ? 1 : 0))
    .slice(0, MAX)

  console.log(`  ${betriebe.length} übernommen`)
  bericht.push({ gegend: gegend.name, umkreis: gegend.km, anzahl: betriebe.length })
  alle.push(...betriebe)
}

const ziel = resolve('src/data/orte.json')
writeFileSync(ziel, `${JSON.stringify({
  quelle: 'OpenStreetMap-Mitwirkende, ODbL',
  geholt: new Date().toISOString().slice(0, 10),
  gegenden: bericht,
  betriebe: alle,
}, null, 2)}\n`)

console.log(`\n${alle.length} Betriebe in ${ziel}`)
bericht.forEach((b) => console.log(`  ${b.gegend}: ${b.anzahl}`))
