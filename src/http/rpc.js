import * as domain from '../domain/index.js'
import { invoke, listCalls } from '../domain/calls.js'
import * as tokens from './tokens.js'

/**
 * Die HTTP-Seite der Aufrufliste.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/http/server.js    POST /api/rpc, der eine Eingang                   │
 * │  src/http/tokens.js    macht aus einem Merkmal eine Kennung              │
 * │  src/domain/auth.js    macht aus der Kennung ein Konto mit Rolle         │
 * │  src/domain/calls.js   entscheidet, ob dieses Konto das darf             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Welche Aufrufe es gibt und wer sie machen darf, steht in
 * `domain/calls.js`, dieselbe Datei benutzt die Website im Alleinbetrieb.
 * Hier kommt nur dazu, wie aus einem Zugangsmerkmal ein Konto wird.
 */
export { listCalls as listRoutes }

export function callRpc({ method, args = [], token }) {
  const userId = token ? tokens.userIdFor(token) : null
  const account = userId ? domain.auth.accountOf(userId) : null
  return invoke(method, args, account)
}
