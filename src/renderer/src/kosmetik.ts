import { STIMMUNGEN } from '@shared/spiel'

/*
 * Kosmetik aus dem Season Pass (22. September 2026): die Hintergrund-Stimmung tauscht die beiden Lichtfarben der App
 * (Orange und Grün) gegen ein anderes Paar. Sie wird als CSS-Variablen auf <html> gesetzt (styles.css liest sie für die
 * Lichtflecken) und hier für die Leinwand des Hintergrunds vorgehalten. Gemerkt wird sie im Hauptprozess (Ablage), das
 * Fenster bekommt sie mit dem Season-Stand; bis dahin gilt die zuletzt lokal gesehene (localStorage), damit der Start
 * nicht erst orange und dann violett ist.
 */

const SCHLUESSEL = 'kosmetik.hintergrund'
let aktuell = 'standard'

function rgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export function aktuelleStimmung(): string {
  return aktuell
}

/** "254, 83, 3" der aktuellen Stimmung, für rgba() auf der Leinwand. */
export function lichtRgbA(): string {
  return rgb((STIMMUNGEN[aktuell] ?? STIMMUNGEN.standard).a)
}

export function lichtRgbB(): string {
  return rgb((STIMMUNGEN[aktuell] ?? STIMMUNGEN.standard).b)
}

export function lichtFarbeA(): string {
  return (STIMMUNGEN[aktuell] ?? STIMMUNGEN.standard).a
}

export function lichtFarbeB(): string {
  return (STIMMUNGEN[aktuell] ?? STIMMUNGEN.standard).b
}

/** Stimmung anwenden; liefert true, wenn sie sich geändert hat (dann baut App.tsx den Hintergrund neu auf). */
export function stimmungAnwenden(schluessel: string | null): boolean {
  const neu = schluessel && STIMMUNGEN[schluessel] ? schluessel : 'standard'
  const geaendert = neu !== aktuell
  aktuell = neu
  const s = STIMMUNGEN[neu]
  const wurzel = document.documentElement.style
  wurzel.setProperty('--licht-a', rgb(s.a))
  wurzel.setProperty('--licht-b', rgb(s.b))
  try {
    if (neu === 'standard') localStorage.removeItem(SCHLUESSEL)
    else localStorage.setItem(SCHLUESSEL, neu)
  } catch {
    /* nur Komfort */
  }
  return geaendert
}

/** Beim Start: die zuletzt gesehene Stimmung, bis der Hauptprozess die gemerkte liefert. */
export function stimmungBeimStart(): void {
  try {
    stimmungAnwenden(localStorage.getItem(SCHLUESSEL))
  } catch {
    stimmungAnwenden(null)
  }
}
