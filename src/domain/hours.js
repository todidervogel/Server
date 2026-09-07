/**
 * Öffnungszeiten.
 *
 * Gespeichert werden Minuten seit Mitternacht, Werte über 24:00 laufen in den
 * nächsten Tag hinein (eine Bar, die um 3 Uhr schließt, steht als 27:00).
 * Damit lässt sich „jetzt geöffnet" wirklich ausrechnen.
 *
 * Ohne Sprachbezug: Diese Datei kennt nur Zahlen und Tageskürzel. Wie daraus
 * ein Satz wird, entscheidet die Oberfläche.
 */

export const DAY_KEYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']

/** JavaScript zählt ab Sonntag, wir ab Montag. */
export const dayKeyOf = (date) => DAY_KEYS[(date.getDay() + 6) % 7]

const pad = (n) => String(n).padStart(2, '0')

/** 690 → „11:30", 1500 → „01:00" (am Folgetag). */
export function formatMinutes(min) {
  const m = ((min % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/**
 * Eine Tageszeile: „11:30 – 22:00" — oder `null`, wenn geschlossen ist.
 * Das Wort „Geschlossen" setzt die Oberfläche, nicht diese Datei.
 */
export function formatDay(ranges) {
  if (!ranges || ranges.length === 0) return null
  return ranges.map(([from, to]) => `${formatMinutes(from)} – ${formatMinutes(to)}`).join(', ')
}

/** Sieben Zeilen für die Tabelle auf der Gastro-Seite. */
export function weekRows(hours) {
  return DAY_KEYS.map((day) => [day, formatDay(hours?.[day])])
}

/**
 * Ist gerade geöffnet? Berücksichtigt auch die Zeit nach Mitternacht, die
 * noch zum Vortag gehört.
 */
export function openState(hours, now = new Date()) {
  if (!hours) return { open: false }
  const minutes = now.getHours() * 60 + now.getMinutes()
  const todayKey = dayKeyOf(now)
  const yesterdayKey = DAY_KEYS[(DAY_KEYS.indexOf(todayKey) + 6) % 7]

  for (const [from, to] of hours[todayKey] ?? []) {
    if (minutes >= from && minutes < to) return { open: true, until: formatMinutes(to) }
  }
  /* Gestern geöffnet und über Mitternacht hinaus? */
  for (const [, to] of hours[yesterdayKey] ?? []) {
    if (to > 1440 && minutes < to - 1440) return { open: true, until: formatMinutes(to) }
  }

  /* Nächste Öffnung suchen — heute später, sonst an einem der nächsten Tage. */
  const laterToday = (hours[todayKey] ?? []).find(([from]) => from > minutes)
  if (laterToday) return { open: false, nextDay: 'today', nextAt: formatMinutes(laterToday[0]) }

  for (let i = 1; i <= 7; i += 1) {
    const key = DAY_KEYS[(DAY_KEYS.indexOf(todayKey) + i) % 7]
    const first = (hours[key] ?? [])[0]
    if (first) {
      return { open: false, nextDay: i === 1 ? 'tomorrow' : key, nextAt: formatMinutes(first[0]) }
    }
  }
  return { open: false }
}

/**
 * Die Zutaten für die Anzeige. Den Satz baut die Oberfläche, weil nur sie die
 * Sprache kennt — hier gibt es nur Zustand, Uhrzeit und Tageskürzel.
 */
export function openLabel(hours, now = new Date()) {
  const s = openState(hours, now)
  if (s.open) return { open: true, until: s.until, nextDay: null, nextAt: null }
  return { open: false, until: null, nextDay: s.nextDay ?? null, nextAt: s.nextAt ?? null }
}
