import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createMemoryStore } from '../domain/store.js'
import { TABELLEN, LISTEN } from './schema.js'
import { createZugaenge } from './zugaenge.js'
import { createSitzungen } from './sitzungen.js'

/**
 * Die Datenhaltung des Servers: SQLite, eine Datei, richtige Tabellen.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/index.js            baut den Store beim Start                       │
 * │  src/store/zugaenge.js   teilt sich dieselbe Verbindung (Passwörter)     │
 * │  src/store/sitzungen.js  dito (Anmeldungen)                              │
 * │  src/domain/store.js     beschreibt, was ein Store können muss           │
 * │  src/store/schema.js     sagt, welche Tabellen und Spalten es gibt       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ── Wie es arbeitet ───────────────────────────────────────────────────────
 *
 * Gelesen wird aus dem Arbeitsspeicher, geschrieben wird sofort in die
 * Datenbank. Beim Start wird einmal alles eingelesen, danach beantwortet der
 * Server jede Abfrage aus dem Speicher — und jede Änderung geht in derselben
 * Sekunde als INSERT/UPDATE/DELETE nach SQLite.
 *
 * Warum nicht bei jedem Aufruf frisch abfragen? Weil die Fachlogik in
 * `src/domain/` synchron über den gesamten Bestand rechnet: Durchschnitte,
 * Entfernungen, Feed-Reihenfolge. Bei ein paar hundert Betrieben ist der
 * ganze Bestand ein paar hundert Kilobyte — den im Speicher zu halten ist
 * schneller als jede Abfrage und macht die Fachlogik einfacher.
 *
 * Wann das nicht mehr reicht, und zwar genau dann: sobald **zwei** Server-
 * prozesse auf dieselbe Datei zeigen. Dann sieht jeder nur seine eigenen
 * Änderungen im Speicher. Ab da wird hier direkt abgefragt statt gespiegelt —
 * die Schnittstelle nach oben bleibt dieselbe.
 *
 * ── Was durch den Neustart kommt ──────────────────────────────────────────
 * Alles: Konten, Betriebe, Videos, Bewertungen, Meldungen, Merkzettel,
 * Suchverlauf — und die Anmeldungen (src/store/sitzungen.js). Wer angemeldet
 * war, bleibt es auch, wenn der Server neu startet.
 */

/** Fassung des Schemas. Wird sie erhöht, laufen die Schritte in WANDERUNGEN. */
const SCHEMA_FASSUNG = 1

/* --- Aufbau --------------------------------------------------------------- */

/** Erzeugt `CREATE TABLE` aus der Beschreibung in schema.js. */
function tabellenSql(name, beschreibung) {
  const spalten = Object.entries(beschreibung.spalten).map(([spalte, typ]) => `  "${spalte}" ${typ}`)
  const schluessel = beschreibung.schluessel ?? []

  /* Ein einzelner Schlüssel steht schon am Typ („TEXT PRIMARY KEY“). */
  if (schluessel.length > 1) {
    spalten.push(`  PRIMARY KEY (${schluessel.map((s) => `"${s}"`).join(', ')})`)
  }
  return `CREATE TABLE IF NOT EXISTS "${name}" (\n${spalten.join(',\n')}\n)`
}

function indexSql(tabelle, index) {
  const name = `idx_${tabelle}_${index.spalten.join('_')}`
  const spalten = index.spalten.map((s) => `"${s}"`).join(', ')
  return `CREATE ${index.eindeutig ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${name}" ON "${tabelle}" (${spalten})`
}

/**
 * Legt an, was fehlt.
 *
 * Bewusst ohne Zauberei: `IF NOT EXISTS` überall, damit ein Start auf einer
 * vorhandenen Datei nichts kaputtmacht. Echte Änderungen am Schema — eine
 * Spalte umbenennen, eine Tabelle aufteilen — bekommen einen nummerierten
 * Schritt in WANDERUNGEN und erhöhen SCHEMA_FASSUNG.
 */
