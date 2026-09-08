/**
 * Ergänzt an gekürzten Betrieben die weggelassenen Felder.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/data/seed.js       für die Betriebe aus orte.js                     │
 * │  src/index.js           für die Betriebe aus deutschland.json (Server)   │
 * │  tools/osm-import.mjs   lässt genau diese Felder weg                     │
 * │  tools/orte-pruefen.mjs prüft auf dem ergänzten Stand                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ── Warum gekürzt wird ────────────────────────────────────────────────────
 *
 * Von den importierten Betrieben hat gut die Hälfte keine Adresse, kein
 * Telefon, keine Webseite und keine Öffnungszeiten. Diese Felder trotzdem in
 * die Datei zu schreiben kostet bei zwölftausend Einträgen mehrere Megabyte,
 * die niemand liest, und bläht jede Fassung im Versionsverlauf auf.
 *
 * Die Fachlogik darf davon nichts merken: Ein Betrieb ohne `serving` würde in
 * der Angebotszeile eine Ausnahme werfen, einer ohne `tags` in der Suche.
 * Deshalb wird hier vollständig gemacht, was gekürzt ankam.
 */

/** Die Felder, die weggelassen werden dürfen, mit ihrem Ersatzwert. */
export const VORGABEN = {
  cuisine: '',
  tags: [],
  serving: [],
  features: [],
  price: '€',
  category: 'sonstiges',
  address: '',
  zip: '',
  city: '',
  country: '',
  region: '',
  phone: '',
  website: '',
  description: '',
  menuNote: '',
  hours: null,
  bildUrl: null,
  bildQuelle: null,
  bildLizenz: null,
  quelleUrl: null,
  quelleStand: null,
  claimStatus: 'unclaimed',
  claimedBy: null,
  status: 'active',
  hasCover: false,
}

/** Macht einen gekürzten Betrieb wieder vollständig. */
export const vollstaendig = (betrieb) => ({ ...VORGABEN, ...betrieb })

/** Dasselbe für eine ganze Liste. */
export const alleVollstaendig = (betriebe) => (betriebe ?? []).map(vollstaendig)
