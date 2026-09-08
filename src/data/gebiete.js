/**
 * Welche Gegenden importiert werden.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  tools/osm-import.mjs   fragt Overpass für jede Gegend einzeln ab        │
 * │  tools/orte-pruefen.mjs prüft, dass alles im bestellten Umkreis liegt    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ── Zwei Gruppen, und warum ───────────────────────────────────────────────
 *
 * **kern** sind die drei ausdrücklich bestellten Gegenden. Sie landen in
 * `src/data/orte.js`, einem Modul, das auch die Website mitnimmt. Damit
 * funktioniert der Alleinbetrieb im Browser ohne Server.
 *
 * **deutschland** ist die Fläche: die größten Städte des Landes. Diese Menge
 * landet in `src/data/deutschland.json` und wird **nur vom Server** gelesen
 * (src/index.js). Sie gehört nicht in die Weboberfläche: Zwölftausend Betriebe
 * als JavaScript-Modul wären mehrere Megabyte, die jedes Handy bei jedem Start
 * herunterlädt und auspackt, damit es dann doch nur die zehn in der Nähe
 * anzeigt.
 *
 * Wer die App ohne Server benutzt, sieht also die drei Kern-Gegenden. Wer sie
 * mit Server benutzt, sieht ganz Deutschland. Das ist die richtige Aufteilung:
 * Die Fläche ist genau das, wofür es einen Server gibt.
 */

/** Die ausdrücklich bestellten Gegenden. */
export const KERN = [
  { key: 'alcossebre', name: 'Alcossebre', land: 'ES', lat: 40.2408, lng: 0.2706, km: 25 },
  { key: 'rheinmuenster', name: 'Rheinmünster', land: 'DE', lat: 48.7686, lng: 8.0511, km: 30 },
  { key: 'oberkirch', name: 'Oberkirch', land: 'DE', lat: 48.5333, lng: 8.0833, km: 30 },
]

/**
 * Deutschland, über seine Städte abgedeckt.
 *
 * Warum Städte und kein Raster: Gastronomie sitzt dort, wo Menschen sind. Ein
 * gleichmäßiges Raster über die Bundesrepublik verbrauchte die Hälfte seiner
 * Abfragen über Feldern.
 *
 * Der Umkreis richtet sich nach der Größe: Bei Berlin und Hamburg deckt er die
 * Stadt ab, bei einer Kreisstadt greift er ins Umland und nimmt die Dörfer
 * mit. Überlappungen sind kein Problem, der Import ordnet jeden Betrieb der
 * Gegend zu, deren Mitte näher liegt.
 */
