import * as auth from './auth.js'
import * as places from './places.js'
import * as menu from './menu.js'
import * as videos from './videos.js'
import * as reviews from './reviews.js'
import * as social from './social.js'
import * as users from './users.js'
import * as notifications from './notifications.js'
import * as reports from './reports.js'
import * as admin from './admin.js'
import * as search from './search.js'
import * as gastro from './gastro.js'

/**
 * Die Aufrufliste — was es gibt und wer es darf.
 *
 * Es gibt keinen freien Zugriff auf die Fachlogik: Jeder Aufruf muss hier
 * stehen, und zu jedem gehört eine Regel. Diese Datei benutzen beide Wirte —
 * der Server hinter der Anmeldung mit Token, die Website im Alleinbetrieb mit
 * der lokalen Sitzung. Dadurch verhalten sich beide gleich, und die Regeln
 * stehen nur einmal irgendwo.
 *
 *   who: 'public'  jeder, auch ohne Anmeldung
 *        'user'    angemeldet
 *        'gastro'  Gastro-Konto (oder Verwaltung)
 *        'admin'   nur Verwaltung
 *
 *   guard  zusätzlich: Gehört das angefasste Objekt überhaupt dazu?
 */

/** Wer sieht gerade zu? Danach richtet sich, was als „gemerkt" gilt. */
const viewerOf = (ctx) => ctx.account?.id ?? null

/** Gehört dieser Betrieb zum angemeldeten Gastro-Konto? */
function ownsPlace(ctx, placeId) {
  if (ctx.account?.role === 'admin') return true
  return !!placeId && ctx.account?.placeId === placeId
}

