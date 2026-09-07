import { db } from './store.js'
import { decorateReview, ratingOf } from './derive.js'

/** Kennzahlen für das Gastro-Dashboard (F.4) — alles gerechnet, nichts gespeichert. */
export function dashboard(placeId) {
  const data = db()
  const own = data.videos.filter((v) => v.placeId === placeId)
  const list = data.reviews.filter((r) => r.placeId === placeId)
  const { rating } = ratingOf(placeId, data)

  return {
    views: own.reduce((sum, v) => sum + (v.views ?? 0), 0),
    videoCount: own.length,
    pending: own.filter((v) => v.status === 'pending_review').length,
    reviewCount: list.length,
    reviewsNew: list.filter((r) => !r.answer).length,
    rating,
    latest: list.slice(0, 3).map((r) => decorateReview(r, data)),
  }
}