const WANDERUNGEN = {
  /* 1 → 2: hier stünde der erste echte Umbau. */
}

function schemaAnlegen(datenbank) {
  datenbank.exec('PRAGMA journal_mode = WAL')
  datenbank.exec('PRAGMA foreign_keys = ON')
  datenbank.exec('PRAGMA busy_timeout = 5000')

  datenbank.exec('CREATE TABLE IF NOT EXISTS "schema_fassung" (fassung INTEGER NOT NULL)')

  for (const [name, beschreibung] of Object.entries(TABELLEN)) {
    datenbank.exec(tabellenSql(name, beschreibung))
    for (const index of beschreibung.indizes ?? []) datenbank.exec(indexSql(name, index))
  }

  datenbank.exec(`CREATE TABLE IF NOT EXISTS "listen" (
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "wert" TEXT NOT NULL,
  PRIMARY KEY ("name", "position")
)`)

  const stand = datenbank.prepare('SELECT fassung FROM "schema_fassung"').get()
  if (!stand) {
    datenbank.prepare('INSERT INTO "schema_fassung" (fassung) VALUES (?)').run(SCHEMA_FASSUNG)
    return
  }
  for (let f = stand.fassung; f < SCHEMA_FASSUNG; f += 1) {
    const schritt = WANDERUNGEN[f]
    if (!schritt) throw new Error(`Kein Wanderungsschritt von Fassung ${f} — Datenbank ist neuer als der Code.`)
    console.log(`[Daten] Schema ${f} → ${f + 1}`)
    schritt(datenbank)
  }
  datenbank.prepare('UPDATE "schema_fassung" SET fassung = ?').run(SCHEMA_FASSUNG)
}

/* --- Zeile ⇄ Objekt ------------------------------------------------------- */

/**
 * Aus einem Objekt der Fachlogik werden Werte, die SQLite annimmt.
 *
 * SQLite kennt vier Typen: Zahl, Text, Blob, NULL. Kein `true`, kein Objekt,
 * keine Liste. Was die Beschreibung als `bool` führt, wird 0 oder 1; was sie
 * als `json` führt, wird Text.
 */
function zuZeile(beschreibung, objekt, unbekannt) {
  const zeile = {}
  for (const spalte of Object.keys(beschreibung.spalten)) {
    let wert = objekt[spalte]
    if (wert === undefined) continue
    if (beschreibung.json?.includes(spalte)) wert = wert === null ? null : JSON.stringify(wert)
    else if (beschreibung.bool?.includes(spalte)) wert = wert === null || wert === undefined ? null : (wert ? 1 : 0)
    else if (typeof wert === 'boolean') wert = wert ? 1 : 0
    else if (wert !== null && typeof wert === 'object') wert = JSON.stringify(wert)
    zeile[spalte] = wert
  }
  /*
   * Ein Feld, das die Fachlogik schreibt, das Schema aber nicht kennt, wäre
   * sonst still verloren — der übelste Fehler, weil er erst Wochen später
   * auffällt. Es wird gemeldet, damit die Spalte nachgetragen wird.
   */
  for (const spalte of Object.keys(objekt)) {
    if (!(spalte in beschreibung.spalten)) unbekannt.add(spalte)
  }
  return zeile
}

/** Und zurück: aus einer Zeile wird wieder ein gewöhnliches Objekt. */
function zuObjekt(beschreibung, zeile) {
  const objekt = {}
  for (const [spalte, wert] of Object.entries(zeile)) {
    if (beschreibung.json?.includes(spalte)) objekt[spalte] = wert == null ? null : JSON.parse(wert)
    else if (beschreibung.bool?.includes(spalte)) objekt[spalte] = wert == null ? null : wert === 1
    else objekt[spalte] = wert
  }
  return objekt
}

/* --- Lesen und Schreiben -------------------------------------------------- */

