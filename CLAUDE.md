# Arbeitsregeln für dieses Projekt

Diese Datei gilt für jede Sitzung, auch für spätere. Sie steht in jedem der
fünf Repositories, weil jede Sitzung nur eines davon offen haben kann.

## Bei **jeder** Änderung, ohne Ausnahme

### 1. Abhängigkeiten prüfen

Bevor etwas als fertig gilt: Wer hängt an dem, was ich gerade geändert habe?

| Was ich anfasse | Wer daran hängt |
|---|---|
| `Server/src/domain/` | der Server **und** die Website (eingespielte Kopie unter `Website-/src/domain`) |
| `Server/src/data/` | dito, plus `Website-/tools/pruefbestand.mjs` |
| `Server/src/http/` | nur der Server |
| `design/src/` | `Website-/src/design`, eingespielt über `tools/sync.mjs` |
| `Website-/src/` | die Webseite **und** die App, die dieselbe Oberfläche einpackt |
| Klassennamen im CSS | alles, was diese Klasse benutzt. **Zweimal derselbe Name in zwei Bausteinen war schon zweimal ein Fehler.** |
| `.gitignore` | ein Muster ohne `/` vorn trifft jeden Ordner dieses Namens |

Nach einer Änderung an `design` oder `Server`:

```bash
cd Website- && node tools/sync.mjs design --from ../design
                node tools/sync.mjs domain --from ../Server
```

### 2. Auf Fehler prüfen

Nicht „sieht richtig aus", sondern laufen lassen:

```bash
# Server
cd Server && npm test            # Vollständigkeit, Rauchtest, Datenbank, Karte
             node tools/orte-pruefen.mjs

# Website und App-Oberfläche
cd Website- && npm run build
               npm run pruefen:i18n
               npm run pruefen:karte
               npx vite preview --port 4173 &   # dann:
               node tools/verhalten.mjs
               node tools/bilder.mjs --breite handy

# App
cd App && node tools/pruefen.mjs
```

**Ein Skript, das viele Dateien anfasst, braucht danach eine Prüfung.** Beim
Entfernen der Gedankenstriche hat eine zu weite Regel `(?, ?, ?)` in SQL zu
`(? ? ?)` gemacht. Aufgefallen, weil die Tests liefen.

**Bildschirmfotos finden, was Tests nicht finden.** Ein Platzhalter, der
wörtlich auf der Seite steht, ein Text, der aus seinem Feld läuft, ein Symbol
an der falschen Stelle: kein Test sieht das, ein Bild schon.

### 3. Kommentare mitziehen

Jede Datei in `src/` beginnt mit einem Kasten, der sagt, wer sie benutzt:

```
 ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
 │  src/domain/calls.js    social.*, alles nur angemeldet                   │
 │  src/domain/derive.js   viewerLiked / viewerSaved / viewerFollow          │
 └──────────────────────────────────────────────────────────────────────────┘
```

Ändert sich, wer eine Datei benutzt, ändert sich der Kasten mit. Darunter
steht, **warum** etwas so ist, nicht was der Code tut. Das steht im Code.

Wer einen Fehler behebt, schreibt in einem Satz dazu, was schiefging. Diese
Sätze sind der eigentliche Wert der Kommentare.

### 4. Die .md-Dateien mitziehen

| Datei | Wann sie sich ändert |
|---|---|
| `Brain/STAND.md` | bei **jeder** Aktion. Ampel, was ansteht, was mich beschäftigt |
| `Brain/03-verlauf/` | ein Eintrag je Runde: Auftrag, was gebaut wurde, was kaputt war |
| `Brain/00-produkt/ENTSCHEIDUNGEN.md` | wenn eine Entscheidung fällt oder zurückgenommen wird |
| `Brain/02-technik/` | wenn sich Architektur, Datenmodell oder Zugänge ändern |
| `README.md` des Repos | wenn sich ändert, wie man es benutzt |

### 5. Vor der Arbeit einen Sicherungszweig anlegen

Jede Runde beginnt mit einem Zweig, der den Stand *vorher* festhält, in allen
fünf Repositories:

```bash
git push origin main:backup/vor-runde-<nummer>-<datum>
```

Warum: Die Arbeit läuft auf einem Rechner, der nach der Sitzung verschwindet.
Ein Zweig auf GitHub überlebt das. Wenn eine Runde etwas kaputt macht, ist der
Weg zurück ein Klick und keine Rekonstruktion.

Der Zweig wird nie gelöscht und nie überschrieben. Er kostet nichts.

## Sprache

Deutsch, in ganzen Sätzen, ohne lange Gedankenstriche. Sie wirken maschinell.
Vor einer Konjunktion ein Komma, vor einem neuen Hauptsatz ein Punkt.

## Was nie passieren darf

- **Keine Zugangsdaten im Repository.** Auch nicht in einer ignorierten Datei:
  Was einmal eingecheckt war, steht für immer in der Versionsgeschichte.
- **Keine erfundenen Inhalte im Ausgangsbestand.** Was zum Prüfen gebraucht
  wird, steht im Prüfwerkzeug (`Website-/tools/pruefbestand.mjs`).
- **Keine übernommenen Bewertungen** aus fremden Quellen, und keine fremden
  Fotos. Warum, steht in `Brain/00-produkt/ENTSCHEIDUNGEN.md` (E23, E25).
- **Die Fachlogik unter `Server/src/domain/` bleibt umgebungsneutral.** Kein
  `node:fs`, kein `node:crypto`, kein `window`. Sie läuft auch im Browser.
