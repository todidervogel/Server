import { createApiServer } from '../src/http/server.js'
import { createMemoryStore } from '../src/domain/store.js'
import { initialDatabase } from '../src/data/seed.js'

/**
 * Rauchtest.
 *
 * Prüft nicht jede Kleinigkeit, sondern das, worauf man sich verlassen können
 * muss: Die Anmeldung funktioniert, die Rechte greifen serverseitig, und die
 * Abläufe hängen zusammen (hochladen → Warteschlange → freigeben → sichtbar).
 *
 * Läuft gegen einen eigenen Server im Arbeitsspeicher — die Datei unter data/
 * bleibt unberührt.
 */
const store = createMemoryStore(initialDatabase())
const server = createApiServer({ store, log: () => {} })
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const BASE = `http://127.0.0.1:${server.address().port}`

const results = []
const check = (name, condition, detail = '') => {
  results.push([!!condition, name, condition ? '' : detail])
}

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json() }
}

const rpc = (method, args = [], token) =>
  api('/api/rpc', { method: 'POST', body: { method, args }, token })

const login = async (identifier, password) => {
  const res = await api('/api/auth/login', { method: 'POST', body: { identifier, password } })
  return res.body.token
}

/* --- Grundlagen ---------------------------------------------------------- */
const health = await api('/api/health')
check('Server antwortet', health.status === 200 && health.body.ok)
check('Aufrufliste ist gefüllt', health.body.aufrufe > 50, `nur ${health.body.aufrufe}`)

const places = await api('/api/places')
check('Betriebe ohne Anmeldung lesbar', places.status === 200 && places.body.result.length === 10,
  `${places.body.result?.length} Betriebe`)

const menu = await api('/api/g/trattoria-bella/speisekarte')
check('Speisekarte über die Adresse abrufbar', menu.status === 200 && menu.body.menu.length === 5,
  `${menu.body.menu?.length} Kategorien`)

/* --- Anmeldung ----------------------------------------------------------- */
const wrong = await api('/api/auth/login', { method: 'POST', body: { identifier: 'max@beispiel.de', password: 'falsch' } })
check('Falsches Passwort wird abgewiesen', wrong.status === 401)

const userToken = await login('max@beispiel.de', 'Passwort123')
check('Anmeldung als Nutzer', !!userToken)

const gastroToken = await login('chef@trattoria-bella.de', 'Gastro123')
const adminToken = await login('ana@intern', 'Admin1234')
check('Anmeldung als Gastro und Admin', !!gastroToken && !!adminToken)

const firstLogin = await api('/api/auth/login', {
  method: 'POST', body: { identifier: 'hallo@morgenrot-cafe.de', password: 'Start1234' },
})
check('Gastro-Erstlogin verlangt ein neues Passwort', firstLogin.body.mustChangePassword === true)

const me = await api('/api/auth/me', { token: userToken })
check('Eigenes Konto abrufbar', me.body.user.username === 'maxmuster')
check('Passwort wird nie mitgeliefert', !JSON.stringify(me.body).includes('Passwort123'))

/* --- Rechte greifen serverseitig ---------------------------------------- */
check('Gast darf nicht in die Verwaltung', (await rpc('admin.overview')).status === 401)
check('Nutzer darf nicht in die Verwaltung', (await rpc('admin.overview', [], userToken)).status === 403)
check('Admin darf in die Verwaltung', (await rpc('admin.overview', [], adminToken)).status === 200)

check('Nutzer darf keine Videos freigeben',
  (await rpc('videos.moderate', ['v4', 'published'], userToken)).status === 403)

check('Gastro darf die eigene Karte ändern',
  (await rpc('menu.addCategory', ['p1', 'Testkategorie'], gastroToken)).status === 200)
check('Gastro darf NICHT die fremde Karte ändern',
  (await rpc('menu.addCategory', ['p9', 'Fremd'], gastroToken)).status === 403)
check('Gastro darf NICHT fremde Betriebsdaten ändern',
  (await rpc('places.save', ['p9', { name: 'Übernommen' }], gastroToken)).status === 403)

check('Unbekannter Aufruf läuft ins Leere', (await rpc('users.deleteAll')).status === 404)

/* Wer nicht angemeldet ist, kann auch nicht in fremdem Namen handeln. */
const fremd = await rpc('social.toggleLike', ['u3', 'v1'], userToken)
check('Gefällt mir zählt für das eigene Konto', fremd.status === 200)
const likedByU3 = store.get().likes.some((l) => l.userId === 'u3' && l.videoId === 'v1')
check('Fremde Kennung wird ignoriert', !likedByU3)

