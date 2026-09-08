import { createServer } from 'node:http'
import * as domain from '../domain/index.js'
import * as tokens from './tokens.js'
import { callRpc, listRoutes } from './rpc.js'
import { kachel, stil } from './karte.js'
import { titelbild } from '../domain/titelbild.js'
import { stand, zaehlen } from './zaehler.js'

/**
 * Der HTTP-Server. Ohne Fremdabhängigkeiten, `npm install` lädt nichts nach,
 * `node src/index.js` genügt.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/index.js         startet den Server                                 │
 * │  src/http/rpc.js      der eine Eingang für die Fachlogik                 │
 * │  src/http/tokens.js   macht aus einer Anmeldung ein Merkmal              │
 * │  src/http/karte.js    Kacheln und Marker                                 │
 * │  src/http/zaehler.js  zählt mit, was abgerufen wird (GET /api/status)    │
 * │  src/domain/auth.js   Anmeldung, Registrierung, Passwort                 │
 * │  test/smoke.mjs       fährt ihn im Speicher hoch und klopft ihn ab       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Es gibt drei Arten von Endpunkten:
 *
 *  - `/api/rpc`   ein Eingang für die gesamte Fachlogik. Was erlaubt ist,
 *                 steht in `domain/calls.js`, nicht im Frontend.
 *  - ein paar Leseadressen (`/api/places`, `/api/g/:slug`, …), damit man mit
 *    curl oder dem Browser nachsehen kann, ohne einen Aufruf zu formulieren.
 *  - `/api/karte/…` die Karte: Kacheln und Marker (siehe `karte.js`).
 */

/** Antwortet mit einem Bild. Kacheln sind das Einzige, was nicht JSON ist. */
const bild = (res, inhalt, { herkunft } = {}) => {
  res.writeHead(200, {
    'content-type': 'image/png',
    'content-length': inhalt.length,
    /*
     * Der Browser darf die Kachel einen Tag behalten. Ohne das holt jedes
     * Verschieben der Karte dieselben Bilder erneut, über Mobilfunk ist das
     * der Unterschied zwischen flüssig und zäh.
     */
    'cache-control': 'public, max-age=86400',
    ...(herkunft ? { 'x-kachel': herkunft } : {}),
  })
  res.end(inhalt)
}

/** Antwortet mit einem SVG, die erzeugten Titelbilder. */
const svg = (res, inhalt) => {
  const puffer = Buffer.from(inhalt, 'utf8')
  res.writeHead(200, {
    'content-type': 'image/svg+xml; charset=utf-8',
    'content-length': puffer.length,
    /* Dasselbe Kürzel ergibt immer dasselbe Bild, das darf lange liegen. */
    'cache-control': 'public, max-age=604800',
  })
  res.end(puffer)
}

const json = (res, status, body) => {
  const text = JSON.stringify(body, null, 2)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

/** Der Browser fragt vor jedem Aufruf nach, daher die Freigabe. */
function cors(res, origin) {
  res.setHeader('access-control-allow-origin', origin ?? '*')
  res.setHeader('access-control-allow-headers', 'content-type, authorization')
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
  res.setHeader('access-control-max-age', '600')
}

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = []
  let size = 0
  req.on('data', (chunk) => {
    size += chunk.length
    /* Eine Million Zeichen reichen für jeden Aufruf; alles darüber ist ein Fehler. */
    if (size > 1_000_000) { reject(new Error('Anfrage zu groß')); req.destroy(); return }
    chunks.push(chunk)
  })
  req.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf8')
    if (!text) return resolve({})
    try { return resolve(JSON.parse(text)) } catch { return reject(new Error('Kein gültiges JSON')) }
  })
  req.on('error', reject)
})

