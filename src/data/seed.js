import { betriebe as betriebeAusOsm, geholt, quelle, gegenden } from './orte.js'
import { anreichern } from './anreicherung.js'
import { nurBestehende } from './zustand.js'
import { alleVollstaendig } from './orte-laden.js'

/**
 * Der Ausgangsbestand, was in der Datenbank steht, wenn sie neu ist.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/index.js                 füllt damit eine neue Datenbank            │
 * │  src/store/sqlite-store.js    trägt sie beim ersten Start ein            │
 * │  test/smoke.mjs               baut damit einen Server im Speicher        │
 * │  Website-/src/domain/seed.js  dieselbe Datei, von tools/sync.mjs kopiert │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ── Was hier steht, seit dem MVP ──────────────────────────────────────────
 *
 * Echte Betriebe und die ausdrücklich bestellten Zugänge. Sonst nichts.
 *
 * Vorher standen hier erfundene Berliner Lokale mit erfundenen Videos,
 * Bewertungen, Meldungen und Speisekarten. Das war nützlich, solange es um
 * die Oberfläche ging: Man sah, wie ein voller Feed aussieht. Für einen MVP,
 * den echte Leute anfassen, ist es das Gegenteil von nützlich, niemand
 * erkennt von außen, was echt ist und was Kulisse, und die ersten echten
 * Beiträge stehen zwischen erfundenen.
 *
 * Der Feed ist deshalb am Anfang leer. Das ist kein Fehler, sondern der
 * Zustand jeder Anwendung am ersten Tag.
 *
 * ── Woher die Betriebe kommen ─────────────────────────────────────────────
 *
 * `src/data/orte.js`, erzeugt von `tools/osm-import.mjs` aus OpenStreetMap.
 * `src/data/anreicherung.js` legt Beschreibungen darüber, mit Quelle und
 * Datum. Bewertungen werden aus keiner fremden Quelle übernommen, die
 * entstehen hier oder gar nicht.
 *
 * Zeiten stehen als Minuten seit Mitternacht, damit lässt sich „jetzt
 * geöffnet" wirklich rechnen statt nur anzuzeigen.
 */

/** Angebotsarten, was gibt es hier zu essen und zu trinken? (C.3, C.2, C.5) */
export const SERVING_KEYS = [
  'getraenke', 'fruehstueck', 'vegan', 'vegetarisch',
  'fleisch', 'fisch', 'meeresfruechte', 'suess', 'halal', 'glutenfrei',
]

/** Die vierzehn kennzeichnungspflichtigen Allergene. */
export const ALLERGEN_KEYS = [
  'gluten', 'krebstiere', 'ei', 'fisch', 'erdnuss', 'soja', 'milch',
  'schalenfruechte', 'sellerie', 'senf', 'sesam', 'sulfite', 'lupine', 'weichtiere',
]

/**
 * Wo die Karte steht, solange das Gerät seinen Standort nicht verraten hat.
 *
 * Oberkirch, weil dort Betriebe liegen. Ein Startpunkt ohne Daten in der Nähe
 * sieht aus wie ein kaputter Feed.
 */
export const HOME_POSITION = { lat: 48.5333, lng: 8.0833, label: 'Oberkirch' }

/** Woher die Betriebe stammen, die Oberfläche nennt Quelle und Stand. */
export const HERKUNFT = { geholt, quelle, gegenden }

/* ==========================================================================
   Betriebe
   ========================================================================== */

/**
 * Die importierten Betriebe, mit den angereicherten Angaben darüber.
 *
 * Als Modul eingebunden, nicht als Datei gelesen: Dieselbe Fachlogik läuft im
 * Browser, und dort gibt es kein Dateisystem.
 *
 * `nurBestehende` wirft heraus, was dauerhaft geschlossen ist: Es soll keine
 * Seite für einen Betrieb geben, den es nicht mehr gibt. Siehe zustand.js.
 */
const betriebe = () => nurBestehende(alleVollstaendig(betriebeAusOsm)).map(anreichern)

/* ==========================================================================
   Konten
   ========================================================================== */

/**
 * Ein Betrieb, an dem sich der Gastro-Bereich ausprobieren lässt.
 *
 * Ausgewählt wird nicht „irgendeiner", sondern der erste mit Beschreibung,
 * dessen Seite hat Inhalt, an dem man die Bearbeitung auch sieht. Gibt es
 * keinen, nimmt es den ersten überhaupt.
 */
function testBetrieb(alle) {
  return alle.find((b) => b.description) ?? alle[0] ?? null
}

