#!/usr/bin/env bash
# Legt adresse.json über die Contents-API im Repository ab.
#
# ┌─ Wer benutzt diese Datei ────────────────────────────────────────────────┐
# │  .github/workflows/server-ngrok.yml   zweimal: beim Start und am Ende    │
# │  App/.github/workflows/android.yml    liest das Ergebnis                 │
# │  Website-/src/lib/store/api.js        dito, zur Laufzeit                 │
# └──────────────────────────────────────────────────────────────────────────┘
#
# Warum die API und nicht `git push`: Der Runner klont nur den letzten Commit.
# Ein Rebase darauf ist unzuverlässig, ein PUT auf eine einzelne Datei nicht.
# Und es kann nichts überfahren, was jemand anderes gerade geschoben hat.
set -euo pipefail

DATEI=adresse.json
API="https://api.github.com/repos/${GITHUB_REPOSITORY}/contents/${DATEI}"

# Die Fassung, die schon dort liegt. Ohne ihren Fingerabdruck lehnt GitHub das
# Überschreiben ab, und das ist gut so.
SHA=$(curl -sS -H "authorization: Bearer ${GH_TOKEN}" "$API?ref=main" | jq -r '.sha // empty')

INHALT=$(base64 -w0 < "$DATEI")

ANTWORT=$(curl -sS -X PUT -H "authorization: Bearer ${GH_TOKEN}" \
  -H 'content-type: application/json' "$API" \
  -d "$(jq -n --arg m "Serveradresse aktualisiert" --arg c "$INHALT" --arg s "$SHA" \
        '{message: $m, content: $c, branch: "main"} + (if $s == "" then {} else {sha: $s} end)')")

if echo "$ANTWORT" | jq -e '.content.sha' > /dev/null; then
  echo "adresse.json veröffentlicht."
else
  echo "adresse.json konnte nicht veröffentlicht werden:"
  echo "$ANTWORT" | jq -r '.message // .'
  exit 1
fi
