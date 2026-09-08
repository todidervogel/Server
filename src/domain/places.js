import { db, patch } from './store.js'
import { decoratePlace } from './derive.js'

/**
 * Betriebe.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/domain/calls.js   places.list / bySlug / byId / nearby / inBounds   │
 * │  src/http/server.js    GET /api/places, /api/g/:slug, /api/karte/…       │
 * │  src/domain/derive.js  rechnet Entfernung, Bewertung und Öffnung dazu    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const PRICE_ORDER = ['€', '€€', '€€€', '€€€€']
const today = () => new Date().toISOString().slice(0, 10)

function applyFilters(list, f) {
  let out = list
  if (f.query) {
    const q = f.query.toLowerCase()
    out = out.filter((p) =>
      [p.name, p.cuisine, p.address, p.city, ...(p.tags ?? [])].join(' ').toLowerCase().includes(q))
  }
  if (f.categories?.length) out = out.filter((p) => f.categories.includes(p.category))
  /* Angebot wirkt als Und: gezeigt wird, wer alles Ausgewählte anbietet. */
  if (f.serving?.length) out = out.filter((p) => f.serving.every((s) => p.serving?.includes(s)))
  if (f.prices?.length) out = out.filter((p) => f.prices.includes(p.price))
  if (f.openNow) out = out.filter((p) => p.open)
  if (f.onlyVideos) out = out.filter((p) => p.videoCount > 0)
  if (f.minRating) out = out.filter((p) => (p.rating?.food ?? 0) >= f.minRating)
  if (f.radiusKm) out = out.filter((p) => p.distanceKm == null || p.distanceKm <= f.radiusKm)
  return out
}

function sortPlaces(list, sort) {
  const copy = [...list]
  if (sort === 'rating') return copy.sort((a, b) => (b.rating?.food ?? 0) - (a.rating?.food ?? 0))
  if (sort === 'videos') return copy.sort((a, b) => b.videoCount - a.videoCount)
  if (sort === 'priceAsc') return copy.sort((a, b) => PRICE_ORDER.indexOf(a.price) - PRICE_ORDER.indexOf(b.price))
  return copy.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))
}

/* ==========================================================================
   Vorfiltern, bevor gerechnet wird
   ========================================================================== */

/**
 * Liegt der Betrieb im Rechteck?
 *
 * Dieselbe Rechnung wie in `inBounds`, hier für die Liste. Über den 180.
 * Längengrad hinweg wird das Rechteck geteilt.
 */
function imAusschnitt(p, { nord, sued, west, ost }) {
  if (![nord, sued, west, ost].every(Number.isFinite)) return true
  if (p.lat < sued || p.lat > nord) return false
  return west <= ost ? p.lng >= west && p.lng <= ost : p.lng >= west || p.lng <= ost
}

/**
 * Grobe Umkreisprüfung, ohne Wurzel und ohne Winkelfunktionen je Betrieb.
 *
 * ┌─ Warum das sein muss ────────────────────────────────────────────────────┐
 * │  `decoratePlace` rechnet Entfernung, Öffnung, Bewertungsschnitt und      │
 * │  Videozahl. Das ist für einen Betrieb nichts und für zwölftausend viel.  │
 * │  Seit der Bestand ganz Deutschland umfasst, lief das bei jedem           │
 * │  Tastendruck in der Suche einmal komplett durch.                         │
 * │                                                                          │
 * │  Also erst grob aussortieren, dann rechnen. Das Kästchen ist absichtlich │
 * │  großzügig: Es darf zu viel durchlassen, denn die genaue Prüfung kommt   │
 * │  danach in `applyFilters`. Es darf nur nichts verlieren.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
function grobImUmkreis(p, position, radiusKm) {
  if (!position || !Number.isFinite(radiusKm)) return true
  const gradBreite = radiusKm / 111.32
  const kosinus = Math.cos((position.lat * Math.PI) / 180)
  /* An den Polen wird der Nenner winzig, dann lassen wir alles durch. */
  const gradLaenge = Math.abs(kosinus) < 0.01 ? 180 : radiusKm / (111.32 * kosinus)
  return Math.abs(p.lat - position.lat) <= gradBreite
    && Math.abs(p.lng - position.lng) <= Math.abs(gradLaenge)
}

