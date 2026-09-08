/**
 * Der Store ist die einzige Stelle, an der die Fachlogik Daten anfasst.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  alle Dateien in src/domain/   lesen und schreiben über db/insert/patch  │
 * │  src/store/sqlite-store.js     hängt SQLite darunter (Server)            │
 * │  Website-/src/lib/store/…      hängt den Browserspeicher darunter        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Wer den Store bereitstellt, entscheidet der Wirt: Der Server legt die Daten
 * in eine SQLite-Datei, die Website in den Browserspeicher. Die Fachlogik
 * darunter ist beide Male dieselbe, deshalb liegt sie hier und nicht doppelt.
 *
 * Ein Store muss können:
 *   get()                        den gesamten Stand lesen
 *   update(fn)                   Änderungen anwenden (fn liefert ein Patch-Objekt)
 *   insert(tabelle, zeile)       vorne anhängen
 *   patch(tabelle, id, änderung) eine Zeile ändern
 *   remove(tabelle, prädikat)    Zeilen entfernen
 *   nextId(tabelle, präfix)      nächste lesbare Kennung
 *   pruefePasswort(id, klartext) stimmt das Passwort?      (siehe unten)
 *   setzePasswort(id, klartext)  Passwort setzen
 *
 * ── Warum Passwörter über den Store laufen ────────────────────────────────
 * Weil das Verfahren vom Wirt abhängt und nicht von der Fachlogik. Auf dem
 * Server wird mit scrypt gehasht und gesalzen (src/store/zugaenge.js); im
 * Browser liegt der ganze Bestand ohnehin offen im Gerät der Nutzerin, dort
 * schützt ein Hash niemanden. Die Fachlogik fragt nur „stimmt das?" und
 * bekommt nie ein Passwort zu sehen, auch kein gehashtes.
 */
let store = null

export function setStore(next) {
  store = next
}

export function getStore() {
  if (!store) throw new Error('Kein Store eingehängt, setStore() vor dem ersten Aufruf verwenden.')
  return store
}

/** Kurzformen, damit die Fachlogik nicht überall getStore() schreiben muss. */
export const db = () => getStore().get()
export const update = (fn) => getStore().update(fn)
export const insert = (table, row) => getStore().insert(table, row)
export const patch = (table, id, changes) => getStore().patch(table, id, changes)
export const remove = (table, predicate) => getStore().remove(table, predicate)
export const nextId = (table, prefix) => getStore().nextId(table, prefix)
export const pruefePasswort = (id, klartext) => getStore().pruefePasswort(id, klartext)
export const setzePasswort = (id, klartext) => getStore().setzePasswort(id, klartext)

/**
 * Baut einen Store über einem einfachen Objekt im Arbeitsspeicher.
 *
 * @param initial  der Ausgangsbestand
 * @param persist  wird nach jeder Änderung mit dem ganzen Bestand gerufen,
 *                 so sichert die Website in den Browserspeicher
 * @param spiegel  optional: bekommt jede Änderung einzeln gemeldet, damit ein
 *                 Wirt sie gezielt weiterschreiben kann statt jedes Mal alles.
 *                 Der Server spiegelt darüber nach SQLite
 *                 (src/store/sqlite-store.js).
 * @param passwort optional: Prüfung und Setzen von Passwörtern. Ohne Angabe
 *                 werden sie im Klartext neben dem Konto geführt, für den
 *                 Alleinbetrieb im Browser in Ordnung, für einen Server nicht.
 */
export function createMemoryStore(initial, persist = () => {}, spiegel = null, passwort = null) {
  let data = initial

  const notify = () => persist(data)

  const store = {
    get: () => data,

    update(fn) {
      const changes = fn(data)
      if (!changes) return data
      data = { ...data, ...changes }
      spiegel?.ersetzen?.(changes)
      notify()
      return data
    },

    insert(table, row) {
      data = { ...data, [table]: [row, ...(data[table] ?? [])] }
      spiegel?.einfuegen?.(table, row)
      notify()
      return row
    },

    patch(table, id, changes) {
      let geaendert = null
      data = {
        ...data,
        [table]: (data[table] ?? []).map((row) => {
          if (row.id !== id) return row
          geaendert = { ...row, ...(typeof changes === 'function' ? changes(row) : changes) }
          return geaendert
        }),
      }
      spiegel?.aendern?.(table, id, geaendert)
      notify()
      return geaendert
    },

    remove(table, predicate) {
      const entfernte = (data[table] ?? []).filter((row) => predicate(row))
      if (!entfernte.length) return
      data = { ...data, [table]: (data[table] ?? []).filter((row) => !predicate(row)) }
      spiegel?.loeschen?.(table, entfernte)
      notify()
    },

    /**
     * Nächste Kennung: höchste vorhandene Zahl plus eins.
     *
     * Nicht die Anzahl der Zeilen, sonst bekäme nach einer Löschung die
     * nächste Zeile eine Kennung, die es schon gab.
     */
    nextId(table, prefix) {
      const numbers = (data[table] ?? [])
        .map((row) => Number(String(row.id).replace(/\D/g, '')))
        .filter((n) => Number.isFinite(n))
      return `${prefix}${(numbers.length ? Math.max(...numbers) : 0) + 1}`
    },

    replace(next) {
      data = next
      notify()
      return data
    },

    /* --- Passwörter ------------------------------------------------------ */

    pruefePasswort(id, klartext) {
      if (passwort) return passwort.pruefen(id, klartext)
      const konto = (data.users ?? []).find((u) => u.id === id)
      return !!konto && konto.password === klartext
    },

    setzePasswort(id, klartext) {
      if (passwort) return passwort.setzen(id, klartext)
      store.patch('users', id, { password: klartext })
    },
  }

  return store
}
