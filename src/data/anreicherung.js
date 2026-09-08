/**
 * Angereicherte Angaben zu importierten Betrieben.
 *
 * OpenStreetMap liefert Name, Lage, Adresse und manchmal Öffnungszeiten. Was
 * ein Betrieb *ist* — Familienbetrieb seit 1937, Fischrestaurant an der
 * Promenade, Eisdiele mit eigener Produktion — steht dort nicht. Diese Datei
 * ergänzt das aus öffentlich zugänglichen Quellen.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WAS HIER STEHT UND WAS NICHT
 *
 * Hier stehen **Beschreibungen in eigenen Worten** und Angaben, die sich aus
 * mehreren Quellen decken: Art des Betriebs, Spezialitäten, was serviert wird.
 *
 * Hier stehen **keine Speisekarten mit Preisen**. Zwei Gründe:
 *
 *   1. Preise veralten. Eine Karte von heute ist in drei Monaten falsch, und
 *      falsche Preise auf unserer Seite sind unser Problem, nicht das des
 *      Betriebs.
 *   2. Abgeschrieben ist nicht dasselbe wie überprüft. Eine Karte gehört vom
 *      Betrieb selbst gepflegt — dafür gibt es den Gastro-Zugang.
 *
 * Jeder Eintrag nennt seine Quelle und das Datum. Die Betriebsseite zeigt
 * beides an, damit niemand die Angaben für bestätigt hält.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Der Schlüssel ist das Kürzel aus dem Import. Diese Datei überlebt jeden
 * neuen Import — `orte.js` wird überschrieben, sie nicht.
 */
export const anreicherung = {
  /* --- Oberkirch --------------------------------------------------------- */

  'metzgerei-bohnert-oberkirch': {
    description:
      'Metzgerei am Kirchplatz, seit 1937 in Familienhand und in dritter '
      + 'Generation geführt. Bekannt für hausgemachte Blut- und Leberwurst, '
      + 'Vesperspeck, Maultaschen und Schwarzwälder Schinken nach altem Rezept.',
    serving: ['fleisch'],
    tags: ['Metzgerei', 'Vesper', 'Schwarzwälder Schinken'],
    quelle: 'https://www.metzgerei-bohnert.de/',
    stand: '2026-09-07',
  },

  'mayer-s-cafethek-oberkirch': {
    description:
      'Café der Landbäckerei Zimmerer am Kirchplatz. Frühstück den ganzen Tag, '
      + 'mittags täglich wechselnde Gerichte aus der eigenen Küche, dazu Kuchen '
      + 'und Feingebäck aus der Backstube. Alles auch zum Mitnehmen.',
    serving: ['getraenke', 'suesses', 'vegetarisch', 'fleisch'],
    tags: ['Café', 'Frühstück', 'Mittagstisch', 'Kuchen'],
    quelle: 'https://www.landbaeckerei-zimmerer.de/cafes/mayer-s-cafethek/',
    stand: '2026-09-07',
  },

  'lui-e-lei-oberkirch': {
    description:
      'Italienischer Feinkostladen mit Café am Kirchplatz, früher „dinunno". '
      + 'Eigener Kaffee, Antipasti mit frisch aufgeschnittenem Schinken, '
      + 'wechselnder Mittagstisch und Pasta. Im Laden Erzeugnisse kleiner '
      + 'Betriebe aus Italien.',
    /* OSM hatte nur „sonstiges" — es ist ein Feinkostladen mit Café. */
    category: 'cafe',
    serving: ['getraenke', 'fleisch', 'vegetarisch', 'suesses'],
    cuisine: 'Italienisch',
    tags: ['Italienisch', 'Feinkost', 'Mittagstisch'],
    quelle: 'https://www.luielei.de/',
    stand: '2026-09-07',
  },

  /* --- Rheinmünster ------------------------------------------------------ */

  'zitadelle': {
    description:
      'Kneipe und Sportsbar in Stollhofen, seit Langem eine feste Adresse im '
      + 'Ort. Sportübertragungen auf mehreren Schirmen und Leinwand, einmal im '
      + 'Monat Livemusik.',
    /* OSM sagt „restaurant“ — es ist eine Kneipe. Das ändert die Angebotszeile. */
    category: 'bar',
    serving: ['getraenke'],
    cuisine: 'Kneipe',
    tags: ['Kneipe', 'Sportsbar', 'Livemusik'],
    quelle: 'https://www.zitadelle-stollhofen.de/',
    stand: '2026-09-07',
  },

  'pizzeria-da-franco': {
    description:
      'Italiener in Stollhofen mit Pizza, Pasta und Salaten. Bei gutem Wetter '
      + 'ist der große Biergarten geöffnet.',
    serving: ['fleisch', 'vegetarisch', 'fisch', 'suesses'],
    cuisine: 'Italienisch',
    tags: ['Italienisch', 'Pizza', 'Biergarten'],
    quelle: 'https://www.speisekarte.de/rheinm%C3%BCnster/restaurant/pizzeria_da_franco',
    stand: '2026-09-07',
  },

  /* --- Alcossebre -------------------------------------------------------- */

  'marimer': {
    description:
      'Direkt an der Strandpromenade, zusammengewachsen aus dem Strandlokal '
      + '„Mar" und dem Restaurant „Mer": vorne Tapas und einfache Gerichte, '
      + 'hinten unter Maulbeerbäumen gegrillter Fisch, Fleisch und Reisgerichte. '
      + 'Küchenchef ist Antonio Bellés. Geöffnet von Saisonbeginn bis Mitte '
      + 'Oktober.',
    serving: ['fisch', 'meeresfruechte', 'fleisch', 'vegetarisch'],
    cuisine: 'Mediterran',
    tags: ['Mediterran', 'Paella', 'Fisch', 'Tapas'],
    quelle: 'https://restaurantemarimer.com/',
    stand: '2026-09-07',
  },

  'ca-batiste-restaurant': {
    description:
      'Restaurant am Passeig de Vista Alegre mit Blick aufs Meer und großer '
      + 'Terrasse. Mediterrane Küche mit Schwerpunkt auf Reisgerichten und '
      + 'Fisch, dazu Tapas, Salate und Fideuá.',
    serving: ['fisch', 'meeresfruechte', 'fleisch', 'vegetarisch'],
    cuisine: 'Mediterran',
    tags: ['Mediterran', 'Paella', 'Fisch', 'Terrasse'],
    quelle: 'https://cabatiste.com/es',
    stand: '2026-09-07',
  },
}

/**
 * Setzt die angereicherten Angaben auf einen importierten Betrieb.
 *
 * `verified` fliegt dabei heraus: Der Import schrieb es früher mit, aber es
 * wird aus `claimStatus` berechnet (src/domain/derive.js). Ein gespeicherter
 * Wert daneben würde irgendwann etwas anderes sagen als die Rechnung.
 */
export function anreichern(betrieb) {
  const { verified, ...basis } = betrieb
  const dazu = anreicherung[basis.slug]
  if (!dazu) return basis
  const { quelle, stand, ...felder } = dazu
  return { ...basis, ...felder, quelleUrl: quelle, quelleStand: stand }
}
