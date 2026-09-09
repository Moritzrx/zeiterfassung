import { ZEITZONE, datumZuTagesanfang } from '@shared/zeit'

const UHRZEIT = new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, hour: '2-digit', minute: '2-digit' })
const DATUM = new Intl.DateTimeFormat('de-DE', {
  timeZone: ZEITZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short'
})

/** Fehlertext ohne das technische Vorwort, das Electron bei Fehlern aus dem Hauptprozess voranstellt. */
export function fehlerText(e: unknown): string {
  return e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e)
}

/** Zahl im deutschen Format mit fester Anzahl Nachkommastellen, z. B. "1.702" oder "30,3". */
export function zahlText(wert: number, nachkommastellen = 1): string {
  return wert.toLocaleString('de-DE', {
    minimumFractionDigits: nachkommastellen,
    maximumFractionDigits: nachkommastellen
  })
}

/** Stunden mit einer Nachkommastelle und Komma, z. B. "7,4". */
export function stundenText(sekunden: number): string {
  return (sekunden / 3600).toFixed(1).replace('.', ',')
}

/** Dauer in Minuten und Stunden, z. B. "38 min" oder "1 h 12 min". */
export function dauerText(sekunden: number): string {
  const minuten = Math.round(sekunden / 60)
  if (minuten < 1) return 'unter 1 min'
  if (minuten < 60) return `${minuten} min`
  const stunden = Math.floor(minuten / 60)
  const rest = minuten % 60
  return rest ? `${stunden} h ${rest} min` : `${stunden} h`
}

/** Laufender Zähler, z. B. "04:12" oder "1:04:12". */
export function laufzeitText(sekunden: number): string {
  const s = Math.max(0, Math.floor(sekunden))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sek = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sek).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Uhrzeit in Berlin, z. B. "09:12". */
export function uhrzeit(iso: string): string {
  return UHRZEIT.format(new Date(iso))
}

const KURZ = new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, day: 'numeric', month: 'short' })

/** Kalendertag "JJJJ-MM-TT" als "8. Sept." ohne Wochentag. */
export function kurzDatum(datum: string): string {
  const mittag = new Date(datumZuTagesanfang(datum).getTime() + 12 * 3600_000)
  return KURZ.format(mittag)
}

/** Kalendertag "JJJJ-MM-TT" als "Mo., 8. Sept.". */
export function datumText(datum: string): string {
  const mittag = new Date(datumZuTagesanfang(datum).getTime() + 12 * 3600_000)
  return DATUM.format(mittag)
}
