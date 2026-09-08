/**
 * Sieht nach, ob die geholten Betriebe brauchbar sind.
 *
 * Ein Import, der stillschweigend Unsinn liefert, ist schlimmer als einer, der
 * abbricht: Der Unsinn landet im Repository und fällt erst auf der Karte auf.
 */
const daten = await import('../src/data/orte.js')
const betriebe = daten.betriebe ?? []

const ergebnisse = []
const pruefe = (name, ok, hinweis = '') => ergebnisse.push([!!ok, name, ok ? '' : hinweis])

pruefe('Überhaupt Betriebe da', betriebe.length > 0, `${betriebe.length}`)
pruefe('Alle drei Gegenden vertreten',
  new Set(betriebe.map((b) => b.region)).size === (daten.gegenden ?? []).length,
  [...new Set(betriebe.map((b) => b.region))].join(', '))

const ohneNamen = betriebe.filter((b) => !b.name?.trim())
pruefe('Jeder Betrieb hat einen Namen', ohneNamen.length === 0, `${ohneNamen.length} ohne`)

const kuerzel = betriebe.map((b) => b.slug)
pruefe('Kürzel sind eindeutig', new Set(kuerzel).size === kuerzel.length,
  `${kuerzel.length - new Set(kuerzel).size} doppelt`)

/*
 * Die wichtigere Prüfung. Die Kürzel waren eindeutig, während 55 Betriebe
 * doppelt in der Liste standen: Der Import hängte dem zweiten Eintrag einfach
 * einen Ortsnamen an. Die OSM-Nummer lässt sich nicht so umbenennen.
 */
const kennungen = betriebe.map((b) => b.osmId)
const doppelteKennungen = kennungen.length - new Set(kennungen).size
pruefe('Jeder Betrieb kommt nur einmal vor', doppelteKennungen === 0,
  `${doppelteKennungen} doppelt, die Umkreise überlappen sich`)

/* Koordinaten müssen im Umkreis liegen, sonst stimmt die Abfrage nicht. */
const R = 6371
const entfernung = (a, b) => {
  const rad = (g) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const MITTE = {
  alcossebre: { lat: 40.2408, lng: 0.2706, km: 25 },
  rheinmuenster: { lat: 48.7686, lng: 8.0511, km: 30 },
  oberkirch: { lat: 48.5333, lng: 8.0833, km: 30 },
}
const zuWeit = betriebe.filter((b) => {
  const m = MITTE[b.region]
  return m && entfernung(m, b) > m.km + 1
})
pruefe('Alle liegen im bestellten Umkreis', zuWeit.length === 0,
  zuWeit.slice(0, 3).map((b) => b.name).join(', '))

/*
 * Derselbe Betrieb darf nicht zweimal drin sein. OpenStreetMap führt größere
 * Lokale oft als Punkt und als Gebäudefläche, gleicher Name, ein paar Meter
 * auseinander. Verschiedene Gasthöfe „Hirsch" in verschiedenen Dörfern sind
 * dagegen in Ordnung, deshalb zählt Name **und** Nähe.
 */
const doppelte = []
for (let i = 0; i < betriebe.length; i += 1) {
  for (let j = i + 1; j < betriebe.length; j += 1) {
    if (betriebe[i].name === betriebe[j].name
      && entfernung(betriebe[i], betriebe[j]) * 1000 < 150) {
      doppelte.push(betriebe[i].name)
    }
  }
}
pruefe('Kein Betrieb doppelt', doppelte.length === 0,
  [...new Set(doppelte)].slice(0, 3).join(', '))

const ohneAngebot = betriebe.filter((b) => !Array.isArray(b.serving) || !b.serving.length)
pruefe('Jeder hat eine Angebotszeile', ohneAngebot.length === 0, `${ohneAngebot.length} ohne`)

const mitAdresse = betriebe.filter((b) => b.address).length
pruefe('Mindestens die Hälfte hat eine Adresse', mitAdresse * 2 >= betriebe.length,
  `${mitAdresse} von ${betriebe.length}`)

/*
 * Ausdrücklich bestellt: Bewertungen werden aus keiner fremden Quelle
 * übernommen. Der Import schreibt keine, diese Prüfung sorgt dafür, dass es
 * so bleibt, auch wenn jemand später ein Feld „mitnimmt".
 */
const BEWERTUNGSFELDER = ['rating', 'ratings', 'stars', 'reviewCount', 'reviews', 'score', 'googleRating']
const mitFremdbewertung = betriebe.flatMap((b) => BEWERTUNGSFELDER.filter((feld) => feld in b))
pruefe('Keine übernommenen Bewertungen', mitFremdbewertung.length === 0,
  [...new Set(mitFremdbewertung)].join(', '))

/*
 * Kein Betrieb, den es nicht mehr gibt.
 *
 * OpenStreetMap kennt kein Feld dafür und schreibt es in den Namen,
 * „Lempert (dauerhaft geschlossen)". src/data/zustand.js trennt das ab und
 * wirft dauerhaft Geschlossene aus dem Bestand. Diese Prüfung sieht nach, ob
 * im Import noch etwas übrig ist.
 */
const { ZUSATZ } = await import('../src/data/zustand.js')
const mitHinweis = betriebe.filter((b) => ZUSATZ.test(b.name))
pruefe('Kein Schließungshinweis im Namen', mitHinweis.length === 0,
  mitHinweis.slice(0, 3).map((b) => b.name).join(' | '))

/* Bilder: nur aus freien Quellen, und dann mit Nennung. */
const bilderOhneQuelle = betriebe.filter((b) => b.bildUrl && !b.bildQuelle)
pruefe('Jedes Bild nennt seine Quelle', bilderOhneQuelle.length === 0,
  `${bilderOhneQuelle.length} ohne`)

const mitZeiten = betriebe.filter((b) => b.hours).length
const mitBild = betriebe.filter((b) => b.bildUrl).length
const mitAusstattung = betriebe.filter((b) => b.features?.length).length
console.log(`\n${betriebe.length} Betriebe, ${mitAdresse} mit Adresse, ${mitZeiten} mit Öffnungszeiten, `
  + `${mitAusstattung} mit Ausstattung, ${mitBild} mit eigenem Bild `
  + `(der Rest bekommt eins vom Server: src/http/bilder.js).`)
for (const g of daten.gegenden ?? []) console.log(`  ${g.gegend}: ${g.anzahl}`)
console.log()

const durchgefallen = ergebnisse.filter(([ok]) => !ok)
ergebnisse.forEach(([ok, name, hinweis]) =>
  console.log(`${ok ? '  ok  ' : 'FEHLER'} ${name}${hinweis ? `, ${hinweis}` : ''}`))
console.log(`\n${ergebnisse.length - durchgefallen.length} von ${ergebnisse.length} bestanden.`)
if (durchgefallen.length) process.exitCode = 1
