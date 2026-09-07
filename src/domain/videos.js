import { db, insert, nextId, patch, remove, update } from './store.js'
import { decorateVideo } from './derive.js'
import * as notifications from './notifications.js'
import * as admin from './admin.js'

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Feed-Reihenfolge nach Konzept 8.4: erst der Umkreis, dann eine Mischung aus
 * Aktualität, vorhandener Bewertung und Ortsprüfung. Gesehenes rutscht ans
 * Ende, eine kleine Zufallskomponente verhindert Stillstand.
 */
export function feed({ position, radiusKm = 5, userId, seed = 1 } = {}) {
  const data = db()
  const seen = new Set(data.seenVideos ?? [])

  const scored = data.videos
    .filter((v) => v.status === 'published')
    .filter((v) => v.visibility === 'public' || v.authorId === userId)
    .map((v) => decorateVideo(v, { position, data }))
    .filter((v) => v.place && (v.place.distanceKm ?? 0) <= radiusKm)
    .map((v) => {
      const age = (Date.now() - new Date(v.createdAt).getTime()) / 86400000
      const score =
        100 - age * 2 +
        (v.review ? 25 : 0) +
        (v.verifiedOnSite ? 15 : 0) +
        ((Math.sin((Number(v.id.replace(/\D/g, '')) + seed) * 12.9898) + 1) * 5) -
        (seen.has(v.id) ? 1000 : 0)
      return { ...v, score }
    })
    .sort((a, b) => b.score - a.score)

  /* Zu wenig in der Nähe? Dann sagt die Oberfläche das (Kaltstart, 8.4). */
  return { items: scored, widened: scored.length < 5 && radiusKm < 50, radiusKm }
}

export function byId(id, position) {
  const data = db()
  const video = data.videos.find((v) => v.id === id)
  return video ? decorateVideo(video, { position, data }) : null
}

export function byPlace(placeId, { includeAll = false } = {}) {
  const data = db()
  return data.videos
    .filter((v) => v.placeId === placeId)
    .filter((v) => includeAll || (v.status === 'published' && v.visibility === 'public'))
    .map((v) => decorateVideo(v, { data }))
}

export function byAuthor(authorId, { own = false } = {}) {
  const data = db()
  return data.videos
    .filter((v) => v.authorId === authorId)
    .filter((v) => own || (v.status === 'published' && v.visibility === 'public'))
    .map((v) => decorateVideo(v, { data }))
}

/** Warteschlange der Freigabe (G.3). */
export function pending() {
  const data = db()
  return data.videos.filter((v) => v.status === 'pending_review').map((v) => decorateVideo(v, { data }))
}

export function create(data) {
  const row = {
    id: nextId('videos', 'v'),
    views: 0,
    verifiedOnSite: false,
    visibility: 'public',
    /* Im MVP wird jedes Video vor der Veröffentlichung geprüft (8.9). */
    status: 'pending_review',
    authorType: 'user',
    createdAt: today(),
    placeId: data.placeId,
    authorId: data.authorId,
    caption: String(data.caption ?? '').slice(0, 300),
    durationSec: Math.min(Math.max(Number(data.durationSec) || 1, 1), 60),
    ...(data.verifiedOnSite != null ? { verifiedOnSite: !!data.verifiedOnSite } : {}),
    ...(data.visibility ? { visibility: data.visibility } : {}),
    ...(data.authorType ? { authorType: data.authorType } : {}),
  }
  insert('videos', row)
  return row
}

export function moderate(id, status, reason, who = 'system') {
  patch('videos', id, { status, rejectReason: reason ?? null })
  const video = db().videos.find((v) => v.id === id)
  if (video) {
    notifications.create({
      userId: video.authorId,
      type: status === 'published' ? 'approved' : 'rejected',
      text: status === 'published'
        ? 'Dein Video wurde freigegeben und ist jetzt sichtbar.'
        : 'Dein Video wurde nicht freigegeben.',
    })
  }
  admin.log(status === 'published' ? 'Video freigegeben' : 'Video abgelehnt', id, reason ?? '', who)
  return true
}

export function setVisibility(id, visibility) {
  patch('videos', id, { visibility })
  return true
}

export function removeVideo(id) {
  remove('videos', (v) => v.id === id)
  remove('reviews', (r) => r.videoId === id)
  return true
}

export function markSeen(id) {
  update((d) => (d.seenVideos?.includes(id) ? null : { seenVideos: [...(d.seenVideos ?? []), id] }))
  return true
}

/** Wem gehört dieses Video? Für die Rechteprüfung. */
export function ownerOf(id) {
  const video = db().videos.find((v) => v.id === id)
  return video ? { authorId: video.authorId, placeId: video.placeId } : null
}
