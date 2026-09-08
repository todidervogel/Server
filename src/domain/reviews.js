import { db, insert, nextId, patch } from './store.js'
import { decorateReview } from './derive.js'
import * as notifications from './notifications.js'

/**
 * Bewertungen.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/domain/calls.js    reviews.byPlace / create / answer / like         │
 * │  src/domain/derive.js   rechnet daraus die Durchschnitte je Betrieb      │
 * │  src/domain/videos.js   hängt die Bewertung an ihr Video                 │
 * │  src/domain/users.js    anonymisiert sie beim Löschen des Kontos         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Drei Achsen, Essen, Service, Preis, und sie bleiben getrennt. Eine
 * Gesamtnote wäre bequemer und würde genau das verstecken, worauf es ankommt:
 * dass „gutes Essen, lahmer Service" etwas anderes ist als „mittelmäßig".
 */

const today = () => new Date().toISOString().slice(0, 10)
const star = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : null
}

/**
 * Der Durchschnitt einer einzelnen Bewertung über die drei Achsen.
 *
 * Nur zum Sortieren. Angezeigt bleiben die drei Werte getrennt, denn genau
 * das ist der Punkt an drei Achsen.
 */
function schnitt(r) {
  const werte = [r.ratingFood, r.ratingService, r.ratingPrice].filter((n) => Number.isFinite(n))
  return werte.length ? werte.reduce((a, b) => a + b, 0) / werte.length : 0
}

/**
 * Bewertungen eines Betriebs.
 *
 * `sort` kam mit der Oberfläche dazu: Das Sortiermenü auf der Betriebsseite
 * und im Gastro-Bereich stand vorher da und tat nichts. Ein Menü, das nur
 * zuklappt, ist kein Menü.
 *
 *   'neu'    die jüngste zuerst (Vorgabe)
 *   'beste'  die mit dem höchsten Schnitt zuerst
 */
export function byPlace(placeId, { filter = 'all', sort = 'neu', viewerId } = {}) {
  const data = db()
  let list = data.reviews.filter((r) => r.placeId === placeId)
  if (filter === 'withVideo') list = list.filter((r) => r.videoId)
  if (filter === 'verified') list = list.filter((r) => r.verifiedOnSite)

  const sortiert = [...list].sort((a, b) => (sort === 'beste'
    ? schnitt(b) - schnitt(a)
    : String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))))

  return sortiert.map((r) => decorateReview(r, data, viewerId))
}

export function byAuthor(authorId, viewerId) {
  const data = db()
  return data.reviews.filter((r) => r.authorId === authorId).map((r) => decorateReview(r, data, viewerId))
}

export function create(input) {
  const row = {
    id: nextId('reviews', 'r'),
    createdAt: today(),
    likes: 0,
    answer: null,
    videoId: input.videoId ?? null,
    placeId: input.placeId,
    authorId: input.authorId,
    verifiedOnSite: !!input.verifiedOnSite,
    ratingFood: star(input.ratingFood),
    ratingService: star(input.ratingService),
    ratingPrice: star(input.ratingPrice),
    foodHot: input.foodHot ?? null,
    groupSize: Number.isFinite(Number(input.groupSize)) ? Number(input.groupSize) : null,
    dishes: (input.dishes ?? []).slice(0, 20).map((d) => ({
      dishId: d.dishId ?? null,
      name: String(d.name ?? '').slice(0, 120),
      rating: star(d.rating),
    })),
    text: String(input.text ?? '').slice(0, 1000),
  }
  insert('reviews', row)
  return row
}

/** Antwort des Betriebs. Die Autorin oder der Autor erfährt davon. */
export function answer(id, text) {
  patch('reviews', id, { answer: { text: String(text).slice(0, 500), createdAt: today() } })
  const data = db()
  const review = data.reviews.find((r) => r.id === id)
  const place = data.places.find((p) => p.id === review?.placeId)
  if (review) {
    notifications.create({
      userId: review.authorId,
      type: 'reply',
      actor: place?.name,
      text: 'hat auf deine Bewertung geantwortet.',
    })
  }
  return true
}

export function like(id) {
  patch('reviews', id, (r) => ({ likes: (r.likes ?? 0) + 1 }))
  return true
}

export function placeOf(id) {
  return db().reviews.find((r) => r.id === id)?.placeId ?? null
}
