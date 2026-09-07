import * as domain from '../domain/index.js'
import * as tokens from './tokens.js'

/**
 * Die Aufrufliste.
 *
 * Es gibt genau einen Endpunkt (`POST /api/rpc`), aber keinen freien Zugriff:
 * Jeder Aufruf muss hier stehen, und zu jedem Aufruf gehört eine Regel, wer
 * ihn machen darf. Was das Frontend prüft, ist Bequemlichkeit — verbindlich
 * ist allein diese Datei.
 *
 *   who: 'public'  jeder, auch ohne Anmeldung
 *        'user'    angemeldet
 *        'gastro'  Gastro-Konto (oder Admin)
 *        'admin'   nur Verwaltung
 *        'self'    angemeldet, und `guard` prüft die Zugehörigkeit
 */

const asUser = (ctx) => ctx.account?.id ?? null

/** Gehört dieser Betrieb zum angemeldeten Gastro-Konto? */
function ownsPlace(ctx, placeId) {
  if (ctx.account?.role === 'admin') return true
  return !!placeId && ctx.account?.placeId === placeId
}

const ROUTES = {
  /* --- Betriebe ---------------------------------------------------------- */
  'places.list': { who: 'public', call: (ctx, [filters]) => domain.places.list(filters ?? {}) },
  'places.bySlug': { who: 'public', call: (ctx, [slug, position]) => domain.places.bySlug(slug, position) },
  'places.byId': { who: 'public', call: (ctx, [id, position]) => domain.places.byId(id, position) },
  'places.nearby': { who: 'public', call: (ctx, [position, limit]) => domain.places.nearby(position, limit) },
  'places.save': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, id),
    call: (ctx, [id, changes]) => domain.places.save(id, changes ?? {}),
  },
  'places.setStatus': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, id),
    call: (ctx, [id, status]) => domain.places.setStatus(id, status),
  },

  /* --- Speisekarte ------------------------------------------------------- */
  'menu.get': { who: 'public', call: (ctx, [placeId]) => domain.menu.get(placeId) },
  'menu.dishes': { who: 'public', call: (ctx, [placeId]) => domain.menu.dishes(placeId) },
  'menu.addCategory': {
    who: 'gastro',
    guard: (ctx, [placeId]) => ownsPlace(ctx, placeId),
    call: (ctx, [placeId, name]) => domain.menu.addCategory(placeId, name),
  },
  'menu.updateCategory': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, domain.menu.placeOfCategory(id)),
    call: (ctx, [id, changes]) => domain.menu.updateCategory(id, changes ?? {}),
  },
  'menu.removeCategory': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, domain.menu.placeOfCategory(id)),
    call: (ctx, [id]) => domain.menu.removeCategory(id),
  },
  'menu.moveCategory': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, domain.menu.placeOfCategory(id)),
    call: (ctx, [id, direction]) => domain.menu.moveCategory(id, direction),
  },
  'menu.addDish': {
    who: 'gastro',
    guard: (ctx, [placeId]) => ownsPlace(ctx, placeId),
    call: (ctx, [placeId, categoryId, dish]) => domain.menu.addDish(placeId, categoryId, dish ?? {}),
  },
  'menu.updateDish': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, domain.menu.placeOfDish(id)),
    call: (ctx, [id, changes]) => domain.menu.updateDish(id, changes ?? {}),
  },
  'menu.removeDish': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, domain.menu.placeOfDish(id)),
    call: (ctx, [id]) => domain.menu.removeDish(id),
  },

  /* --- Videos ------------------------------------------------------------ */
  'videos.feed': { who: 'public', call: (ctx, [options]) => domain.videos.feed({ ...options, userId: asUser(ctx) }) },
  'videos.byId': { who: 'public', call: (ctx, [id, position]) => domain.videos.byId(id, position) },
  'videos.byPlace': {
    who: 'public',
    call: (ctx, [placeId, options]) =>
      domain.videos.byPlace(placeId, { includeAll: !!options?.includeAll && ownsPlace(ctx, placeId) }),
  },
  'videos.byAuthor': {
    who: 'public',
    /* Den vollständigen Bestand sieht nur, wem er gehört. */
    call: (ctx, [authorId, options]) =>
      domain.videos.byAuthor(authorId, { own: !!options?.own && asUser(ctx) === authorId }),
  },
  'videos.create': {
    who: 'user',
    call: (ctx, [data]) => domain.videos.create({ ...data, authorId: ctx.account.id }),
  },
  'videos.setVisibility': {
    who: 'user',
    guard: (ctx, [id]) => {
      const owner = domain.videos.ownerOf(id)
      return owner?.authorId === ctx.account.id || ownsPlace(ctx, owner?.placeId)
    },
    call: (ctx, [id, visibility]) => domain.videos.setVisibility(id, visibility),
  },
  'videos.remove': {
    who: 'user',
    guard: (ctx, [id]) => {
      const owner = domain.videos.ownerOf(id)
      return owner?.authorId === ctx.account.id || ownsPlace(ctx, owner?.placeId)
    },
    call: (ctx, [id]) => domain.videos.removeVideo(id),
  },
  'videos.markSeen': { who: 'public', call: (ctx, [id]) => domain.videos.markSeen(id) },
  'videos.pending': { who: 'admin', call: () => domain.videos.pending() },
  'videos.moderate': {
    who: 'admin',
    call: (ctx, [id, status, reason]) => domain.videos.moderate(id, status, reason, ctx.account.email),
  },

  /* --- Bewertungen ------------------------------------------------------- */
  'reviews.byPlace': { who: 'public', call: (ctx, [placeId, options]) => domain.reviews.byPlace(placeId, options ?? {}) },
  'reviews.byAuthor': { who: 'public', call: (ctx, [authorId]) => domain.reviews.byAuthor(authorId) },
  'reviews.create': {
    who: 'user',
    call: (ctx, [data]) => domain.reviews.create({ ...data, authorId: ctx.account.id }),
  },
  'reviews.answer': {
    who: 'gastro',
    guard: (ctx, [id]) => ownsPlace(ctx, domain.reviews.placeOf(id)),
    call: (ctx, [id, text]) => domain.reviews.answer(id, text),
  },
  'reviews.like': { who: 'user', call: (ctx, [id]) => domain.reviews.like(id) },

  /* --- Soziales ---------------------------------------------------------- */
  'social.toggleLike': { who: 'user', call: (ctx, [, videoId]) => domain.social.toggleLike(ctx.account.id, videoId) },
  'social.toggleSave': { who: 'user', call: (ctx, [, type, targetId]) => domain.social.toggleSave(ctx.account.id, type, targetId) },
  'social.toggleFollow': { who: 'user', call: (ctx, [, targetId]) => domain.social.toggleFollow(ctx.account.id, targetId) },
  'social.saved': { who: 'user', call: (ctx, [, type]) => domain.social.saved(ctx.account.id, type) },
  'social.stateFor': { who: 'user', call: (ctx, [, ids]) => domain.social.stateFor(ctx.account.id, ids ?? {}) },

  /* --- Nutzer ------------------------------------------------------------ */
  'users.byUsername': { who: 'public', call: (ctx, [username]) => domain.users.byUsername(username) },
  'users.byId': { who: 'public', call: (ctx, [id]) => domain.users.byId(id) },
  'users.save': { who: 'user', call: (ctx, [, changes]) => domain.users.save(ctx.account.id, changes ?? {}) },
  'users.exportData': { who: 'user', call: (ctx) => domain.users.exportData(ctx.account.id) },
  'users.deleteAccount': { who: 'user', call: (ctx) => domain.users.deleteAccount(ctx.account.id) },
  'users.setStatus': { who: 'admin', call: (ctx, [id, status]) => domain.users.setStatus(id, status, ctx.account.email) },

  /* --- Benachrichtigungen ------------------------------------------------ */
  'notifications.list': { who: 'user', call: (ctx) => domain.notifications.list(ctx.account.id) },
  'notifications.unreadCount': { who: 'user', call: (ctx) => domain.notifications.unreadCount(ctx.account.id) },
  'notifications.markAllRead': { who: 'user', call: (ctx) => domain.notifications.markAllRead(ctx.account.id) },

  /* --- Meldungen --------------------------------------------------------- */
  'reports.create': {
    who: 'user',
    call: (ctx, [data]) => domain.reports.create({ ...data, reporterId: ctx.account.id }),
  },
  'reports.list': { who: 'admin', call: (ctx, [options]) => domain.reports.list(options ?? {}) },
  'reports.resolve': {
    who: 'admin',
    call: (ctx, [id, status]) => domain.reports.resolve(id, status, ctx.account.id, ctx.account.email),
  },

  /* --- Verwaltung -------------------------------------------------------- */
  'admin.overview': { who: 'admin', call: () => domain.admin.overview() },
  'admin.users': { who: 'admin', call: () => domain.admin.users() },
  'admin.places': { who: 'admin', call: () => domain.admin.places() },
  'admin.invites': { who: 'admin', call: () => domain.admin.invites() },
  'admin.createInvite': { who: 'admin', call: (ctx, [placeId, email]) => domain.admin.createInvite(placeId, email, ctx.account.email) },
  'admin.resendInvite': { who: 'admin', call: (ctx, [id]) => domain.admin.resendInvite(id) },
  'admin.suggestions': { who: 'admin', call: () => domain.admin.suggestions() },
  'admin.resolveSuggestion': { who: 'admin', call: (ctx, [id, status]) => domain.admin.resolveSuggestion(id, status, ctx.account.email) },
  'admin.auditLog': { who: 'admin', call: () => domain.admin.auditLog() },
  'admin.setClaimStatus': { who: 'admin', call: (ctx, [id, status]) => domain.places.setClaimStatus(id, status) },

  /* Wer einen Betrieb übernehmen will, meldet sich — ohne Konto. */
  'admin.suggestPlace': { who: 'public', call: (ctx, [data]) => domain.admin.createSuggestion(data ?? {}) },
  'admin.requestClaim': {
    who: 'public',
    call: (ctx, [placeId, email]) => {
      if (placeId) domain.places.setClaimStatus(placeId, 'pending')
      return domain.admin.createInvite(placeId, email, 'anfrage')
    },
  },

  /* --- Suche ------------------------------------------------------------- */
  'search.run': { who: 'public', call: (ctx, [query, options]) => domain.search.run(query, options ?? {}) },
  'search.history': { who: 'public', call: () => domain.search.history() },
  'search.remember': { who: 'public', call: (ctx, [query]) => domain.search.remember(query) },
  'search.clearHistory': { who: 'public', call: () => domain.search.clearHistory() },

  /* --- Gastro ------------------------------------------------------------ */
  'gastro.dashboard': {
    who: 'gastro',
    guard: (ctx, [placeId]) => ownsPlace(ctx, placeId),
    call: (ctx, [placeId]) => domain.gastro.dashboard(placeId),
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

export function listRoutes() {
  return Object.entries(ROUTES)
    .map(([name, route]) => ({ name, who: route.who }))
    .sort((a, b) => RANK[a.who] - RANK[b.who] || a.name.localeCompare(b.name))
}

/** Führt einen Aufruf aus. Gibt immer `{ status, body }` zurück. */
export function callRpc({ method, args = [], token }) {
  const route = ROUTES[method]
  if (!route) return { status: 404, body: { error: 'Unbekannter Aufruf', method } }

  const userId = token ? tokens.userIdFor(token) : null
  const account = userId ? domain.auth.accountOf(userId) : null
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
