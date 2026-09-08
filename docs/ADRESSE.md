# adresse.json

Die Datei im Wurzelverzeichnis dieses Repositorys sagt, **wo der Server gerade
läuft**.

```json
{
  "adresse": "https://sneeze-till-paternity.ngrok-free.dev",
  "seit": "2026-09-08T07:12:00Z",
  "laeuftBis": "2026-09-08T08:12:00Z",
  "beendet": false,
  "lauf": "https://github.com/todidervogel/Server/actions/runs/123"
}
```

| Feld | Bedeutung |
|---|---|
| `adresse` | Die Adresse, unter der der Server erreichbar ist. Leer, wenn keiner läuft. |
| `seit` | Wann der Lauf begonnen hat. |
| `laeuftBis` | Wann er von selbst aufhört. Ein Workflow läuft höchstens 5,5 Stunden. |
| `beendet` | `true`, sobald der Lauf vorbei ist. Dann ist die Adresse tot. |
| `lauf` | Der Workflow-Lauf, falls man ins Protokoll sehen will. |

## Wer schreibt sie

Der Workflow **Server über ngrok**, zweimal: einmal, wenn der Tunnel steht,
und einmal am Ende, um sie als abgelaufen zu markieren. Geschrieben wird über
die Contents-API (`.github/adresse-hochladen.sh`), nicht mit `git push`, weil
der Runner nur den letzten Commit klont und ein Rebase darauf unzuverlässig
ist.

## Wer liest sie

| Wer | Wozu |
|---|---|
| **APK-Bau** (`App/.github/workflows/android.yml`) | Bleibt das Feld *Adresse* leer, holt der Bau sie sich von hier. |
| **Die App** (`Website-/src/lib/store/api.js`) | Einstellungen, Verbindung, „Aktuelle Adresse holen". |

Öffentlich abrufbar unter:

```
https://raw.githubusercontent.com/todidervogel/Server/main/adresse.json
```

## Warum eine Datei im Repository

Weil sie von überall lesbar sein muss, ohne Zugangsdaten, und weil sie
zwischen zwei Läufen bestehen bleibt.

Verworfen: eine Repository-Variable (der Standard-Token darf keine schreiben),
ein Artefakt (nur mit Token lesbar, und nicht aus einem anderen Repository)
und ein Gist (ein Zugang mehr, den jemand pflegen muss).

## Was dort **nicht** steht

Kein Token, kein Passwort, kein Zugangsmerkmal. Nur eine Adresse, die ohnehin
jeder kennt, der die App benutzt. Wer sie hat, kommt an dieselbe Anmeldung
wie alle anderen und nicht daran vorbei.
