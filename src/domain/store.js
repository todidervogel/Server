/**
 * Der Store ist die einzige Stelle, an der die Fachlogik Daten anfasst.
 *
 * Wer ihn bereitstellt, entscheidet der Wirt: Der Server legt die Daten in
 * eine Datei, die Website in den Browserspeicher. Die Fachlogik darunter ist
 * beide Male dieselbe — deshalb liegt sie hier und nicht doppelt.
 *
 * Ein Store muss können:
 *   get()                       den gesamten Stand lesen
 *   update(fn)                  Änderungen anwenden (fn liefert ein Patch-Objekt)
 *   insert(tabelle, zeile)      vorne anhängen
 *   patch(tabelle, id, änderung) eine Zeile ändern
 *   remove(tabelle, prädikat)   Zeilen entfernen
 *   nextId(tabelle, präfix)     nächste lesbare Kennung
 */
let store = null

export function setStore(next) {
  store = next
}

export function getStore() {
  if (!store) throw new Error('Kein Store eingehängt — setStore() vor dem ersten Aufruf verwenden.')
  return store
}

/** Kurzformen, damit die Fachlogik nicht überall getStore() schreiben muss. */
export const db = () => getStore().get()
export const update = (fn) => getStore().update(fn)
export const insert = (table, row) => getStore().insert(table, row)
export const patch = (table, id, changes) => getStore().patch(table, id, changes)
export const remove = (table, predicate) => getStore().remove(table, predicate)
export const nextId = (table, prefix) => getStore().nextId(table, prefix)

/**
 * Baut einen Store über einem einfachen Objekt im Arbeitsspeicher.
 * `persist` wird nach jeder Änderung gerufen — die Datei- und die
 * Browserfassung unterscheiden sich nur darin.
 */
export function createMemoryStore(initial, persist = () => {}) {
  let data = initial

  const notify = () => persist(data)

  return {
    get: () => data,

    update(fn) {
      const changes = fn(data)
      if (!changes) return data
      data = { ...data, ...changes }
      notify()
      return data
    },

    insert(table, row) {
      data = { ...data, [table]: [row, ...(data[table] ?? [])] }
      notify()
      return row
    },

    patch(table, id, changes) {
      data = {
        ...data,
        [table]: (data[table] ?? []).map((row) =>
          row.id === id ? { ...row, ...(typeof changes === 'function' ? changes(row) : changes) } : row),
      }
      notify()
    },

    remove(table, predicate) {
      data = { ...data, [table]: (data[table] ?? []).filter((row) => !predicate(row)) }
      notify()
    },

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
  }
}