export const DEUTSCHLAND = [
  ['berlin', 'Berlin', 52.5200, 13.4050, 20],
  ['hamburg', 'Hamburg', 53.5511, 9.9937, 18],
  ['muenchen', 'München', 48.1351, 11.5820, 16],
  ['koeln', 'Köln', 50.9375, 6.9603, 15],
  ['frankfurt', 'Frankfurt am Main', 50.1109, 8.6821, 15],
  ['stuttgart', 'Stuttgart', 48.7758, 9.1829, 15],
  ['duesseldorf', 'Düsseldorf', 51.2277, 6.7735, 13],
  ['leipzig', 'Leipzig', 51.3397, 12.3731, 15],
  ['dortmund', 'Dortmund', 51.5136, 7.4653, 13],
  ['essen', 'Essen', 51.4556, 7.0116, 12],
  ['bremen', 'Bremen', 53.0793, 8.8017, 15],
  ['dresden', 'Dresden', 51.0504, 13.7373, 15],
  ['hannover', 'Hannover', 52.3759, 9.7320, 15],
  ['nuernberg', 'Nürnberg', 49.4521, 11.0767, 14],
  ['duisburg', 'Duisburg', 51.4344, 6.7623, 12],
  ['bochum', 'Bochum', 51.4818, 7.2162, 11],
  ['wuppertal', 'Wuppertal', 51.2562, 7.1508, 11],
  ['bielefeld', 'Bielefeld', 52.0302, 8.5325, 13],
  ['bonn', 'Bonn', 50.7374, 7.0982, 11],
  ['muenster', 'Münster', 51.9607, 7.6261, 13],
  ['karlsruhe', 'Karlsruhe', 49.0069, 8.4037, 12],
  ['mannheim', 'Mannheim', 49.4875, 8.4660, 11],
  ['augsburg', 'Augsburg', 48.3705, 10.8978, 12],
  ['wiesbaden', 'Wiesbaden', 50.0782, 8.2398, 11],
  ['moenchengladbach', 'Mönchengladbach', 51.1805, 6.4428, 11],
  ['gelsenkirchen', 'Gelsenkirchen', 51.5177, 7.0857, 10],
  ['braunschweig', 'Braunschweig', 52.2689, 10.5268, 13],
  ['kiel', 'Kiel', 54.3233, 10.1228, 13],
  ['chemnitz', 'Chemnitz', 50.8278, 12.9214, 13],
  ['aachen', 'Aachen', 50.7753, 6.0839, 12],
  ['halle', 'Halle (Saale)', 51.4825, 11.9705, 13],
  ['magdeburg', 'Magdeburg', 52.1205, 11.6276, 13],
  ['freiburg', 'Freiburg im Breisgau', 47.9990, 7.8421, 13],
  ['krefeld', 'Krefeld', 51.3388, 6.5853, 10],
  ['mainz', 'Mainz', 49.9929, 8.2473, 11],
  ['luebeck', 'Lübeck', 53.8655, 10.6866, 13],
  ['erfurt', 'Erfurt', 50.9848, 11.0299, 13],
  ['oberhausen', 'Oberhausen', 51.4963, 6.8638, 9],
  ['rostock', 'Rostock', 54.0924, 12.0991, 13],
  ['kassel', 'Kassel', 51.3127, 9.4797, 13],
  ['hagen', 'Hagen', 51.3671, 7.4633, 11],
  ['potsdam', 'Potsdam', 52.3906, 13.0645, 12],
  ['saarbruecken', 'Saarbrücken', 49.2402, 6.9969, 13],
  ['hamm', 'Hamm', 51.6739, 7.8150, 11],
  ['ludwigshafen', 'Ludwigshafen am Rhein', 49.4774, 8.4452, 9],
  ['muelheim', 'Mülheim an der Ruhr', 51.4275, 6.8825, 9],
  ['oldenburg', 'Oldenburg', 53.1435, 8.2146, 13],
  ['osnabrueck', 'Osnabrück', 52.2799, 8.0472, 13],
  ['leverkusen', 'Leverkusen', 51.0459, 6.9853, 9],
  ['heidelberg', 'Heidelberg', 49.3988, 8.6724, 11],
  ['darmstadt', 'Darmstadt', 49.8728, 8.6512, 11],
  ['solingen', 'Solingen', 51.1652, 7.0670, 9],
  ['regensburg', 'Regensburg', 49.0134, 12.1016, 13],
  ['herne', 'Herne', 51.5388, 7.2257, 8],
  ['paderborn', 'Paderborn', 51.7189, 8.7575, 13],
  ['neuss', 'Neuss', 51.2042, 6.6879, 9],
  ['ingolstadt', 'Ingolstadt', 48.7665, 11.4258, 13],
  ['offenbach', 'Offenbach am Main', 50.0956, 8.7761, 8],
  ['fuerth', 'Fürth', 49.4783, 10.9903, 8],
  ['wuerzburg', 'Würzburg', 49.7913, 9.9534, 13],
  ['ulm', 'Ulm', 48.4011, 9.9876, 13],
  ['heilbronn', 'Heilbronn', 49.1427, 9.2109, 13],
  ['pforzheim', 'Pforzheim', 48.8922, 8.6946, 12],
  ['wolfsburg', 'Wolfsburg', 52.4227, 10.7865, 12],
  ['goettingen', 'Göttingen', 51.5413, 9.9158, 13],
  ['bottrop', 'Bottrop', 51.5216, 6.9289, 8],
  ['reutlingen', 'Reutlingen', 48.4914, 9.2043, 12],
  ['koblenz', 'Koblenz', 50.3569, 7.5890, 13],
  ['bremerhaven', 'Bremerhaven', 53.5396, 8.5809, 12],
  ['erlangen', 'Erlangen', 49.5897, 11.0120, 10],
  ['remscheid', 'Remscheid', 51.1787, 7.1897, 9],
  ['trier', 'Trier', 49.7490, 6.6371, 13],
  ['jena', 'Jena', 50.9271, 11.5892, 12],
  ['siegen', 'Siegen', 50.8748, 8.0243, 13],
  ['hildesheim', 'Hildesheim', 52.1508, 9.9511, 13],
  ['salzgitter', 'Salzgitter', 52.1508, 10.3345, 12],
  ['kaiserslautern', 'Kaiserslautern', 49.4401, 7.7491, 13],
  ['flensburg', 'Flensburg', 54.7937, 9.4469, 13],
  ['schwerin', 'Schwerin', 53.6355, 11.4012, 13],
  ['cottbus', 'Cottbus', 51.7563, 14.3329, 13],
  ['konstanz', 'Konstanz', 47.6603, 9.1758, 13],
  ['passau', 'Passau', 48.5667, 13.4319, 13],
  ['garmisch', 'Garmisch-Partenkirchen', 47.4917, 11.0956, 15],
  ['norderney', 'Ostfriesische Küste', 53.6000, 7.1500, 20],
  ['sylt', 'Sylt', 54.9086, 8.3175, 18],
  ['ruegen', 'Rügen', 54.4167, 13.4000, 20],
  ['schwarzwald-sued', 'Südschwarzwald', 47.8000, 8.0000, 20],
  ['allgaeu', 'Allgäu', 47.6833, 10.3167, 20],
  ['bodensee', 'Bodensee', 47.7000, 9.4000, 18],
  ['mosel', 'Mosel', 49.9500, 7.1000, 20],
  ['harz', 'Harz', 51.7500, 10.6167, 20],
]
  .map(([key, name, lat, lng, km]) => ({ key, name, land: 'DE', lat, lng, km }))

/** Alle Gruppen, die `tools/osm-import.mjs --gruppe …` kennt. */
export const GRUPPEN = {
  kern: { gegenden: KERN, ziel: 'modul', standardMax: 120 },
  deutschland: { gegenden: DEUTSCHLAND, ziel: 'json', standardMax: 150 },
}