/* --- Ein Ablauf von Anfang bis Ende -------------------------------------- */
const created = await rpc('videos.create', [{ placeId: 'p1', caption: 'Rauchtest', durationSec: 20 }], userToken)
check('Video anlegen', created.status === 200 && created.body.result.status === 'pending_review')
const videoId = created.body.result?.id

const review = await rpc('reviews.create', [{
  videoId, placeId: 'p1', ratingFood: 5, ratingService: 4, ratingPrice: 3,
  dishes: [{ dishId: 'd1', name: 'Pizza Margherita', rating: 5 }], text: 'Rauchtest',
}], userToken)
check('Bewertung anlegen', review.status === 200)

const queue = await rpc('videos.pending', [], adminToken)
check('Video steht in der Freigabe', queue.body.result.some((v) => v.id === videoId))

const before = (await rpc('videos.byPlace', ['p1'])).body.result.length
await rpc('videos.moderate', [videoId, 'published'], adminToken)
const after = (await rpc('videos.byPlace', ['p1'])).body.result.length
check('Nach der Freigabe ist es sichtbar', after === before + 1, `${before} → ${after}`)

const notes = await rpc('notifications.list', [], userToken)
check('Die Autorin wird benachrichtigt', notes.body.result.some((n) => n.type === 'approved'))

const dishRating = (await rpc('menu.get', ['p1'])).body.result
  .flatMap((c) => c.items).find((d) => d.id === 'd1')
check('Gerichtbewertung schlägt auf die Karte durch', dishRating.ratingCount >= 2,
  `ratingCount=${dishRating.ratingCount}`)

/* --- Meldungen ----------------------------------------------------------- */
for (const identifier of ['max@beispiel.de', 'lisa@beispiel.de', 'fatima@beispiel.de']) {
  const token = await login(identifier, 'Passwort123')
  await rpc('reports.create', [{ targetType: 'place', targetId: 'p4', reason: 'venue_closed', label: 'Bäckerei Sommer' }], token)
}
const reported = (await rpc('places.byId', ['p4'])).body.result
check('Drei Meldungen setzen den Betrieb auf gemeldet-geschlossen', reported.status === 'closed_reported',
  `status=${reported.status}`)

/* --- Der Zustand der Betrachterin reist mit ------------------------------ */
const feedAnonym = await rpc('videos.feed', [{ position: { lat: 52.539, lng: 13.4116 }, radiusKm: 5 }])
check('Ohne Anmeldung ist nichts gemerkt',
  feedAnonym.body.result.items.every((v) => v.viewerLiked === false && v.viewerSaved === false))

/* Ein Video nehmen, das noch niemand von uns gemerkt hat. */
const feedVorher = await rpc('videos.feed', [{ position: { lat: 52.539, lng: 13.4116 }, radiusKm: 5 }], userToken)
const frisch = feedVorher.body.result.items.find((v) => !v.viewerLiked)
await rpc('social.toggleLike', [null, frisch.id], userToken)
const feedAngemeldet = await rpc('videos.feed', [{ position: { lat: 52.539, lng: 13.4116 }, radiusKm: 5 }], userToken)
check('Angemeldet steht „Gefällt mir" an den Daten',
  feedAngemeldet.body.result.items.find((v) => v.id === frisch.id)?.viewerLiked === true)

const fremdesProfil = await rpc('users.byUsername', ['jonas.isst'], userToken)
check('Folgen-Zustand reist am Profil mit', ['none', 'pending', 'accepted'].includes(fremdesProfil.body.result.viewerFollow))

/* --- Datenschutz --------------------------------------------------------- */
const exportData = await rpc('users.exportData', [], userToken)
check('Datenexport enthält alle Bereiche',
  Object.keys(exportData.body.result).length >= 7)

const lisaToken = await login('lisa@beispiel.de', 'Passwort123')
const lisaId = (await api('/api/auth/me', { token: lisaToken })).body.user.id
await rpc('users.deleteAccount', [], lisaToken)
const anonym = store.get().reviews.filter((r) => r.anonymized)
check('Konto gelöscht, Bewertungen anonymisiert',
  anonym.length > 0 && !store.get().users.some((u) => u.id === lisaId))

/* --- Abmelden ------------------------------------------------------------ */
await api('/api/auth/logout', { method: 'POST', token: adminToken })
check('Nach dem Abmelden gilt der Zugang nicht mehr',
  (await rpc('admin.overview', [], adminToken)).status === 401)

server.close()

const failed = results.filter(([ok]) => !ok)
results.forEach(([ok, name, detail]) => console.log(`${ok ? '  ok  ' : 'FEHLER'} ${name}${detail ? ` — ${detail}` : ''}`))
console.log(`\n${results.length - failed.length} von ${results.length} bestanden.`)
if (failed.length) process.exitCode = 1
