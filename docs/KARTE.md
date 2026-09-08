# Die Karte

Woher die Kacheln kommen, was wir daran ändern können und was ein eigener
Kartenserver bräuchte.

## Heute

```
Gerät ──► unser Server ──► tile.openstreetmap.org
             │
             ├── Zwischenspeicher auf der Platte
             └── src/http/kartenstil.js färbt um
```

| Was | Wo |
|---|---|
| Adressen der Kachelserver | `src/http/karte.js`, `QUELLEN` |
| Farbe, Helligkeit, Sättigung | `src/http/kartenstil.js`, `STILE` |
| PNG lesen und schreiben | `src/http/kachelbild.js` |
| Ersatzkachel, wenn nichts kommt | dito, `ersatzkachel()` |

### Der Standardstil, nicht der deutsche

Wir holen von `tile.openstreetmap.org`. Das ist der Stil, den man auf
openstreetmap.org sieht, wenn man nichts umstellt.

**Nicht** `tile.openstreetmap.de`. Das ist der deutsche Stil mit eigenen
Farben und deutschen Beschriftungen. Wer ihn will, trägt ihn in `QUELLEN` ein;
von selbst kommt er nie.

Auch nicht die Verkehrsansicht (ÖPNV), die Bahnlinien und Haltestellen
hervorhebt.

## Was wir ändern können

Farbe. Und das reicht weiter, als es klingt: Der Unterschied zwischen der
Karte von OpenStreetMap und der von Google ist zum größten Teil Farbe.
Entsättigter, heller, weniger Kontrast.

```bash
node src/index.js                    # roh, unverändert
KARTE_STIL=ruhig  node src/index.js  # heller, entsättigt
KARTE_STIL=dunkel node src/index.js  # für den Dunkelmodus
```

Ein eigener Stil ist ein Eintrag in `STILE`:

```js
meiner: {
  helligkeit: 1.06,   // 1 lässt alles, wie es ist
  saettigung: 0.62,   // 0 grau, 1 unverändert
  kontrast: 0.92,     // unter 1 flacher, wirkt ruhiger
  umkehren: false,    // true für eine dunkle Karte
  tonung: [1, .98, .94],
  staerke: 0.14,      // wie stark die Tönung wirkt
}
```

Die Kacheln liegen je Stil getrennt im Zwischenspeicher. Ein Wechsel wirft
also nichts weg, und man kann zwei Stile nebeneinander ausprobieren.

## Was wir **nicht** ändern können

Alles, was mit der Zeichnung selbst zu tun hat:

- Straßen dünner oder dicker
- Beschriftungen weglassen oder in einer anderen Schrift
- Hausnummern ausblenden
- eigene Symbole für Restaurants direkt in der Karte

Wir bekommen fertige Bilder. Was darauf gezeichnet ist, steht fest, bevor wir
sie sehen.

## Was ein eigener Kartenserver bräuchte

Falls das später ansteht, hier der Weg, damit niemand von vorn recherchieren
muss.

### Weg A: eigene Rasterkacheln

1. **Daten**: ein Auszug von [Geofabrik](https://download.geofabrik.de/),
   Deutschland etwa 4 GB.
2. **Datenbank**: PostgreSQL mit PostGIS, gefüllt über `osm2pgsql`. Für
   Deutschland rechnet man mit 50 bis 100 GB und einigen Stunden.
3. **Kartenblatt**: `openstreetmap-carto`, das offizielle Blatt hinter dem
   Standardstil. Es ist frei (CC0) und **genau das, was man bearbeitet**:
   Farben, Linienstärken, ab welcher Zoomstufe was erscheint.
4. **Renderer**: `renderd` mit `mod_tile`, oder `Tirex`.

Danach ändert man eine Farbe in `openstreetmap-carto`, startet den Renderer
neu, und die Karte sieht anders aus. Genau das, was mit fertigen Bildern nicht
geht.

Aufwand: eine Maschine mit reichlich Platte, ein Tag Einrichtung, danach
laufende Pflege.

### Weg B: Vektorkacheln

1. **Kacheln bauen** mit [Planetiler](https://github.com/onthegomap/planetiler),
   Deutschland in etwa einer halben Stunde auf einem normalen Rechner. Ergebnis
   ist eine einzige `.pmtiles`-Datei, ungefähr 5 GB.
2. **Ausliefern**: die Datei über einen gewöhnlichen Webserver, der
   Teilbereiche liefern kann. Mehr braucht es nicht.
3. **Zeichnen im Gerät**: MapLibre GL mit einem Stil als JSON.

Der Stil ist dann eine Datei in diesem Repository, und **jede** Eigenschaft
lässt sich ändern: Farben, Schriften, was ab welcher Zoomstufe erscheint,
eigene Symbole an unseren Betrieben.

Aufwand: ein Nachmittag zum Bauen, dazu MapLibre in der Oberfläche, das sind
etwa 200 KB. Dafür fällt jede Abhängigkeit von fremden Kachelservern weg.

**Weg B ist der bessere**, sobald es ernst wird. Weg A ist der ausgetretene.

## Warum jetzt keins von beidem

Beide brauchen eine Maschine, die dauerhaft läuft, und Platte im zweistelligen
Gigabyte-Bereich. Der Server läuft zurzeit in einem Workflow, der nach
höchstens fünfeinhalb Stunden endet. Solange das so ist, wäre ein eigener
Kartenserver ein Vorhaben ohne Ort.

Der Zwischenspeicher hier ist der kleine Bruder davon: Jede Kachel wird einmal
geholt und danach von unserer Platte bedient.
