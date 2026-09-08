import { createApiServer } from '../src/http/server.js'
import { createMemoryStore } from '../src/domain/store.js'
import { setSitzungen } from '../src/http/tokens.js'
import { initialDatabase } from '../src/data/seed.js'

/**
 * Rauchtest.
 *
 * ┌─ Was geprüft wird ───────────────────────────────────────────────────────┐
 * │  src/http/server.js    die Adressen                                      │
 * │  src/domain/calls.js   die Rechte — serverseitig, nicht im Frontend      │
 * │  src/domain/*.js       die Abläufe: hochladen → Freigabe → sichtbar      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Prüft nicht jede Kleinigkeit, sondern das, worauf man sich verlassen können
 * muss.
 *
 * ── Warum der Test seine Daten selbst anlegt ──────────────────────────────
 *
 * Bis zum MVP standen im Ausgangsbestand erfundene Videos, Bewertungen und
 * Speisekarten; der Test hat darauf gezeigt („Video v4 freigeben"). Seit die
 * Beispieldaten weg sind, gibt es das nicht mehr — und das ist ein Gewinn:
 * Ein Test, der seine Lage selbst herstellt, prüft dabei gleich die Wege, auf
 * denen im Betrieb wirklich etwas entsteht.
 *
 * Läuft gegen einen Server im Arbeitsspeicher — die Datenbank unter data/
 * bleibt unberührt.
 */
const store = createMemoryStore(initialDatabase())
setSitzungen(null) /* Sitzungen im Speicher, keine Datenbank nötig. */
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

const registrieren = async (name) => {
  const res = await api('/api/auth/register', {
    method: 'POST',
    body: { email: `${name}@test.invalid`, username: name, name, password: 'Testtest1!' },
  })
  return { token: res.body.token, id: res.body.user?.id }
}

/* --- Grundlagen ---------------------------------------------------------- */
const health = await api('/api/health')
check('Server antwortet', health.status === 200 && health.body.ok)
check('Aufrufliste ist gefüllt', health.body.aufrufe > 50, `nur ${health.body.aufrufe}`)

const places = await api('/api/places')
check('Betriebe ohne Anmeldung lesbar',
  places.status === 200 && places.body.result?.length >= 100,
  `${places.body.result?.length} Betriebe`)

/* Ein Betrieb aus dem Import — an dem hängt alles Weitere. */
const betrieb = places.body.result[0]
check('Betriebe haben Lage und Kürzel', !!betrieb.slug && Number.isFinite(betrieb.lat))

const einzeln = await api(`/api/g/${betrieb.slug}`)
check('Betriebsseite über das Kürzel abrufbar', einzeln.status === 200 && einzeln.body.place.id === betrieb.id)

/* Der Umkreis wirkt wirklich — sonst wäre die Karte eine Lüge. */
const weitWeg = await api('/api/places?lat=-33.87&lng=151.21&radiusKm=5')
check('Am anderen Ende der Welt ist nichts in der Nähe', weitWeg.body.result.length === 0,
  `${weitWeg.body.result.length} gefunden`)

/* --- Anmeldung ----------------------------------------------------------- */
const wrong = await api('/api/auth/login', { method: 'POST', body: { identifier: 'test@user.de', password: 'falsch' } })
check('Falsches Passwort wird abgewiesen', wrong.status === 401)

const userToken = await login('test@user.de', '12345aA?')
check('Anmeldung als Nutzer', !!userToken)

const gastroToken = await login('test@gastro.de', '12345aA?')
const adminToken = await login('topic', 'admin')
check('Anmeldung als Gastro und Verwaltung', !!gastroToken && !!adminToken)

const me = await api('/api/auth/me', { token: userToken })
check('Eigenes Konto abrufbar', me.body.user.username === 'test-user')
check('Passwort wird nie mitgeliefert', !JSON.stringify(me.body).includes('12345aA?'))