const CALLS = {
  /* --- Betriebe ---------------------------------------------------------- */
  'places.list': { who: 'public', call: (ctx, [filters]) => places.list({ ...filters, viewerId: viewerOf(ctx) }) },
  'places.bySlug': { who: 'public', call: (ctx, [slug, position]) => places.bySlug(slug, position, viewerOf(ctx)) },
  'places.byId': { who: 'public', call: (ctx, [id, position]) => places.byId(id, position, viewerOf(ctx)) },
  'places.nearby': { who: 'public', call: (ctx, [position, limit]) => places.nearby(position, limit, viewerOf(ctx)) },
  'places.save': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, id),
    call: (ctx, [id, changes]) => places.save(id, changes ?? {}),
  },
  'places.setStatus': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, id),
    call: (ctx, [id, status]) => places.setStatus(id, status),
  },

  /* --- Speisekarte ------------------------------------------------------- */
  'menu.get': { who: 'public', call: (ctx, [placeId]) => menu.get(placeId) },
  'menu.dishes': { who: 'public', call: (ctx, [placeId]) => menu.dishes(placeId) },
  'menu.addCategory': {
    who: 'gastro',
    guard: (ctx, [placeId]) => ownsPlace(ctx, placeId),
    call: (ctx, [placeId, name]) => menu.addCategory(placeId, name),
  },
  'menu.updateCategory': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, menu.placeOfCategory(id)),
    call: (ctx, [id, changes]) => menu.updateCategory(id, changes ?? {}),
  },
  'menu.removeCategory': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, menu.placeOfCategory(id)),
    call: (ctx, [id]) => menu.removeCategory(id),
  },
  'menu.moveCategory': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, menu.placeOfCategory(id)),
    call: (ctx, [id, direction]) => menu.moveCategory(id, direction),
  },
  'menu.addDish': {
    who: 'gastro',
    guard: (ctx, [placeId]) => ownsPlace(ctx, placeId),
    call: (ctx, [placeId, categoryId, dish]) => menu.addDish(placeId, categoryId, dish ?? {}),
  },
  'menu.updateDish': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, menu.placeOfDish(id)),
    call: (ctx, [id, changes]) => menu.updateDish(id, changes ?? {}),
  },
  'menu.removeDish': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, menu.placeOfDish(id)),
    call: (ctx, [id]) => menu.removeDish(id),
  },

  /* --- Videos ------------------------------------------------------------ */
  'videos.feed': { who: 'public', call: (ctx, [options]) => videos.feed({ ...options, userId: viewerOf(ctx), viewerId: viewerOf(ctx) }) },
  'videos.byId': { who: 'public', call: (ctx, [id, position]) => videos.byId(id, position, viewerOf(ctx)) },
  'videos.byPlace': {
    who: 'public',
    call: (ctx, [placeId, options]) =>
      videos.byPlace(placeId, { includeAll: !!options?.includeAll && ownsPlace(ctx, placeId), viewerId: viewerOf(ctx) }),
  },
  'videos.byAuthor': {
    who: 'public',
    /* Den vollständigen Bestand sieht nur, wem er gehört. */
    call: (ctx, [authorId, options]) =>
      videos.byAuthor(authorId, { own: !!options?.own && viewerOf(ctx) === authorId, viewerId: viewerOf(ctx) }),
  },
  'videos.create': {
    who: 'user',
    call: (ctx, [data]) => videos.create({ ...data, authorId: ctx.account.id }),
  },
  'videos.setVisibility': {
    who: 'user',
    guard: (ctx, [id]) => {
      const owner = videos.ownerOf(id)
      return owner?.authorId === ctx.account.id || ownsPlace(ctx, owner?.placeId)
    },
    call: (ctx, [id, visibility]) => videos.setVisibility(id, visibility),
  },
  'videos.remove': {
    who: 'user',
    guard: (ctx, [id]) => {
      const owner = videos.ownerOf(id)
      return owner?.authorId === ctx.account.id || ownsPlace(ctx, owner?.placeId)
    },
    call: (ctx, [id]) => videos.removeVideo(id),
  },
  'videos.markSeen': { who: 'public', call: (ctx, [id]) => videos.markSeen(id) },
  'videos.pending': { who: 'admin', call: () => videos.pending() },
  'videos.moderate': {
    who: 'admin',
    call: (ctx, [id, status, reason]) => videos.moderate(id, status, reason, ctx.account.email),
  },

  /* --- Bewertungen ------------------------------------------------------- */
  'reviews.byPlace': { who: 'public', call: (ctx, [placeId, options]) => reviews.byPlace(placeId, { ...options, viewerId: viewerOf(ctx) }) },
  'reviews.byAuthor': { who: 'public', call: (ctx, [authorId]) => reviews.byAuthor(authorId, viewerOf(ctx)) },
  'reviews.create': {
    who: 'user',
    call: (ctx, [data]) => reviews.create({ ...data, authorId: ctx.account.id }),
  },
  'reviews.answer': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, reviews.placeOf(id)),
    call: (ctx, [id, text]) => reviews.answer(id, text),
  },
  'reviews.like': { who: 'user', call: (ctx, [id]) => reviews.like(id) },

  /* --- Soziales ---------------------------------------------------------- */
  'social.toggleLike': { who: 'user', call: (ctx, [, videoId]) => social.toggleLike(ctx.account.id, videoId) },
  'social.toggleSave': { who: 'user', call: (ctx, [, type, targetId]) => social.toggleSave(ctx.account.id, type, targetId) },
  'social.toggleFollow': { who: 'user', call: (ctx, [, targetId]) => social.toggleFollow(ctx.account.id, targetId) },
  'social.saved': { who: 'user', call: (ctx, [, type]) => social.saved(ctx.account.id, type) },
  'social.stateFor': { who: 'user', call: (ctx, [, ids]) => social.stateFor(ctx.account.id, ids ?? {}) },

  /* --- Nutzer ------------------------------------------------------------ */
  'users.byUsername': { who: 'public', call: (ctx, [username]) => users.byUsername(username, viewerOf(ctx)) },
  'users.byId': { who: 'public', call: (ctx, [id]) => users.byId(id, viewerOf(ctx)) },
  'users.save': { who: 'user', call: (ctx, [, changes]) => users.save(ctx.account.id, changes ?? {}) },
  'users.exportData': { who: 'user', call: (ctx) => users.exportData(ctx.account.id) },
  'users.deleteAccount': { who: 'user', call: (ctx) => users.deleteAccount(ctx.account.id) },
  'users.setStatus': { who: 'admin', call: (ctx, [id, status]) => users.setStatus(id, status, ctx.account.email) },

  /* --- Benachrichtigungen ------------------------------------------------ */
  'notifications.list': { who: 'user', call: (ctx) => notifications.list(ctx.account.id) },
  'notifications.unreadCount': { who: 'user', call: (ctx) => notifications.unreadCount(ctx.account.id) },
  'notifications.markAllRead': { who: 'user', call: (ctx) => notifications.markAllRead(ctx.account.id) },

  /* --- Meldungen --------------------------------------------------------- */
  'reports.create': {
    who: 'user',
    call: (ctx, [data]) => reports.create({ ...data, reporterId: ctx.account.id }),
  },
  'reports.list': { who: 'admin', call: (ctx, [options]) => reports.list(options ?? {}) },
  'reports.resolve': {
    who: 'admin',
    call: (ctx, [id, status]) => reports.resolve(id, status, ctx.account.id, ctx.account.email),
  },

  /* --- Verwaltung -------------------------------------------------------- */
  'admin.overview': { who: 'admin', call: () => admin.overview() },
  'admin.users': { who: 'admin', call: () => admin.users() },
  'admin.places': { who: 'admin', call: () => admin.places() },
  'admin.invites': { who: 'admin', call: () => admin.invites() },
  'admin.createInvite': { who: 'admin', call: (ctx, [placeId, email]) => admin.createInvite(placeId, email, ctx.account.email) },
  'admin.resendInvite': { who: 'admin', call: (ctx, [id]) => admin.resendInvite(id) },
  'admin.suggestions': { who: 'admin', call: () => admin.suggestions() },
  'admin.resolveSuggestion': { who: 'admin', call: (ctx, [id, status]) => admin.resolveSuggestion(id, status, ctx.account.email) },
  'admin.auditLog': { who: 'admin', call: () => admin.auditLog() },
  'admin.setClaimStatus': { who: 'admin', call: (ctx, [id, status]) => places.setClaimStatus(id, status) },

  /* Wer einen Betrieb übernehmen will, meldet sich — ohne Konto. */
  'admin.suggestPlace': { who: 'public', call: (ctx, [data]) => admin.createSuggestion(data ?? {}) },
  'admin.requestClaim': {
    who: 'public',
    call: (ctx, [placeId, email]) => {
      if (placeId) places.setClaimStatus(placeId, 'pending')
      return admin.createInvite(placeId, email, 'anfrage')
    },
  },

  /* --- Suche ------------------------------------------------------------- */
  'search.run': { who: 'public', call: (ctx, [query, options]) => search.run(query, { ...options, viewerId: viewerOf(ctx) }) },
  'search.history': { who: 'public', call: () => search.history() },
  'search.remember': { who: 'public', call: (ctx, [query]) => search.remember(query) },
  'search.clearHistory': { who: 'public', call: () => search.clearHistory() },

  /* --- Gastro ------------------------------------------------------------ */
  'gastro.dashboard': {
    who: 'gastro',
    guard: (ctx, [placeId]) => ownsPlace(ctx, placeId),
    call: (ctx, [placeId]) => gastro.dashboard(placeId),
  },
}

