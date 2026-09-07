import { createServer } from 'node:http'
import * as domain from '../domain/index.js'
import * as tokens from './tokens.js'
import { callRpc, listRoutes } from './rpc.js'

/**
 * Der HTTP-Server. Ohne Fremdabhängigkeiten — `npm install` lädt nichts nach,
 * `node src/index.js` genügt.
 *
 * Es gibt zwei Arten von Endpunkten:
 *
 *  - `/api/rpc`   ein Eingang für die gesamte Fachlogik. Was erlaubt ist,
 *                 steht in `rpc.js`, nicht im Frontend.
 *  - ein paar Leseadressen (`/api/places`, `/api/g/:slug`, …), damit man mit
 *    curl oder dem Browser nachsehen kann, ohne einen Aufruf zu formulieren.
 */

const json = (res, status, body) => {
  const text = JSON.stringify(body, null, 2)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

/** Der Browser fragt vor jedem Aufruf nach — daher die Freigabe. */
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

export function createApiServer({ store, seedData, log = console.log }) {
  domain.setStore(store)

  const handlers = {
    'GET /api/health': () => ({
      status: 200,
      body: { ok: true, aufrufe: listRoutes().length, sitzungen: tokens.count(), zeit: new Date().toISOString() },
    }),

    'GET /api/routes': () => ({ status: 200, body: { routes: listRoutes() } }),

    'GET /api/places': () => ({ status: 200, body: { result: domain.places.list({}) } }),

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
     * Alles auf den Auslieferungsstand zurück — nur für Angemeldete mit
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

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

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
      log(`  500 ${req.method} ${url.pathname} — ${error.message}`)
      return json(res, 500, { error: error.message })
    }
  })
}
