/*
 * Protokoll des Hauptprozesses (11. September 2026, "niemand sieht, wenn es bei den Kollegen hakt"; seit
 * 15. September 2026 auch als Datei): Fehler, Warnungen und Hinweise bleiben im Speicher (Diagnosetext unter
 * Einstellungen → System → "Diagnose kopieren") UND landen in `protokoll.log` im Datenordner, damit auch nach
 * einem Absturz oder Neustart nachvollziehbar ist, was passiert war. Die Datei wächst höchstens auf rund 1 MB,
 * dann wird sie zu `protokoll.alt.log` und eine neue beginnt. Nichts wird verschickt.
 */
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'fs'
import { dirname, join } from 'path'

const MAX_ZEILEN = 80
const MAX_DATEI_BYTES = 1_000_000
const zeilen: string[] = []
/** Zeilen, die vor dem Festlegen der Datei anfielen (der Datenordner ist erst nach app.whenReady bekannt). */
const wartend: string[] = []
let dateiPfad: string | null = null

function zeileBauen(art: string, teile: unknown[]): string {
  const text = teile
    .map((t) => (t instanceof Error ? `${t.name}: ${t.message}` : typeof t === 'string' ? t : JSON.stringify(t)))
    .join(' ')
  return `${new Date().toISOString()} ${art} ${text}`.slice(0, 600)
}

function inDatei(zeile: string): void {
  if (!dateiPfad) {
    wartend.push(zeile)
    if (wartend.length > 500) wartend.splice(0, wartend.length - 500)
    return
  }
  try {
    mkdirSync(dirname(dateiPfad), { recursive: true })
    if (existsSync(dateiPfad) && statSync(dateiPfad).size > MAX_DATEI_BYTES) {
      renameSync(dateiPfad, dateiPfad.replace(/\.log$/, '.alt.log'))
    }
    appendFileSync(dateiPfad, zeile + '\n', 'utf8')
  } catch {
    // Wenn nicht einmal das Protokoll geschrieben werden kann, bleibt nur der Speicher.
  }
}

function merken(art: string, teile: unknown[], auchImSpeicher = true): void {
  const zeile = zeileBauen(art, teile)
  if (auchImSpeicher) {
    zeilen.push(zeile.slice(0, 400))
    if (zeilen.length > MAX_ZEILEN) zeilen.splice(0, zeilen.length - MAX_ZEILEN)
  }
  inDatei(zeile)
}

/** Hängt sich an console.error, console.warn und console.log; einmal beim Start aufrufen. */
export function protokollEinrichten(): void {
  const error = console.error.bind(console)
  const warn = console.warn.bind(console)
  const log = console.log.bind(console)
  console.error = (...teile: unknown[]): void => {
    merken('FEHLER', teile)
    error(...teile)
  }
  console.warn = (...teile: unknown[]): void => {
    merken('WARNUNG', teile)
    warn(...teile)
  }
  // Hinweise (Abgleich, Speicher, Start) nur in die Datei, nicht in den Diagnosetext.
  console.log = (...teile: unknown[]): void => {
    merken('HINWEIS', teile, false)
    log(...teile)
  }
  process.on('uncaughtException', (fehler) => merken('AUSNAHME', [fehler]))
  process.on('unhandledRejection', (grund) => merken('ABGELEHNT', [grund]))
}

/** Legt die Protokolldatei im Datenordner fest (nach app.whenReady) und schreibt bis dahin Gesammeltes weg. */
export function protokollDateiFestlegen(datenordner: string): void {
  dateiPfad = join(datenordner, 'protokoll.log')
  const alt = wartend.splice(0)
  for (const z of alt) inDatei(z)
}

/** Pfad der Protokolldatei (null, solange der Datenordner noch nicht bekannt ist). */
export function protokollPfad(): string | null {
  return dateiPfad
}

/** Eine Zeile mit Kennzeichen HINWEIS in Datei und Speicher (Start, Sitzung, Update, Wachhund). */
export function protokollNotiz(...teile: unknown[]): void {
  merken('HINWEIS', teile)
}

/** Die gemerkten Zeilen, älteste zuerst. */
export function protokollZeilen(): string[] {
  return zeilen.slice()
}
