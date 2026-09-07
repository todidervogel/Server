import { db, insert, remove } from './store.js'
import { decoratePlace, decorateVideo } from './derive.js'
import * as notifications from './notifications.js'

export function isLiked(userId, videoId) {
  return db().likes.some((l) => l.userId === userId && l.videoId === videoId)
}

export function toggleLike(userId, videoId) {
  const liked = isLiked(userId, videoId)
  if (liked) remove('likes', (l) => l.userId === userId && l.videoId === videoId)
  else insert('likes', { userId, videoId })
  return !liked
}

export function isSaved(userId, type, targetId) {
  return db().saves.some((s) => s.userId === userId && s.type === type && s.targetId === targetId)
}

export function toggleSave(userId, type, targetId) {
  const saved = isSaved(userId, type, targetId)
  if (saved) remove('saves', (s) => s.userId === userId && s.type === type && s.targetId === targetId)
  else insert('saves', { userId, type, targetId })
  return !saved
}

export function saved(userId, type) {
  const data = db()
  const ids = data.saves.filter((s) => s.userId === userId && s.type === type).map((s) => s.targetId)
  if (type === 'place') {
    return data.places.filter((p) => ids.includes(p.id)).map((p) => decoratePlace(p, { data, viewerId: userId }))
  }
  return data.videos.filter((v) => ids.includes(v.id)).map((v) => decorateVideo(v, { data, viewerId: userId }))
}

export function followState(userId, targetId) {
  return db().follows.find((f) => f.followerId === userId && f.followingId === targetId)?.status ?? 'none'
}

/** Privaten Profilen folgt man erst nach Zustimmung — daher „pending". */
export function toggleFollow(userId, targetId) {
  if (userId === targetId) return 'none'
  if (followState(userId, targetId) !== 'none') {
    remove('follows', (f) => f.followerId === userId && f.followingId === targetId)
    return 'none'
  }
  const data = db()
  const target = data.users.find((u) => u.id === targetId)
  const status = target?.private ? 'pending' : 'accepted'
  insert('follows', { followerId: userId, followingId: targetId, status })
  if (status === 'accepted') {
    const me = data.users.find((u) => u.id === userId)
    notifications.create({ userId: targetId, type: 'follow', actor: me?.username, text: 'folgt dir jetzt.' })
  }
  return status
}

/** Alle Zustände zu einem Video auf einmal — spart Einzelabfragen. */
export function stateFor(userId, { videoIds = [], placeIds = [], userIds = [] } = {}) {
  const data = db()
  return {
    likedVideos: data.likes.filter((l) => l.userId === userId && videoIds.includes(l.videoId)).map((l) => l.videoId),
    savedVideos: data.saves.filter((s) => s.userId === userId && s.type === 'video' && videoIds.includes(s.targetId)).map((s) => s.targetId),
    savedPlaces: data.saves.filter((s) => s.userId === userId && s.type === 'place' && placeIds.includes(s.targetId)).map((s) => s.targetId),
    follows: Object.fromEntries(
      data.follows.filter((f) => f.followerId === userId && userIds.includes(f.followingId))
        .map((f) => [f.followingId, f.status]),
    ),
  }
}
