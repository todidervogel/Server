import { db, patch } from './store.js'
import { decoratePlace } from './derive.js'

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

export function list(filters = {}) {
  const data = db()
  const all = data.places
    .filter((p) => p.status !== 'archived')
    .map((p) => decoratePlace(p, { position: filters.position, data, viewerId: filters.viewerId }))
  return sortPlaces(applyFilters(all, filters), filters.sort)
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

/** Nächstgelegene Betriebe — für die Betriebswahl beim Hochladen (E.3). */
export function nearby(position, limit = 8, viewerId) {
  const data = db()
  const all = data.places.map((p) => decoratePlace(p, { position, data, viewerId }))
  return sortPlaces(all, 'distance').slice(0, limit)
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
