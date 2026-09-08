/**
 * Entfernungen und die Umrechnung auf die Übersichtskarte.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/domain/derive.js         hängt distanceKm an jeden Betrieb          │
 * │  src/domain/videos.js         schneidet den Feed nach Umkreis            │
 * │  src/domain/places.js         Filter „im Umkreis von …"                  │
 * │  tools/osm-import.mjs         hat dieselbe Formel noch einmal, bewusst:  │
 * │                               das Werkzeug soll ohne Fachlogik laufen    │
 * │  Website-/src/lib/map.js      rechnet Marker in Bildpunkte um            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Solange keine echte Kartenbibliothek eingebunden ist, zeichnet die
 * Kartenansicht die Betriebe als Punkte auf eine Fläche. Die Rechnung hier
 * ist dieselbe, die später MapLibre übernimmt, nur ohne Kacheln.
 */

const R = 6371 /* Erdradius in km */
const rad = (deg) => (deg * Math.PI) / 180

/** Luftlinie zwischen zwei Punkten in Kilometern (Haversine). */
export function distanceKm(a, b) {
  if (!a || !b) return null
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** „450 m" bzw. „1,2 km", deutsche Schreibweise mit Komma. */
export function formatDistance(km) {
  if (km == null) return ''
  if (km < 1) return `${Math.round(km * 1000 / 10) * 10} m`
  return `${km.toFixed(1).replace('.', ',')} km`
}

/**
 * Position auf der Kartenfläche in Prozent.
 * `center` ist der Mittelpunkt, `spanKm` die Breite des sichtbaren Bereichs.
 */
export function toMapPercent(point, center, spanKm = 8) {
  const kmPerLat = 111.32
  const kmPerLng = 111.32 * Math.cos(rad(center.lat))
  const dx = (point.lng - center.lng) * kmPerLng
  const dy = (point.lat - center.lat) * kmPerLat
  return {
    left: 50 + (dx / spanKm) * 100,
    top: 50 - (dy / spanKm) * 100,
  }
}