function allesLesen(datenbank) {
  const daten = {}
  for (const [name, beschreibung] of Object.entries(TABELLEN)) {
    daten[name] = datenbank.prepare(`SELECT * FROM "${name}"`).all().map((z) => zuObjekt(beschreibung, z))
  }
  for (const name of LISTEN) {
    daten[name] = datenbank
      .prepare('SELECT wert FROM "listen" WHERE name = ? ORDER BY position')
      .all(name)
      .map((z) => z.wert)
  }
  return daten
}

function istLeer(datenbank) {
  for (const name of Object.keys(TABELLEN)) {
    if (datenbank.prepare(`SELECT 1 FROM "${name}" LIMIT 1`).get()) return false
  }
  return true
}

/** Schreibt eine ganze Tabelle neu — für den Erstbestand und für update(). */
function tabelleSchreiben(datenbank, name, zeilen, unbekannt) {
  const beschreibung = TABELLEN[name]
  const spalten = Object.keys(beschreibung.spalten)
  const sql = `INSERT OR REPLACE INTO "${name}" (${spalten.map((s) => `"${s}"`).join(', ')})
               VALUES (${spalten.map(() => '?').join(', ')})`
  const anweisung = datenbank.prepare(sql)
  for (const objekt of zeilen ?? []) {
    const zeile = zuZeile(beschreibung, objekt, unbekannt)
    anweisung.run(...spalten.map((s) => (zeile[s] === undefined ? null : zeile[s])))
  }
}

function listeSchreiben(datenbank, name, werte) {
  datenbank.prepare('DELETE FROM "listen" WHERE name = ?').run(name)
  const anweisung = datenbank.prepare('INSERT INTO "listen" (name, position, wert) VALUES (?, ?, ?)')
  ;(werte ?? []).forEach((wert, i) => anweisung.run(name, i, String(wert)))
}

/* --- Der Store ------------------------------------------------------------ */

/**
 * @param pfad          Datei, in der die Datenbank liegt (data/tellerrand.db)
 * @param ausgangsdaten Was beim allerersten Start hineinkommt (src/data/seed.js)
 */
