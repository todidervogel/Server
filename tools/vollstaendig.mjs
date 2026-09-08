import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

/**
 * Ist alles im Repository, was der Server zum Starten braucht?
 *
 * ┌─ Wozu ───────────────────────────────────────────────────────────────────┐
 * │  Läuft in `npm test` und im Workflow, bevor der Server startet.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ── Warum es diese Prüfung gibt ───────────────────────────────────────────
 *
 * In `.gitignore` stand `data/`, gemeint war der Ordner mit der Datenbank.
 * Ohne führenden Schrägstrich passt das Muster aber auf **jeden** Ordner
 * dieses Namens, also auch auf `src/data/` mit dem Ausgangsbestand.
 *
 * Die Dateien, die dort schon lagen, blieben eingecheckt. Eine neue
 * (`zustand.js`) wurde stillschweigend nicht mitgenommen. Lokal lief alles
 * weiter, die Tests waren grün, der Push ging durch. Erst auf dem Runner,
 * der frisch klont, brach der Server ab:
 *
 *     Cannot find module .../src/data/zustand.js
 *
 * Kein Test kann so etwas finden, weil jeder Test auf demselben Rechner
 * läuft, auf dem die Datei liegt. Gefragt werden muss git, nicht das
 * Dateisystem.
 *
 * Diese Prüfung geht von `src/index.js` aus jedem lokalen Import nach und
 * fragt für jede gefundene Datei: Kennt git dich?
 */

const WURZEL = resolve(import.meta.dirname, '..')

/* Alles, was git kennt. Einmal abfragen statt einmal je Datei. */
const bekannt = new Set(
  execFileSync('git', ['ls-files'], { cwd: WURZEL, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean),
)

const gesehen = new Set()
const fehlend = []
const unauffindbar = []

/** Findet die lokalen Importe einer Datei. Keine Pakete, keine node:-Module. */
function importe(quelltext) {
  const treffer = [...quelltext.matchAll(/(?:import|export)[^'"]*?from\s*['"](\.[^'"]+)['"]/g)]
  const dynamisch = [...quelltext.matchAll(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g)]
  return [...treffer, ...dynamisch].map((t) => t[1])
}

function verfolgen(datei) {
  const pfad = resolve(datei)
  if (gesehen.has(pfad)) return
  gesehen.add(pfad)

  if (!existsSync(pfad)) { unauffindbar.push(relative(WURZEL, pfad)); return }

  const relativ = relative(WURZEL, pfad)
  if (!bekannt.has(relativ)) fehlend.push(relativ)

  for (const ziel of importe(readFileSync(pfad, 'utf8'))) {
    verfolgen(resolve(dirname(pfad), ziel))
  }
}

/* Beide Einstiegspunkte: der Server und der Rauchtest. */
verfolgen(resolve(WURZEL, 'src/index.js'))
verfolgen(resolve(WURZEL, 'test/smoke.mjs'))

console.log(`${gesehen.size} Dateien am Programm beteiligt.`)

if (unauffindbar.length) {
  console.error('\nDiese Dateien werden importiert, gibt es aber nicht:')
  unauffindbar.forEach((d) => console.error(`  ${d}`))
}

if (fehlend.length) {
  console.error('\nDiese Dateien kennt git nicht, nach dem Klonen fehlen sie:')
  fehlend.forEach((d) => console.error(`  ${d}`))
  console.error('\nMeist steht ein zu weites Muster in .gitignore.')
  console.error('Nachsehen mit:  git check-ignore -v <datei>')
}

if (fehlend.length || unauffindbar.length) process.exitCode = 1
else console.log('Alles davon liegt im Repository.')