/* --- Verifizierung darf übersprungen werden (MVP) ------------------------ */
const frisch = await registrieren('neuling')
const frischesKonto = (await api('/api/auth/me', { token: frisch.token })).body.user
check('Ein neues Konto ist noch nicht verifiziert',
  frischesKonto.emailVerified === false && frischesKonto.phoneVerified === false)
await rpc('auth.skipVerification', [], frisch.token)
check('Überspringen wird am Konto festgehalten',
  (await api('/api/auth/me', { token: frisch.token })).body.user.verificationSkipped === true)
await rpc('auth.confirmVerification', ['email'], frisch.token)
check('Bestätigen setzt den Kanal',
  (await api('/api/auth/me', { token: frisch.token })).body.user.emailVerified === true)
check('Ohne Anmeldung lässt sich nichts überspringen',
  (await rpc('auth.skipVerification', [])).status === 401)

/* --- Rechte greifen serverseitig ---------------------------------------- */
check('Gast darf nicht in die Verwaltung', (await rpc('admin.overview')).status === 401)
check('Nutzer darf nicht in die Verwaltung', (await rpc('admin.overview', [], userToken)).status === 403)
check('Verwaltung darf in die Verwaltung', (await rpc('admin.overview', [], adminToken)).status === 200)

const eigenerBetrieb = (await api('/api/auth/me', { token: gastroToken })).body.account.placeId
const fremderBetrieb = places.body.result.find((p) => p.id !== eigenerBetrieb).id
check('Gastro darf die eigene Karte ändern',
  (await rpc('menu.addCategory', [eigenerBetrieb, 'Mittagskarte'], gastroToken)).status === 200)
check('Gastro darf NICHT die fremde Karte ändern',
  (await rpc('menu.addCategory', [fremderBetrieb, 'Fremd'], gastroToken)).status === 403)
check('Gastro darf NICHT fremde Betriebsdaten ändern',
  (await rpc('places.save', [fremderBetrieb, { name: 'Übernommen' }], gastroToken)).status === 403)

check('Unbekannter Aufruf läuft ins Leere', (await rpc('users.deleteAll')).status === 404)

/* --- Ein Ablauf von Anfang bis Ende -------------------------------------- */
const kategorie = (await rpc('menu.get', [eigenerBetrieb], gastroToken)).body.result[0]
const gericht = (await rpc('menu.addDish', [eigenerBetrieb, kategorie.id, {
  name: 'Tagesteller', description: 'Was da ist.', priceCents: 1290,
}], gastroToken)).body.result
check('Gastro legt ein Gericht an', !!gericht?.id)

const created = await rpc('videos.create', [{ placeId: eigenerBetrieb, caption: 'Rauchtest', durationSec: 20 }], userToken)
check('Video anlegen', created.status === 200 && created.body.result.status === 'pending_review')
const videoId = created.body.result?.id

check('Vor der Freigabe ist es nicht sichtbar',
  (await rpc('videos.byPlace', [eigenerBetrieb])).body.result.length === 0)

const review = await rpc('reviews.create', [{
  videoId, placeId: eigenerBetrieb, ratingFood: 5, ratingService: 4, ratingPrice: 3,
  dishes: [{ dishId: gericht.id, name: gericht.name, rating: 5 }], text: 'Rauchtest',
}], userToken)
check('Bewertung anlegen', review.status === 200)

const queue = await rpc('videos.pending', [], adminToken)
check('Video steht in der Freigabe', queue.body.result.some((v) => v.id === videoId))
check('Nutzer darf keine Videos freigeben',
  (await rpc('videos.moderate', [videoId, 'published'], userToken)).status === 403)

await rpc('videos.moderate', [videoId, 'published'], adminToken)
check('Nach der Freigabe ist es sichtbar',
  (await rpc('videos.byPlace', [eigenerBetrieb])).body.result.some((v) => v.id === videoId))

const notes = await rpc('notifications.list', [], userToken)
check('Die Autorin wird benachrichtigt', notes.body.result.some((n) => n.type === 'approved'))

