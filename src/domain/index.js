/**
 * Die Fachlogik in einem Bündel.
 *
 * Alle Funktionen sind synchron und arbeiten auf dem eingehängten Store.
 * Wer sie aufruft — der HTTP-Server hier im Repo oder die Website im
 * Browser — entscheidet selbst, woher die Daten kommen und ob daraus ein
 * Versprechen wird.
 */
export * as auth from './auth.js'
export * as places from './places.js'
export * as menu from './menu.js'
export * as videos from './videos.js'
export * as reviews from './reviews.js'
export * as social from './social.js'
export * as users from './users.js'
export * as notifications from './notifications.js'
export * as reports from './reports.js'
export * as admin from './admin.js'
export * as search from './search.js'
export * as gastro from './gastro.js'

export { setStore, getStore, createMemoryStore } from './store.js'
export { invoke, listCalls, hasCall } from './calls.js'
export * from './derive.js'
export * from './geo.js'
export * from './hours.js'
