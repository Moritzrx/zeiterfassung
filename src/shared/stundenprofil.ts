import type { Block } from './typen'
import { berlinDatum, berlinTeile, berlinZuUtc, wochentag } from './zeit'

/**
 * Wann am Tag gearbeitet wird (16. September 2026, Auftraggeber: "nicht nur heute, sondern auch die letzte Woche,
 * die Monate oder das Jahr; wo man am meisten arbeitet, wo am produktivsten, wo eher nichts"): produktive Sekunden
 * je Stunde des Tages (Berliner Zeit) und je Wochentag und Stunde, über alle Tage eines Zeitraums. Blöcke werden an
 * Stundengrenzen geteilt, damit ein Block von 9:40 bis 10:20 zu 20 Minuten auf die 9 und zu 20 Minuten auf die 10 fällt.
 */
export interface Stundenprofil {
  /** 24 Einträge: produktive Sekunden je Stunde des Tages, über den ganzen Zeitraum summiert */
  proStunde: number[]
  /** 7 × 24: Montag = 0 … Sonntag = 6 */
  proWochentagStunde: number[][]
  /** Tage mit produktiver Zeit je Wochentag (Montag = 0) */
  arbeitstageJeWochentag: number[]
  /** Tage mit produktiver Zeit im Zeitraum */
  arbeitstage: number
  /** Kalendertage im Zeitraum */
  tage: number
}

const STUNDE_MS = 3_600_000

/** Wochentag Montag = 0 … Sonntag = 6 aus dem JS-Wochentag (Sonntag = 0). */
function montagNull(jsWochentag: number): number {
  return (jsWochentag + 6) % 7
}

export function stundenprofilBerechnen(bloecke: Block[], vonMs: number, bisMs: number): Stundenprofil {
  const proStunde = new Array<number>(24).fill(0)
  const proWochentagStunde = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  const arbeitstage = new Set<string>()
  for (const b of bloecke) {
    if (b.geloeschtAm || b.bewertung !== 'produktiv') continue
    let t = Math.max(Date.parse(b.start), vonMs)
    const e = Math.min(Date.parse(b.ende), bisMs)
    let schutz = 0
    while (t < e && schutz++ < 200) {
      const teile = berlinTeile(new Date(t))
      const stundenAnfang = berlinZuUtc(teile.jahr, teile.monat, teile.tag, teile.stunde, 0).getTime()
      const naechste = stundenAnfang + STUNDE_MS
      const bis = Math.min(naechste, e)
      const dauer = (bis - t) / 1000
      if (dauer > 0) {
        const wt = montagNull(wochentag(new Date(t)))
        proStunde[teile.stunde] += dauer
        proWochentagStunde[wt][teile.stunde] += dauer
        arbeitstage.add(berlinDatum(new Date(t)))
      }
      t = bis
    }
  }
  const arbeitstageJeWochentag = new Array<number>(7).fill(0)
  for (const datum of arbeitstage) {
    const [jahr, monat, tag] = datum.split('-').map(Number)
    arbeitstageJeWochentag[montagNull(wochentag(berlinZuUtc(jahr, monat, tag, 12)))]++
  }
  return {
    proStunde,
    proWochentagStunde,
    arbeitstageJeWochentag,
    arbeitstage: arbeitstage.size,
    tage: Math.max(1, Math.round((bisMs - vonMs) / 86_400_000))
  }
}

/** Durchschnittliche produktive Minuten je Stunde des Tages an einem Arbeitstag (24 Werte). */
export function minutenJeStunde(p: Stundenprofil): number[] {
  if (p.arbeitstage === 0) return new Array<number>(24).fill(0)
  return p.proStunde.map((s) => s / 60 / p.arbeitstage)
}

/** Durchschnittliche produktive Minuten je Wochentag und Stunde (7 × 24), bezogen auf die Arbeitstage dieses Wochentags. */
export function minutenJeWochentagStunde(p: Stundenprofil): number[][] {
  return p.proWochentagStunde.map((zeile, wt) => {
    const n = p.arbeitstageJeWochentag[wt]
    return zeile.map((s) => (n ? s / 60 / n : 0))
  })
}

export interface Spanne {
  von: number
  bis: number
  minutenJeStunde: number
}

/** Das produktivste Fenster von `laenge` Stunden (im Schnitt je Arbeitstag), null ohne Daten. */
export function besteSpanne(p: Stundenprofil, laenge = 3): Spanne | null {
  const m = minutenJeStunde(p)
  if (m.every((x) => x === 0)) return null
  let beste: Spanne | null = null
  for (let von = 0; von + laenge <= 24; von++) {
    let summe = 0
    for (let h = von; h < von + laenge; h++) summe += m[h]
    if (!beste || summe > beste.minutenJeStunde * laenge) beste = { von, bis: von + laenge, minutenJeStunde: summe / laenge }
  }
  return beste
}

/** Die schwächste Stunde innerhalb des Arbeitstags (Standard 8 bis 18 Uhr), null ohne Daten. */
export function schwaechsteStunde(p: Stundenprofil, von = 8, bis = 18): { stunde: number; minuten: number } | null {
  const m = minutenJeStunde(p)
  if (m.every((x) => x === 0)) return null
  let schwach: { stunde: number; minuten: number } | null = null
  for (let h = von; h < bis; h++) if (!schwach || m[h] < schwach.minuten) schwach = { stunde: h, minuten: m[h] }
  return schwach
}

export const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
export const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

/** Wochentag (Montag = 0) mit den meisten produktiven Stunden je Arbeitstag, null ohne Daten. */
export function staerksterWochentag(p: Stundenprofil): { wochentag: number; stundenJeTag: number } | null {
  let bester: { wochentag: number; stundenJeTag: number } | null = null
  for (let wt = 0; wt < 7; wt++) {
    const n = p.arbeitstageJeWochentag[wt]
    if (!n) continue
    const summe = p.proWochentagStunde[wt].reduce((a, b) => a + b, 0)
    const stunden = summe / 3600 / n
    if (!bester || stunden > bester.stundenJeTag) bester = { wochentag: wt, stundenJeTag: stunden }
  }
  return bester
}
