/**
 * Titelbilder für Betriebsseiten, gezeichnet, nicht fotografiert.
 *
 * ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 * │  src/http/server.js                    GET /api/bild/betrieb/:slug.svg   │
 * │  Website-/src/routes/public/PlacePage.jsx   zeigt es als Kopfbild        │
 * │  src/domain/index.js                   gibt sie beiden weiter            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Sie liegt in der Fachlogik und nicht beim HTTP-Teil, weil beide sie
 * brauchen: der Server für die Adresse oben, und die Website im Alleinbetrieb,
 * wo es gar keinen Server gibt, den man fragen könnte. Reine Zeichenketten,
 * keine Umgebung, läuft in Node wie im Browser.
 *
 * ── Warum gezeichnet und nicht fotografiert ───────────────────────────────
 *
 * Gewünscht waren Bilder zu den Betriebsseiten. Fotos gibt es dafür nicht:
 *
 *   · Die Fotos bei Google Maps gehören denen, die sie gemacht haben. Sie
 *     herunterzuladen und selbst auszuliefern, verstößt gegen die
 *     Nutzungsbedingungen und gegen das Urheberrecht der Fotografen.
 *   · OpenStreetMap führt bei einigen wenigen Betrieben ein `image`- oder
 *     `wikimedia_commons`-Merkmal. Wo es das gibt, wird es benutzt
 *     (`bildUrl` am Betrieb), das sind aber deutlich unter fünf Prozent.
 *   · Ein zugekauftes Stockfoto von irgendeinem Restaurant wäre eine
 *     Behauptung über einen Betrieb, den niemand fotografiert hat.
 *
 * Bleibt: ein Bild, das ehrlich ist. Jeder Betrieb bekommt einen eigenen,
 * ruhigen Verlauf mit seinem Anfangsbuchstaben, aus dem Kürzel gerechnet,
 * also immer derselbe für denselben Betrieb. Die Seite sieht vollständig aus,
 * ohne etwas vorzugeben.
 *
 * Sobald ein Betrieb sein Konto übernimmt, lädt er ein echtes Foto hoch und
 * dieses hier verschwindet.
 *
 * SVG statt PNG: Es ist Text, wiegt unter einem Kilobyte, ist in jeder Größe
 * scharf und braucht keine Bildbibliothek.
 */

/**
 * Farbpaare je Art des Betriebs, warm und entsättigt, damit sie neben den
 * Inhalten nicht schreien. Die Töne stammen aus der Palette im design-Repo.
 */
const FARBEN = {
  restaurant: [['#8c4a3a', '#c98b63'], ['#7a4b52', '#c78f7a']],
  cafe: [['#7a6144', '#cbab7c'], ['#6f5a3f', '#c2a075']],
  bar: [['#3f4a63', '#7f8ba8'], ['#454063', '#8a83ac']],
  imbiss: [['#8a6a2f', '#d0aa62'], ['#7d5f2c', '#c79f5c']],
  baeckerei: [['#8a6a48', '#d6b489'], ['#7d5e40', '#cba97e']],
  eisdiele: [['#5f7a72', '#a8c7bb'], ['#557069', '#9dbdb1']],
  sonstiges: [['#5b5f66', '#a2a7af'], ['#54585f', '#9aa0a8']],
}

/**
 * Eine Zahl aus dem Kürzel.
 *
 * Es muss nicht sicher sein, nur gleichmäßig und immer gleich: Derselbe
 * Betrieb soll morgen dasselbe Bild haben wie heute. (FNV-1a, 32 Bit.)
 */
function streuwert(text) {
  let wert = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    wert ^= text.charCodeAt(i)
    wert = Math.imul(wert, 0x01000193) >>> 0
  }
  return wert
}

/** Der Anfangsbuchstabe, bei zwei Wörtern beide. */
function monogramm(name) {
  const woerter = String(name ?? '')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (!woerter.length) return '·'
  if (woerter.length === 1) return woerter[0].slice(0, 1).toUpperCase()
  return (woerter[0][0] + woerter[1][0]).toUpperCase()
}

const sicher = (text) => String(text ?? '').replace(/[<>&"']/g, (z) =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[z]))

/**
 * Zeichnet das Titelbild.
 *
 * @param betrieb  braucht nur slug, name und category
 * @param breite   Seitenverhältnis 16:9, die Größe bestimmt der Aufrufer
 */
export function titelbild(betrieb, { breite = 1200, hoehe = 675 } = {}) {
  const wert = streuwert(betrieb.slug ?? betrieb.name ?? '')
  const paare = FARBEN[betrieb.category] ?? FARBEN.sonstiges
  const [dunkel, hell] = paare[wert % paare.length]

  /* Der Verlauf steht bei jedem Betrieb etwas anders, das reicht, damit
     zwei Cafés nebeneinander nicht wie dasselbe Bild aussehen. */
  const winkel = 20 + (wert >>> 8) % 50
  const x = 20 + (wert >>> 3) % 60
  const y = 15 + (wert >>> 5) % 50

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${breite} ${hoehe}" width="${breite}" height="${hoehe}" role="img" aria-label="${sicher(betrieb.name)}">
  <defs>
    <linearGradient id="v" gradientTransform="rotate(${winkel})">
      <stop offset="0%" stop-color="${dunkel}"/>
      <stop offset="100%" stop-color="${hell}"/>
    </linearGradient>
    <radialGradient id="licht" cx="${x}%" cy="${y}%" r="70%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${breite}" height="${hoehe}" fill="url(#v)"/>
  <rect width="${breite}" height="${hoehe}" fill="url(#licht)"/>
  <circle cx="${breite * 0.82}" cy="${hoehe * 0.24}" r="${hoehe * 0.42}" fill="#ffffff" opacity="0.06"/>
  <circle cx="${breite * 0.18}" cy="${hoehe * 0.86}" r="${hoehe * 0.33}" fill="#000000" opacity="0.06"/>
  <text x="${breite / 2}" y="${hoehe / 2}" text-anchor="middle" dominant-baseline="central"
        font-family="Georgia, 'Times New Roman', serif" font-size="${hoehe * 0.2}"
        fill="#ffffff" opacity="0.55" letter-spacing="${hoehe * 0.02}">${sicher(monogramm(betrieb.name))}</text>
</svg>`
}
