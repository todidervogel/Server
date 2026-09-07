import { db, update } from './store.js'
import { decoratePlace, dishRatingOf, publicUser } from './derive.js'

/** Vier Reiter über einer Abfrage (Konzept 8.8). */
export function run(query, { position, viewerId } = {}) {
  const data = db()
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return { dishes: [], places: [], locations: [], profiles: [] }

  const dishes = data.dishes
    .filter((d) => `${d.name} ${d.description}`.toLowerCase().includes(q))
    .map((d) => {
      const place = data.places.find((p) => p.id === d.placeId)
      return { ...d, ...dishRatingOf(d.id, data), place: place ? decoratePlace(place, { position, data, viewerId }) : null }
    })
    .filter((d) => d.place)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

  const matchedPlaces = data.places
    .filter((p) => `${p.name} ${p.cuisine} ${p.tags.join(' ')} ${p.address} ${p.city}`.toLowerCase().includes(q))
    .map((p) => decoratePlace(p, { position, data, viewerId }))
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))

  const locations = (data.locations ?? []).filter((l) => `${l.name} ${l.detail}`.toLowerCase().includes(q))

  const profiles = data.users
    .filter((u) => u.role === 'user' && u.status !== 'banned')
    .filter((u) => `${u.username} ${u.name}`.toLowerCase().includes(q))
    .map((u) => publicUser(u, data, viewerId))

  return { dishes, places: matchedPlaces, locations, profiles }
}

export function history() {
  return db().searchHistory ?? []
}

export function remember(query) {
  const q = String(query ?? '').trim()
  if (!q) return history()
  update((d) => ({ searchHistory: [q, ...(d.searchHistory ?? []).filter((x) => x !== q)].slice(0, 8) }))
  return history()
}

export function clearHistory() {
  update(() => ({ searchHistory: [] }))
  return []
}