const RANK = { public: 0, user: 1, gastro: 2, admin: 3 }

function allowed(route, account) {
  if (route.who === 'public') return true
  if (!account) return false
  if (account.status === 'banned') return false
  if (route.who === 'user') return true
  if (route.who === 'gastro') return account.role === 'gastro' || account.role === 'admin'
  if (route.who === 'admin') return account.role === 'admin'
  return false
}

export function listCalls() {
  return Object.entries(CALLS)
    .map(([name, route]) => ({ name, who: route.who }))
    .sort((a, b) => RANK[a.who] - RANK[b.who] || a.name.localeCompare(b.name))
}

export const hasCall = (method) => Object.hasOwn(CALLS, method)

/**
 * Führt einen Aufruf aus. Gibt immer `{ status, body }` zurück — auch im
 * Fehlerfall, damit beide Wirte dasselbe weiterreichen können.
 */
export function invoke(method, args = [], account = null) {
  const route = CALLS[method]
  if (!route) return { status: 404, body: { error: 'Unbekannter Aufruf', method } }

  const ctx = { account }

  if (!allowed(route, account)) {
    return { status: account ? 403 : 401, body: { error: 'Nicht erlaubt', method, who: route.who } }
  }
  if (route.guard && !route.guard(ctx, args)) {
    return { status: 403, body: { error: 'Nicht für dieses Objekt zuständig', method } }
  }

  try {
    return { status: 200, body: { result: route.call(ctx, args) ?? null } }
  } catch (error) {
    return { status: 400, body: { error: error.message } }
  }
}