/**
 * Die Konten.
 *
 * Alle drei sind ausdrücklich bestellt. Sie sind Testzugänge, keine echten
 * Konten: Für die importierten Betriebe wird bewusst **kein** Konto angelegt.
 * Wer einen davon führt, meldet sich über „Betrieb übernehmen", dann steht
 * am Konto auch, dass es geprüft wurde.
 *
 * ┌─ ACHTUNG ────────────────────────────────────────────────────────────────┐
 * │  `admin` ist kein Passwort, sondern ein Platzhalter. Es steht in jeder   │
 * │  Wortliste, die es gibt. Bevor die Anwendung echte Nutzerdaten sieht,    │
 * │  muss dieser Zugang weg. Der Server sagt es beim Start auch selbst.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
function konten(alle) {
  const test = testBetrieb(alle)
  return [
    {
      id: 'a1', username: 'topic', name: 'Topic (Verwaltung)', email: 'topic@intern',
      password: 'admin', role: 'admin', private: true, joined: '2026-09-07',
      bio: '', website: '', radius: 10, status: 'active', reportCount: 0,
      emailVerified: true, phoneVerified: true, verificationSkipped: false,
      notify: { moderation: true },
    },
    {
      id: 'u1', username: 'test_user', name: 'Test-Nutzer', email: 'test@user.de',
      password: '12345aA?', role: 'user', private: false, joined: '2026-09-07',
      bio: 'Konto zum Ausprobieren.', website: '', radius: 5, status: 'active', reportCount: 0,
      emailVerified: false, phoneVerified: false, verificationSkipped: true,
      notify: { follows: true, likes: true, replies: true, moderation: true },
    },
    {
      id: 'g1', username: 'test_gastro', name: 'Test-Gastro', email: 'test@gastro.de',
      password: '12345aA?', role: 'gastro', placeId: test?.id ?? null,
      private: false, joined: '2026-09-07', bio: '', website: '', radius: 5,
      status: 'active', reportCount: 0,
      emailVerified: true, phoneVerified: false, verificationSkipped: true,
      notify: { reviews: true, videos: true, moderation: true },
    },
  ]
}

/* ==========================================================================
   Orte für die Suche
   ========================================================================== */

/** Die Gegenden, für die Daten vorliegen, Sprungziele in der Suche. */
export const locations = [
  { id: 'l1', name: 'Alcossebre', detail: 'Spanien · Costa del Azahar', lat: 40.2408, lng: 0.2706 },
  { id: 'l2', name: 'Rheinmünster', detail: 'Deutschland · 77836', lat: 48.7686, lng: 8.0511 },
  { id: 'l3', name: 'Oberkirch', detail: 'Deutschland · 77704', lat: 48.5333, lng: 8.0833 },
]

/**
 * Häufige Suchbegriffe, aus dem Bestand gerechnet, nicht erfunden.
 *
 * Ein „beliebt"-Vorschlag, der auf nichts zeigt, ist eine Sackgasse. Deshalb
 * stehen hier die Küchen, die es in den Daten wirklich am häufigsten gibt.
 */
/**
 * Zwei Listen zu einer, ohne Doppelte.
 *
 * Die Gegenden überlappen sich: Oberkirch liegt im Umkreis von Karlsruhe und
 * Freiburg. Derselbe Betrieb darf trotzdem nur einmal in der Datenbank stehen,
 * sonst hat er zwei Seiten und zwei Bewertungsschnitte. Es zählt die Kennung
 * aus OpenStreetMap, und die erste gewinnt: Die Kern-Gegenden sind
 * angereichert, die Fläche nicht.
 */
function zusammenfuehren(erste, zweite) {
  if (!zweite?.length) return erste
  const bekannt = new Set(erste.map((b) => b.id))
  const kuerzel = new Set(erste.map((b) => b.slug))

  const dazu = []
  for (const betrieb of nurBestehende(alleVollstaendig(zweite))) {
    if (bekannt.has(betrieb.id)) continue
    bekannt.add(betrieb.id)
    /* Kürzel müssen eindeutig bleiben, die Betriebsseite hängt daran. */
    let slug = betrieb.slug
    if (kuerzel.has(slug)) slug = `${slug}-${betrieb.id.replace(/[^a-z0-9]/gi, '').slice(-6)}`
    if (kuerzel.has(slug)) continue
    kuerzel.add(slug)
    dazu.push(anreichern({ ...betrieb, slug }))
  }
  return [...erste, ...dazu]
}

function haeufigeKuechen(alle, anzahl = 6) {
  const zaehler = new Map()
  for (const betrieb of alle) {
    for (const tag of betrieb.tags ?? []) zaehler.set(tag, (zaehler.get(tag) ?? 0) + 1)
  }
  return [...zaehler.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, anzahl)
    .map(([tag]) => tag)
}

/* ==========================================================================
   Alles zusammen
   ========================================================================== */

/**
 * So sieht die Datenbank beim ersten Start aus.
 *
 * @param zusaetzlich  weitere Betriebe, die der Wirt mitbringt. Der Server
 *                     reicht damit `src/data/deutschland.json` herein, die
 *                     Website nichts. Warum das getrennt ist, steht in
 *                     src/data/gebiete.js.
 */
export function initialDatabase({ zusaetzlich = [] } = {}) {
  const places = zusammenfuehren(betriebe(), zusaetzlich)
  return {
    users: konten(places),
    places,
    locations,
    searchPopular: haeufigeKuechen(places),

    /* Alles Weitere entsteht im Betrieb. */
    menuCategories: [],
    dishes: [],
    videos: [],
    reviews: [],
    follows: [],
    likes: [],
    saves: [],
    notifications: [],
    reports: [],
    invites: [],
    suggestions: [],
    auditLog: [],
    seenVideos: [],
    searchHistory: [],
  }
}
