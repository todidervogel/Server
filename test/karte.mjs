import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApiServer } from '../src/http/server.js'
import { createMemoryStore } from '../src/domain/store.js'
import { setKachelordner } from '../src/http/karte.js'
import { initialDatabase } from '../src/data/seed.js'

/**
 * Prüft die Karte auf der Serverseite.
 *
 * ┌─ Was geprüft wird ───────────────────────────────────────────────────────┐
 * │  src/http/karte.js        Stil, Kacheln, Zwischenspeicher                │
 * │  src/http/kachelbild.js   der Ersatz, wenn keine Kachel zu bekommen ist  │
 * │  src/domain/places.js     inBounds — was im Ausschnitt liegt             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Der Kachelanbieter wird hier **nicht** angesprochen. In dieser Umgebung ist
 * er nicht erreichbar, und ein Test, der von fremden Servern abhängt, ist mal
 * grün und mal rot, ohne dass sich am Code etwas geändert hätte. Geprüft wird
 * deshalb das, was hier entschieden wird: dass immer ein gültiges Bild
 * herauskommt, dass der Zwischenspeicher vorgeht und dass Unsinn im Pfad
 * nichts kaputtmacht.
 */

const ordner = mkdtempSync(join(tmpdir(), 'kacheln-'))
setKachelordner(ordner)

const store = createMemoryStore(initialDatabase())
const server = createApiServer({ store, log: () => {} })
await new Promise((fertig) => server.listen(0, '127.0.0.1', fertig))
const BASIS = `http://127.0.0.1:${server.address().port}`

const ergebnisse = []
const pruefe = (name, bedingung, detail = '') => ergebnisse.push([!!bedingung, name, bedingung ? '' : detail])

const istPng = (puffer) =>
  puffer.length > 8 && puffer[0] === 0x89 && puffer.subarray(1, 4).toString('ascii') === 'PNG'

/* --- Stil ----------------------------------------------------------------- */
const stil = await (await fetch(`${BASIS}/api/karte/stil`)).json()
pruefe('Der Stil nennt seine Quelle', /OpenStreetMap/.test(stil.nennung))
pruefe('Die Kachelvorlage zeigt auf den eigenen Server', stil.vorlage.startsWith('/api/karte/kachel/'))
pruefe('Weltweit bis Zoom 19', stil.maxZoom >= 18)

/* --- Kacheln --------------------------------------------------------------- */
async function kachel(pfad) {
  const antwort = await fetch(`${BASIS}${pfad}`)
  return {
    status: antwort.status,
    typ: antwort.headers.get('content-type'),
    herkunft: antwort.headers.get('x-kachel'),
    inhalt: Buffer.from(await antwort.arrayBuffer()),
  }
}

const ohneAnbieter = await kachel('/api/karte/kachel/14/8512/5583.png')
pruefe('Auch ohne Kachelanbieter kommt ein Bild',
  ohneAnbieter.status === 200 && istPng(ohneAnbieter.inhalt), `Herkunft: ${ohneAnbieter.herkunft}`)
pruefe('Die Kachel wird als PNG ausgeliefert', ohneAnbieter.typ === 'image/png')

/* Unsinn im Pfad darf nichts umwerfen. */
for (const pfad of [
  '/api/karte/kachel/3/99/99.png',      /* außerhalb des Gitters bei Zoom 3 */
  '/api/karte/kachel/30/1/1.png',       /* Zoom, den es nicht gibt */
  '/api/karte/kachel/0/0/0.png',        /* die ganze Welt auf einer Kachel */
]) {
  const antwort = await kachel(pfad)
  pruefe(`Kachel ${pfad.replace('/api/karte/kachel/', '')} liefert ein Bild`,
    antwort.status === 200 && istPng(antwort.inhalt))
}

pruefe('Ein Pfad, der keine Kachel ist, wird nicht als Bild beantwortet',
  (await fetch(`${BASIS}/api/karte/kachel/14/8512/5583.jpg`)).status === 404)

/* --- Zwischenspeicher ------------------------------------------------------ */
/* Eine Kachel von Hand hineinlegen: Sie muss von dort kommen, nicht als Ersatz. */
mkdirSync(join(ordner, stil.name, '9', '267'), { recursive: true })
const erfunden = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(200, 7),
])
writeFileSync(join(ordner, stil.name, '9', '267', '176.png'), erfunden)

const ausSpeicher = await kachel('/api/karte/kachel/9/267/176.png')
pruefe('Eine gespeicherte Kachel wird von der Platte bedient',
  ausSpeicher.herkunft === 'speicher' && ausSpeicher.inhalt.equals(erfunden),
  `Herkunft: ${ausSpeicher.herkunft}`)

/* --- Marker ---------------------------------------------------------------- */
const marker = async (frage) =>
  (await (await fetch(`${BASIS}/api/karte/betriebe?${frage}`)).json()).result

const beiOberkirch = await marker('nord=48.6&sued=48.45&west=8.0&ost=8.2')
pruefe('Im Ausschnitt um Oberkirch liegen Betriebe', beiOberkirch.length > 20,
  `${beiOberkirch.length} gefunden`)
pruefe('Alle Marker liegen wirklich im Ausschnitt',
  beiOberkirch.every((m) => m.lat >= 48.45 && m.lat <= 48.6 && m.lng >= 8.0 && m.lng <= 8.2))
pruefe('Ein Marker trägt nur, was ein Marker braucht',
  beiOberkirch[0] && !('hours' in beiOberkirch[0]) && !('rating' in beiOberkirch[0])
  && !!beiOberkirch[0].slug)

pruefe('Ohne Ausschnitt kommt nichts', (await marker('')).length === 0)
pruefe('Über dem Pazifik liegt keiner unserer Betriebe',
  (await marker('nord=10&sued=-10&west=170&ost=-170')).length === 0)
pruefe('Die Obergrenze wirkt',
  (await marker('nord=90&sued=-90&west=-180&ost=180&max=7')).length === 7)
pruefe('Ohne Obergrenze kommt nicht null',
  (await marker('nord=90&sued=-90&west=-180&ost=180')).length > 100)

server.close()
rmSync(ordner, { recursive: true, force: true })

const daneben = ergebnisse.filter(([ok]) => !ok)
ergebnisse.forEach(([ok, name, detail]) => console.log(`${ok ? '  ok  ' : 'FEHLER'} ${name}${detail ? ` — ${detail}` : ''}`))
console.log(`\n${ergebnisse.length - daneben.length} von ${ergebnisse.length} bestanden.`)
if (daneben.length) process.exitCode = 1
