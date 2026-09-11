/*
 * Kleines Protokoll des Hauptprozesses für die Diagnose (11. September 2026, "niemand sieht, wenn es bei den
 * Kollegen hakt"): Die letzten Zeilen von console.error und console.warn bleiben im Speicher und landen im
 * Diagnosetext (Einstellungen → System → "Diagnose kopieren"). Keine Datei, nichts wird verschickt.
 */

const MAX_ZEILEN = 80
const zeilen: string[] = []

function merken(art: string, teile: unknown[]): void {
  const text = teile
    .map((t) => (t instanceof Error ? `${t.name}: ${t.message}` : typeof t === 'string' ? t : JSON.stringify(t)))
    .join(' ')
  zeilen.push(`${new Date().toISOString()} ${art} ${text}`.slice(0, 400))
  if (zeilen.length > MAX_ZEILEN) zeilen.splice(0, zeilen.length - MAX_ZEILEN)
}

/** Hängt sich an console.error und console.warn; einmal beim Start aufrufen. */
export function protokollEinrichten(): void {
  const error = console.error.bind(console)
  const warn = console.warn.bind(console)
  console.error = (...teile: unknown[]): void => {
    merken('FEHLER', teile)
    error(...teile)
  }
  console.warn = (...teile: unknown[]): void => {
    merken('WARNUNG', teile)
    warn(...teile)
  }
  process.on('uncaughtException', (fehler) => merken('AUSNAHME', [fehler]))
  process.on('unhandledRejection', (grund) => merken('ABGELEHNT', [grund]))
}

/** Die gemerkten Zeilen, älteste zuerst. */
export function protokollZeilen(): string[] {
  return zeilen.slice()
}
