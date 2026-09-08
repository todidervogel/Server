import { db } from './store.js'
import { distanceKm } from './geo.js'
import { openLabel } from './hours.js'

/**
 * Abgeleitete Werte.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  fast jede Datei in src/domain/   decoratePlace, decorateVideo, publicUser│
 * │  src/domain/geo.js                für die Entfernung                     │
 * │  src/domain/hours.js              für „jetzt geöffnet"                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Durchschnittsbewertungen, Videoanzahl, Entfernung und Öffnungsstatus stehen
 * nicht in den Daten, sondern werden bei jeder Abfrage berechnet. Auf einer
 * echten Datenbank wäre das eine Sicht („materialized view"); hier ist es eine
 * Funktion. Vorteil: Es gibt keine gespeicherten Zahlen, die auseinanderlaufen.
 */

const avg = (values) => {
  const list = values.filter((v) => typeof v === 'number')
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null
}

/** Die drei Achsen bleiben getrennt — nie zu einer Zahl zusammenfassen. */
export function ratingOf(placeId, data = db()) {
  const list = data.reviews.filter((r) => r.placeId === placeId)
  if (list.length === 0) return { rating: null, reviewCount: 0 }
  return {
    reviewCount: list.length,
    rating: {
      food: avg(list.map((r) => r.ratingFood)),
      service: avg(list.map((r) => r.ratingService)),
      price: avg(list.map((r) => r.ratingPrice)),
    },
  }
}

/** Bewertung eines einzelnen Gerichts über alle Bewertungen hinweg. */
export function dishRatingOf(dishId, data = db()) {
  const marks = data.reviews
    .flatMap((r) => r.dishes ?? [])
    .filter((d) => d.dishId === dishId && typeof d.rating === 'number')
    .map((d) => d.rating)
  return { rating: avg(marks), ratingCount: marks.length }
}

/**
 * Was von einem Konto öffentlich sichtbar ist — nie das Passwort.
 *
 * `viewerId` ist, wer gerade zusieht. Ob diese Person schon folgt, reist mit
 * den Daten mit: Sonst müsste die Oberfläche für jede Zeile einzeln nachfragen,
 * und über das Netz ginge das gar nicht synchron.
 */
export function publicUser(user, data = db(), viewerId = null) {
  if (!user) return null
  const { password, ...rest } = user
  return {
    ...rest,
    viewerFollow: viewerId
      ? (data.follows.find((f) => f.followerId === viewerId && f.followingId === user.id)?.status ?? 'none')
      : 'none',
    videoCount: data.videos.filter((v) => v.authorId === user.id && v.status === 'published').length,
    reviewCount: data.reviews.filter((r) => r.authorId === user.id).length,
    followerCount: data.follows.filter((f) => f.followingId === user.id && f.status === 'accepted').length,
    followingCount: data.follows.filter((f) => f.followerId === user.id && f.status === 'accepted').length,
  }
}

/** Hängt an einen Betrieb alles, was sich aus anderen Tabellen ergibt. */
export function decoratePlace(place, { position, data = db(), now, viewerId = null } = {}) {
  const km = position ? distanceKm(position, place) : null
  const published = data.videos.filter(
    (v) => v.placeId === place.id && v.status === 'published' && v.visibility === 'public',
  )
  return {
    ...place,
    ...ratingOf(place.id, data),
    distanceKm: km,
    videoCount: published.length,
    ...openLabel(place.hours, now),
    verified: place.claimStatus === 'verified',
    viewerSaved: viewerId
      ? data.saves.some((s) => s.userId === viewerId && s.type === 'place' && s.targetId === place.id)
      : false,
  }
}

export function decorateVideo(video, { position, data = db(), now, viewerId = null } = {}) {
  const place = data.places.find((p) => p.id === video.placeId)
  const author = data.users.find((u) => u.id === video.authorId)
  return {
    ...video,
    place: place ? decoratePlace(place, { position, data, now, viewerId }) : null,
    author: author ? publicUser(author, data, viewerId) : null,
    review: data.reviews.find((r) => r.videoId === video.id) ?? null,
    likeCount: data.likes.filter((l) => l.videoId === video.id).length,
    viewerLiked: viewerId ? data.likes.some((l) => l.userId === viewerId && l.videoId === video.id) : false,
    viewerSaved: viewerId
      ? data.saves.some((s) => s.userId === viewerId && s.type === 'video' && s.targetId === video.id)
      : false,
  }
}

export function decorateReview(review, data = db(), viewerId = null) {
  const author = data.users.find((u) => u.id === review.authorId)
  const place = data.places.find((p) => p.id === review.placeId)
  return {
    ...review,
    author: author ? publicUser(author, data, viewerId) : null,
    placeName: place?.name,
    placeSlug: place?.slug,
    rating: { food: review.ratingFood, service: review.ratingService, price: review.ratingPrice },
  }
}
