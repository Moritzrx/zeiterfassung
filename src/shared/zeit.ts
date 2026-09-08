/**
 * Zeitrechnung in Europe/Berlin, unabhängig von der Zeitzone des Rechners.
 * Alle Zeitpunkte bleiben intern UTC; nur Tages- und Wochengrenzen werden hier bestimmt.
 */

export const ZEITZONE = 'Europe/Berlin'

const FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZEITZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
})

export interface Zeitteile {
  jahr: number
  monat: number
  tag: number
  stunde: number
  minute: number
  sekunde: number
}

/** Zerlegt einen Zeitpunkt in Berliner Wanduhrzeit. */
export function berlinTeile(zeitpunkt: Date): Zeitteile {
  const t: Record<string, number> = {}
  for (const teil of FORMAT.formatToParts(zeitpunkt)) {
    if (teil.type !== 'literal') t[teil.type] = Number(teil.value)
  }
  return {
    jahr: t.year,
    monat: t.month,
    tag: t.day,
    stunde: t.hour === 24 ? 0 : t.hour,
    minute: t.minute,
    sekunde: t.second
  }
}

function zweistellig(n: number): string {
  return String(n).padStart(2, '0')
}

/** Berliner Kalenderdatum als "JJJJ-MM-TT". */
export function berlinDatum(zeitpunkt: Date): string {
  const t = berlinTeile(zeitpunkt)
  return `${t.jahr}-${zweistellig(t.monat)}-${zweistellig(t.tag)}`
}

/**
 * Berliner Wanduhrzeit in einen UTC-Zeitpunkt umrechnen.
 * Tag darf über den Monat hinauslaufen (z. B. tag + 1), das wird normalisiert.
 */
export function berlinZuUtc(
  jahr: number,
  monat: number,
  tag: number,
  stunde = 0,
  minute = 0,
  sekunde = 0
): Date {
  const gewuenscht = Date.UTC(jahr, monat - 1, tag, stunde, minute, sekunde)
  let schaetzung = gewuenscht
  for (let i = 0; i < 3; i++) {
    const t = berlinTeile(new Date(schaetzung))
    const erhalten = Date.UTC(t.jahr, t.monat - 1, t.tag, t.stunde, t.minute, t.sekunde)
    const abweichung = gewuenscht - erhalten
    if (abweichung === 0) break
    schaetzung += abweichung
  }
  return new Date(schaetzung)
}

/** Mitternacht (Berlin) des Tages, in dem der Zeitpunkt liegt. */
export function tagesanfang(zeitpunkt: Date): Date {
  const t = berlinTeile(zeitpunkt)
  return berlinZuUtc(t.jahr, t.monat, t.tag)
}

/** Die nächste Mitternacht (Berlin) nach dem Zeitpunkt. */
export function naechsterTagesanfang(zeitpunkt: Date): Date {
  const t = berlinTeile(zeitpunkt)
  return berlinZuUtc(t.jahr, t.monat, t.tag + 1)
}

/** Montag 00:00 (Berlin) der Woche, in der der Zeitpunkt liegt. */
export function wochenanfang(zeitpunkt: Date): Date {
  const t = berlinTeile(zeitpunkt)
  const wochentag = new Date(Date.UTC(t.jahr, t.monat - 1, t.tag)).getUTCDay() // 0 = Sonntag
  const zurueck = (wochentag + 6) % 7
  return berlinZuUtc(t.jahr, t.monat, t.tag - zurueck)
}

/** "JJJJ-MM-TT" in Berliner Mitternacht dieses Tages umrechnen. */
export function datumZuTagesanfang(datum: string): Date {
  const [jahr, monat, tag] = datum.split('-').map(Number)
  return berlinZuUtc(jahr, monat, tag)
}

/** "JJJJ-MM-TT" um eine Anzahl Tage verschieben (negativ = zurück). */
export function datumVerschieben(datum: string, tage: number): string {
  const [jahr, monat, tag] = datum.split('-').map(Number)
  return berlinDatum(berlinZuUtc(jahr, monat, tag + tage, 12))
}