/**
 * Die Liste der Betriebe.
 *
 * `bounds` ist der Kartenausschnitt, `limit` die Obergrenze. Beide kommen von
 * der Karte, die nur zeigt, was gerade im Bild liegt. Ohne beides verhält
 * sich die Liste wie vorher.
 */
export function list(filters = {}) {
  const data = db()

  const roh = data.places
    .filter((p) => p.status !== 'archived')
    .filter((p) => (filters.bounds ? imAusschnitt(p, filters.bounds) : true))
    .filter((p) => grobImUmkreis(p, filters.position, filters.radiusKm))

  const all = roh.map((p) => decoratePlace(p, { position: filters.position, data, viewerId: filters.viewerId }))
  const sortiert = sortPlaces(applyFilters(all, filters), filters.sort)

  const grenze = Number.isFinite(filters.limit) ? Math.min(Math.max(filters.limit, 1), 1000) : null
  return grenze ? sortiert.slice(0, grenze) : sortiert
}

export function bySlug(slug, position, viewerId) {
  const data = db()
  const place = data.places.find((p) => p.slug === slug)
  return place ? decoratePlace(place, { position, data, viewerId }) : null
}

export function byId(id, position, viewerId) {
  const data = db()
  const place = data.places.find((p) => p.id === id)
  return place ? decoratePlace(place, { position, data, viewerId }) : null
}

/** Nächstgelegene Betriebe, für die Betriebswahl beim Hochladen (E.3). */
export function nearby(position, limit = 8, viewerId) {
  const data = db()
  const all = data.places.map((p) => decoratePlace(p, { position, data, viewerId }))
  return sortPlaces(all, 'distance').slice(0, limit)
}

/**
 * Was in einem Kartenausschnitt liegt.
 *
 * Für die Karte, nicht für eine Liste: Zurück kommt nur, was ein Marker
 * braucht. Ein vollständiger Betrieb mit Bewertungen, Öffnungszeiten und
 * Entfernung ist ein Vielfaches an Daten, bei ein paar hundert Markern
 * merkt man das auf dem Handy sofort.
 *
 * Der Ausschnitt kommt als Rechteck: `nord`/`sued` sind Breitengrade,
 * `west`/`ost` Längengrade. Über den 180. Längengrad hinweg wird das
 * Rechteck geteilt, sonst wäre bei einer Karte des Pazifiks plötzlich
 * alles außerhalb.
 */
export function inBounds({ nord, sued, west, ost } = {}, limit = 500) {
  if (![nord, sued, west, ost].every(Number.isFinite)) return []

  const imLaengengrad = west <= ost
    ? (lng) => lng >= west && lng <= ost
    : (lng) => lng >= west || lng <= ost

  return db().places
    .filter((p) => p.status !== 'archived')
    .filter((p) => p.lat >= sued && p.lat <= nord && imLaengengrad(p.lng))
    .slice(0, limit)
    .map((p) => ({
      id: p.id, slug: p.slug, name: p.name, lat: p.lat, lng: p.lng,
      category: p.category, price: p.price, cuisine: p.cuisine, status: p.status,
    }))
}

/** Nur Felder, die ein Betrieb selbst pflegen darf. */
const EDITABLE = [
  'name', 'address', 'zip', 'city', 'phone', 'website', 'description',
  'tags', 'price', 'serving', 'features', 'hours', 'menuNote', 'cuisine', 'category',
]

export function save(id, changes) {
  const allowed = Object.fromEntries(Object.entries(changes).filter(([key]) => EDITABLE.includes(key)))
  patch('places', id, allowed)
  return true
}

export function setStatus(id, status) {
  patch('places', id, { status, closingSince: status === 'closing' ? today() : null })
  return true
}

export function setClaimStatus(id, claimStatus, claimedBy = null) {
  patch('places', id, { claimStatus, ...(claimedBy ? { claimedBy } : {}) })
  return true
}