const dishRating = (await rpc('menu.get', [eigenerBetrieb])).body.result
  .flatMap((c) => c.items).find((d) => d.id === gericht.id)
check('Gerichtbewertung schlägt auf die Karte durch', dishRating.ratingCount === 1,
  `ratingCount=${dishRating.ratingCount}`)

const bewertet = (await rpc('places.byId', [eigenerBetrieb])).body.result
check('Die Bewertung steht am Betrieb — drei Achsen getrennt',
  bewertet.rating.food === 5 && bewertet.rating.service === 4 && bewertet.rating.price === 3)

/* --- Meldungen ----------------------------------------------------------- */
const gemeldet = fremderBetrieb
for (const name of ['melder1', 'melder2', 'melder3']) {
  const konto = await registrieren(name)
  await rpc('reports.create', [{ targetType: 'place', targetId: gemeldet, reason: 'venue_closed', label: 'Test' }], konto.token)
}
const reported = (await rpc('places.byId', [gemeldet])).body.result
check('Drei Meldungen setzen den Betrieb auf gemeldet-geschlossen', reported.status === 'closed_reported',
  `status=${reported.status}`)

/* --- Der Zustand der Betrachterin reist mit ------------------------------ */
const position = { lat: betrieb.lat, lng: betrieb.lng }
const feedAnonym = await rpc('videos.feed', [{ position, radiusKm: 5 }])
check('Ohne Anmeldung ist nichts gemerkt',
  feedAnonym.body.result.items.every((v) => v.viewerLiked === false && v.viewerSaved === false))

await rpc('social.toggleLike', [null, videoId], userToken)
const feedAngemeldet = await rpc('videos.feed', [{ position, radiusKm: 5 }], userToken)
check('Angemeldet steht „Gefällt mir" an den Daten',
  feedAngemeldet.body.result.items.find((v) => v.id === videoId)?.viewerLiked === true)

/* Wer nicht angemeldet ist, kann auch nicht in fremdem Namen handeln. */
const fremdeKennung = await rpc('social.toggleLike', ['a1', videoId], userToken)
check('Fremde Kennung wird ignoriert',
  fremdeKennung.status === 200 && !store.get().likes.some((l) => l.userId === 'a1'))

const eigenesProfil = await rpc('users.byUsername', ['test-user'], userToken)
check('Folgen-Zustand reist am Profil mit', ['none', 'pending', 'accepted'].includes(eigenesProfil.body.result.viewerFollow))

/* --- Datenschutz --------------------------------------------------------- */
const exportData = await rpc('users.exportData', [], userToken)
check('Datenexport enthält alle Bereiche', Object.keys(exportData.body.result).length >= 7)
check('Im Datenexport steht kein Passwort', !JSON.stringify(exportData.body).includes('12345aA?'))

const geloescht = await registrieren('gehtwieder')
await rpc('reviews.create', [{
  placeId: eigenerBetrieb, ratingFood: 3, ratingService: 3, ratingPrice: 3, text: 'Bleibt anonym',
}], geloescht.token)
await rpc('users.deleteAccount', [], geloescht.token)
check('Konto gelöscht, Bewertungen anonymisiert',
  store.get().reviews.some((r) => r.anonymized) && !store.get().users.some((u) => u.id === geloescht.id))

/* --- Abmelden ------------------------------------------------------------ */
await api('/api/auth/logout', { method: 'POST', token: adminToken })
check('Nach dem Abmelden gilt der Zugang nicht mehr',
  (await rpc('admin.overview', [], adminToken)).status === 401)

server.close()

const failed = results.filter(([ok]) => !ok)
results.forEach(([ok, name, detail]) => console.log(`${ok ? '  ok  ' : 'FEHLER'} ${name}${detail ? ` — ${detail}` : ''}`))
console.log(`\n${results.length - failed.length} von ${results.length} bestanden.`)
if (failed.length) process.exitCode = 1
