import { db, insert, nextId, patch } from './store.js'
import { decorateReview } from './derive.js'
import * as notifications from './notifications.js'

const today = () => new Date().toISOString().slice(0, 10)
const star = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : null
}

export function byPlace(placeId, { filter = 'all', viewerId } = {}) {
  const data = db()
  let list = data.reviews.filter((r) => r.placeId === placeId)
  if (filter === 'withVideo') list = list.filter((r) => r.videoId)
  if (filter === 'verified') list = list.filter((r) => r.verifiedOnSite)
  return list.map((r) => decorateReview(r, data, viewerId))
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
