# Server

Die Fachlogik und die HTTP-Schnittstelle. **Ohne Fremdabhängigkeiten** —
`npm install` lädt nichts nach, es genügt Node 20 oder neuer.

```bash
npm start          # http://localhost:4000
npm test           # 30 Prüfungen, eigener Server im Arbeitsspeicher
npm run dev        # startet bei Änderungen neu
npm run reset      # Daten auf den Auslieferungsstand zurücksetzen
```

## Gleich mal ausprobieren

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/places
curl http://localhost:4000/api/g/trattoria-bella/speisekarte

# Anmelden und den Zugang merken
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"identifier":"ana@intern","password":"Admin1234"}' | grep -o '"token": "[^"]*' | cut -d'"' -f4)

# Was liegt in der Freigabe?
curl -s -X POST http://localhost:4000/api/rpc \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"method":"videos.pending"}'
```

Ohne Anmeldung dasselbe versuchen — es kommt `401`. Das ist der Punkt: Die
Rechte hängen am Server, nicht an der Oberfläche.

## Zugänge

Alles erfunden, alles nur in `data/db.json`.

| Rolle | E-Mail | Passwort |
|---|---|---|
| Nutzer | `max@beispiel.de` | `Passwort123` |
| Nutzer | `lisa@beispiel.de` | `Passwort123` |
| Gastro | `chef@trattoria-bella.de` | `Gastro123` |
| Gastro (erstes Login) | `hallo@morgenrot-cafe.de` | `Start1234` |
| Admin | `ana@intern` | `Admin1234` |

## Aufbau

```
src/
  index.js               Start: Datei-Datenhaltung + Server
  data/seed.js           Ausgangsdaten (10 Betriebe, Karten, Videos, Konten)
  domain/                ► die Fachlogik. Synchron, ohne Netz, ohne Browser.
    store.js             der eingehängte Datenzugriff
    derive.js            abgeleitete Werte (Bewertungen, Entfernung, Öffnung)
    places.js menu.js videos.js reviews.js social.js users.js
    notifications.js reports.js admin.js search.js gastro.js auth.js
    geo.js hours.js
  store/file-store.js    Datenhaltung in data/db.json
  http/
    server.js            HTTP, CORS, Leseadressen
    rpc.js               ► die Aufrufliste mit den Rechten
    tokens.js            Sitzungen
test/smoke.mjs           npm test
```

### Warum ein Eingang statt vieler Adressen?

`POST /api/rpc` nimmt `{ method, args }` und ruft genau eine Funktion aus der
Liste in [`src/http/rpc.js`](src/http/rpc.js) auf. Kein Aufruf, der dort nicht
steht, ist möglich, und zu jedem steht dabei, wer ihn machen darf:

```js
'menu.addDish': {
  who: 'gastro',
  guard: (ctx, [placeId]) => ownsPlace(ctx, placeId),
  call: (ctx, [placeId, categoryId, dish]) => domain.menu.addDish(placeId, categoryId, dish),
},
```

Das ist die Stelle, an der später die Row-Level-Security von Supabase steht.
Bis dahin gilt: **Was hier nicht erlaubt ist, geht nicht** — egal, was die
Oberfläche anbietet.

Daneben gibt es ein paar Leseadressen (`/api/places`, `/api/g/:slug`,
`/api/g/:slug/speisekarte`), damit man mit dem Browser nachsehen kann.

### Die Fachlogik liegt hier, nicht in der Website

`src/domain/` ist die einzige Quelle. Die Website spielt sich denselben Ordner
ein (`npm run sync:domain` dort) und hängt statt der Datei den Browserspeicher
ein. So läuft die Website auch ohne diesen Server — mit demselben Verhalten.

## Was noch fehlt

- **Echte Datenbank.** `data/db.json` ist eine Datei. PostgreSQL mit PostGIS
  kommt, wenn die Umkreissuche nicht mehr im Arbeitsspeicher rechnen soll.
- **Passwort-Hashing.** Die Passwörter stehen im Klartext. Beim Umzug auf
  einen Anmeldedienst fällt `domain/auth.js` weg.
- **Dateien.** Videos und Bilder liegen nirgends.
- **OpenStreetMap-Import.** Die zehn Betriebe sind erfunden. Der Overpass-
  Import ist der nächste große Schritt.