export function createSqliteStore(pfad, ausgangsdaten) {
  mkdirSync(dirname(pfad), { recursive: true })
  const datenbank = new DatabaseSync(pfad)
  schemaAnlegen(datenbank)

  /* Passwörter und Anmeldungen liegen in derselben Datei, aber nicht im
     Fachbestand — sie gehören dem Server, nicht der Fachlogik. */
  const zugaenge = createZugaenge(datenbank)
  const sitzungen = createSitzungen(datenbank)

  /* Felder ohne Spalte werden gesammelt und einmal gemeldet, nicht je Zeile. */
  const unbekannt = new Set()
  const meldeUnbekannte = () => {
    if (!unbekannt.size) return
    console.warn(`[Daten] Ohne Spalte im Schema, deshalb nicht gespeichert: ${[...unbekannt].join(', ')}`)
    unbekannt.clear()
  }

  const neu = istLeer(datenbank)
  if (neu) {
    console.log('[Daten] Neue Datenbank — Ausgangsbestand wird eingetragen.')
    erstbestand(datenbank, ausgangsdaten, zugaenge, unbekannt)
    meldeUnbekannte()
  }

  const daten = allesLesen(datenbank)

  /*
   * Der Speicherstore führt den Bestand; `spiegeln` bekommt nach jeder
   * Änderung mitgeteilt, was zu tun ist. So bleibt die Logik für „was ändert
   * sich am Bestand" an einer Stelle (domain/store.js) und hier steht nur,
   * wie dieselbe Änderung in SQL aussieht.
   */
  const speicher = createMemoryStore(daten, () => {}, {
    einfuegen(name, objekt) {
      if (LISTEN.includes(name)) return listeSchreiben(datenbank, name, speicher.get()[name])
      tabelleSchreiben(datenbank, name, [objekt], unbekannt)
      meldeUnbekannte()
    },

    aendern(name, id, objekt) {
      /* Ohne Objekt gibt es nichts zu schreiben — die Zeile gibt es nicht. */
      if (!objekt) return
      tabelleSchreiben(datenbank, name, [objekt], unbekannt)
      meldeUnbekannte()
    },

    loeschen(name, entfernte) {
      const beschreibung = TABELLEN[name]
      if (!beschreibung) return
      const schluessel = beschreibung.schluessel ?? ['id']
      const wo = schluessel.map((s) => `"${s}" = ?`).join(' AND ')
      const anweisung = datenbank.prepare(`DELETE FROM "${name}" WHERE ${wo}`)
      imBlock(datenbank, () => {
        for (const objekt of entfernte) anweisung.run(...schluessel.map((s) => objekt[s] ?? null))
      })
    },

    ersetzen(bereiche) {
      imBlock(datenbank, () => {
        for (const [name, inhalt] of Object.entries(bereiche)) {
          if (LISTEN.includes(name)) { listeSchreiben(datenbank, name, inhalt); continue }
          if (!TABELLEN[name]) continue
          datenbank.prepare(`DELETE FROM "${name}"`).run()
          tabelleSchreiben(datenbank, name, inhalt, unbekannt)
        }
      })
      meldeUnbekannte()
    },
  }, {
    /* Die Fachlogik fragt nur „stimmt das?" — gehasht wird in zugaenge.js. */
    pruefen: (id, klartext) => zugaenge.pruefen(id, klartext),
    setzen: (id, klartext) => zugaenge.setzen(id, klartext),
  })

  return {
    ...speicher,
    zugaenge,
    sitzungen,
    /** Die offene Verbindung — zugaenge.js und sitzungen.js hängen sich daran. */
    datenbank,
    neu,

    /** Alles auf den Auslieferungsstand. Nur über /api/reset für die Verwaltung. */
    reset() {
      imBlock(datenbank, () => {
        for (const name of Object.keys(TABELLEN)) datenbank.prepare(`DELETE FROM "${name}"`).run()
        datenbank.prepare('DELETE FROM "listen"').run()
        datenbank.prepare('DELETE FROM "zugaenge"').run()
        datenbank.prepare('DELETE FROM "sitzungen"').run()
      })
      erstbestand(datenbank, ausgangsdaten, zugaenge, unbekannt)
      meldeUnbekannte()
      return speicher.replace(allesLesen(datenbank))
    },

    schliessen() {
      datenbank.close()
    },
  }
}

/**
 * Trägt den Ausgangsbestand ein.
 *
 * Die Passwörter aus src/data/seed.js gehen dabei nicht in die Nutzertabelle,
 * sondern durch zugaenge.setzen() — dort werden sie gehasht. In `users` gibt
 * es keine Spalte dafür, und das ist der Sinn der Sache.
 */
function erstbestand(datenbank, ausgangsdaten, zugaenge, unbekannt) {
  imBlock(datenbank, () => {
    for (const name of Object.keys(TABELLEN)) {
      const zeilen = name === 'users'
        ? (ausgangsdaten.users ?? []).map(({ password, ...konto }) => konto)
        : ausgangsdaten[name]
      tabelleSchreiben(datenbank, name, zeilen, unbekannt)
    }
    for (const name of LISTEN) listeSchreiben(datenbank, name, ausgangsdaten[name])
  })

  /* Hashen ist absichtlich langsam — deshalb außerhalb des Schreibblocks. */
  for (const konto of ausgangsdaten.users ?? []) {
    if (konto.password) zugaenge.setzen(konto.id, konto.password)
  }
}

/**
 * Mehrere Schreibvorgänge als ein Vorgang.
 *
 * Ohne das schreibt SQLite jede Zeile einzeln auf die Platte — 360 Betriebe
 * dauern dann Sekunden statt Millisekunden. Und wichtiger: Bricht es
 * mittendrin ab, steht die Datenbank hinterher nicht halb gefüllt da.
 */
function imBlock(datenbank, arbeit) {
  datenbank.exec('BEGIN')
  try {
    arbeit()
    datenbank.exec('COMMIT')
  } catch (fehler) {
    datenbank.exec('ROLLBACK')
    throw fehler
  }
}