const bearer = (req) => {
  const header = req.headers.authorization ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

export function createApiServer({ store, log = console.log }) {
  domain.setStore(store)

  const handlers = {
    'GET /api/health': () => ({
      status: 200,
      body: { ok: true, aufrufe: listRoutes().length, sitzungen: tokens.count(), zeit: new Date().toISOString() },
    }),

    /*
     * Was der Server gerade tut. `/api/health` sagt nur, ob er antwortet;
     * hier steht, wie lange er schon läuft, was abgerufen wurde und ob
     * überhaupt jemand da ist.
     *
     * Der Workflow zeigt das jede halbe Minute im Protokoll an, damit man
     * einem laufenden Server beim Laufen zusehen kann.
     */
    'GET /api/status': () => ({
      status: 200,
      body: stand({ sitzungen: tokens.count(), betriebe: store.get().places.length }),
    }),

    'GET /api/routes': () => ({ status: 200, body: { routes: listRoutes() } }),

    /*
     * Zum Nachsehen mit curl oder im Browser. Nimmt dieselben Angaben wie der
     * Aufruf über /api/rpc:
     *
     *   /api/places?lat=48.53&lng=8.08&radiusKm=10&q=pizza
     *
     * Vorher wurden die Parameter stillschweigend verworfen, die Adresse gab
     * immer alles zurück, und eine Prüfung „liegen die neuen Orte da, wo sie
     * hingehören?" ging damit ins Leere.
     */
    'GET /api/places': (req, url) => {
      const zahl = (name) => {
        const roh = url.searchParams.get(name)
        return roh === null || roh === '' ? undefined : Number(roh)
      }
      const lat = zahl('lat')
      const lng = zahl('lng')
      const position = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined

      /*
       * Obergrenze, seit die Fläche dazugekommen ist.
       *
       * Ohne Umkreis liefert diese Adresse sonst jeden Betrieb, den der Server
       * kennt. Bei den drei Kern-Gegenden waren das 359 und ein paar hundert
       * Kilobyte; mit ganz Deutschland sind es zwölftausend und zweistellige
       * Megabyte, über Mobilfunk an ein Handy. Wer wirklich alles will, setzt
       * `limit` hoch.
       */
      const grenze = zahl('limit')
      const alle = domain.places.list({
        position,
        radiusKm: zahl('radiusKm'),
        query: url.searchParams.get('q') ?? undefined,
      })
      const wieViele = Number.isFinite(grenze) ? Math.min(Math.max(grenze, 1), 5000) : 500

      return {
        status: 200,
        body: {
          result: alle.slice(0, wieViele),
          ...(alle.length > wieViele ? { gesamt: alle.length, gekuerzt: true } : {}),
        },
      }
    },

    /* --- Karte ---------------------------------------------------------- */

    'GET /api/karte/stil': () => ({ status: 200, body: stil() }),

    /*
     * Marker in einem Ausschnitt. Die Karte fragt nach dem, was sie zeigt,
     * nicht nach allem, bei einer Weltkarte wären das sonst alle Betriebe
     * auf einmal.
     *
     *   /api/karte/betriebe?nord=48.6&sued=48.4&west=8.0&ost=8.2
     */
    'GET /api/karte/betriebe': (req, url) => {
      /*
       * `Number(null)` ist 0, nicht NaN. Ein fehlendes `max` wurde deshalb
       * einmal als „höchstens null Marker" gelesen und die Karte blieb leer.
       * Fehlt der Wert, muss er auch fehlen.
       */
      const zahl = (name) => {
        const roh = url.searchParams.get(name)
        return roh === null || roh === '' ? undefined : Number(roh)
      }
      const grenze = zahl('max')
      return {
        status: 200,
        body: {
          result: domain.places.inBounds(
            { nord: zahl('nord'), sued: zahl('sued'), west: zahl('west'), ost: zahl('ost') },
            Number.isFinite(grenze) ? Math.min(Math.max(grenze, 1), 2000) : 500,
          ),
        },
      }
    },

    'POST /api/auth/login': (req, url, body) => {
      const result = domain.auth.login(body.identifier, body.password)
      if (!result.ok) return { status: 401, body: { error: result.error } }
      return {
        status: 200,
        body: { token: tokens.issue(result.user.id), user: result.user, mustChangePassword: result.mustChangePassword },
      }
    },

    'POST /api/auth/register': (req, url, body) => {
      const result = domain.auth.register(body)
      if (!result.ok) return { status: 409, body: { error: result.error } }
      return { status: 201, body: { token: tokens.issue(result.user.id), user: result.user } }
    },

    'POST /api/auth/password': (req, url, body) => {
      const userId = tokens.userIdFor(bearer(req))
      if (!userId) return { status: 401, body: { error: 'Nicht angemeldet' } }
      domain.auth.changePassword(userId, body.password)
      return { status: 200, body: { ok: true } }
    },

    'GET /api/auth/me': (req) => {
      const userId = tokens.userIdFor(bearer(req))
      if (!userId) return { status: 401, body: { error: 'Nicht angemeldet' } }
      return { status: 200, body: { user: domain.users.byId(userId), account: domain.auth.accountOf(userId) } }
    },

    'POST /api/auth/logout': (req) => {
      const token = bearer(req)
      if (token) tokens.revoke(token)
      return { status: 200, body: { ok: true } }
    },

    'POST /api/rpc': (req, url, body) =>
      callRpc({ method: body.method, args: body.args ?? [], token: bearer(req) }),

    /*
     * Alles auf den Auslieferungsstand zurück, nur für Angemeldete mit
     * Verwaltungsrechten.
     *
     * Vorher ging das ohne jeden Nachweis. Solange der Server nur auf dem
     * eigenen Rechner lief, war das bequem; hinter einem ngrok-Link ist es
     * ein offener Knopf zum Löschen aller Daten, den jeder findet, der die
     * Adresse kennt.
     */
    'POST /api/reset': (req) => {
      const userId = tokens.userIdFor(bearer(req))
      if (domain.auth.accountOf(userId)?.role !== 'admin') {
        return { status: 403, body: { error: 'Nur für die Verwaltung' } }
      }
      if (!store.reset) return { status: 404, body: { error: 'Nicht verfügbar' } }
      store.reset()
      return { status: 200, body: { ok: true } }
    },
  }

  return createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
    cors(res, req.headers.origin)

    /*
     * Gezählt wird am Ende der Antwort, nicht am Anfang: Nur so steht der
     * Status wirklich fest. Ein einziger Haken an `res` fängt jeden Weg
     * durch diese Funktion, auch die vorzeitigen Rückgaben weiter unten.
     */
    res.once('finish', () => zaehlen(url.pathname, res.statusCode))

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    /*
     * Kacheln: /api/karte/kachel/14/8512/5583.png
     *
     * Eigene Zeile statt Eintrag in der Tabelle, weil die Zahlen im Pfad
     * stehen. Die Antwort ist ein Bild, kein JSON, und sie kommt immer, zur
     * Not selbst gezeichnet (siehe karte.js).
     */
    const kachelTreffer = url.pathname.match(/^\/api\/karte\/kachel\/(\d+)\/(\d+)\/(\d+)\.png$/)
    if (req.method === 'GET' && kachelTreffer) {
      const [, z, x, y] = kachelTreffer
      const { inhalt, herkunft } = await kachel(Number(z), Number(x), Number(y))
      return bild(res, inhalt, { herkunft })
    }

    /*
     * Titelbild eines Betriebs: /api/bild/betrieb/marimer.svg
     *
     * Hat der Betrieb ein echtes Bild (`bildUrl`, aus OpenStreetMap oder
     * später vom Betrieb selbst), verweist die Antwort dorthin. Sonst wird
     * eines gezeichnet, siehe bilder.js, dort steht auch, warum.
     */
    const bildTreffer = url.pathname.match(/^\/api\/bild\/betrieb\/([^/]+)\.svg$/)
    if (req.method === 'GET' && bildTreffer) {
      const betrieb = domain.places.bySlug(decodeURIComponent(bildTreffer[1]))
      if (!betrieb) return json(res, 404, { error: 'Betrieb nicht gefunden' })
      if (betrieb.bildUrl) { res.writeHead(302, { location: betrieb.bildUrl }); return res.end() }
      return svg(res, titelbild(betrieb))
    }

    /* Gastro-Seite und Speisekarte lassen sich direkt abrufen. */
    const placeMatch = url.pathname.match(/^\/api\/g\/([^/]+)(\/speisekarte)?$/)
    if (req.method === 'GET' && placeMatch) {
      const place = domain.places.bySlug(decodeURIComponent(placeMatch[1]))
      if (!place) return json(res, 404, { error: 'Betrieb nicht gefunden' })
      return json(res, 200, placeMatch[2]
        ? { place, menu: domain.menu.get(place.id) }
        : { place, videos: domain.videos.byPlace(place.id), reviews: domain.reviews.byPlace(place.id) })
    }

    const handler = handlers[`${req.method} ${url.pathname}`]
    if (!handler) return json(res, 404, { error: 'Unbekannte Adresse', pfad: url.pathname })

    try {
      const body = req.method === 'POST' ? await readBody(req) : {}
      const { status, body: out } = await handler(req, url, body)
      if (status >= 400) log(`  ${status} ${req.method} ${url.pathname} ${out.error ?? ''} ${out.method ?? ''}`)
      return json(res, status, out)
    } catch (error) {
      log(`  500 ${req.method} ${url.pathname}, ${error.message}`)
      return json(res, 500, { error: error.message })
    }
  })
}
