import { wochentag } from './zeit'

/**
 * Die eine Rang-Rechnung, die überall gilt.
 * Rang 1 bis 10: alle 5 produktiven Stunden ein Rang, Rang 10 = 50 Stunden = Wochenziel.
 * Rang 11 bis 15: alle 2 Stunden ein Rang, Rang 15 = 60 Stunden. Höher geht es nicht.
 */
export const STANDARD_GESAMTZIEL = 50
export const STUNDEN_PRO_RANG = 5
export const RANG_ZIEL = 10
export const MAX_RANG = 15
export const STUNDEN_PRO_BONUSRANG = 2

/** Die Namen der Ränge, Index = Rang. Rang 0 heißt noch nichts. */
export const RANG_NAMEN: readonly string[] = [
  'Aufwärmen',
  'Rekrut',
  'Novize',
  'Lehrling',
  'Geselle',
  'Könner',
  'Profi',
  'Veteran',
  'Elite',
  'Meister',
  'Champion',
  'Titan',
  'Legende',
  'Mythos',
  'Ikone',
  'Unsterblich'
]

export type RangStufe = 'keine' | 'bronze' | 'silber' | 'gold' | 'champion' | 'diamant'

export const STUFEN_FARBEN: Record<RangStufe, string> = {
  keine: '#5A5A60',
  bronze: '#C4834B',
  silber: '#C9CDD6',
  gold: '#E8B923',
  champion: '#FE5303',
  diamant: '#7DD3FC'
}

/** Ab wie vielen produktiven Sekunden ein Rang erreicht ist. */
export function rangSchwelle(r: number): number {
  if (r <= RANG_ZIEL) return r * STUNDEN_PRO_RANG * 3600
  return (RANG_ZIEL * STUNDEN_PRO_RANG + (r - RANG_ZIEL) * STUNDEN_PRO_BONUSRANG) * 3600
}

export function rang(produktivSekunden: number): number {
  const stunden = produktivSekunden / 3600
  const zielStunden = RANG_ZIEL * STUNDEN_PRO_RANG
  if (stunden < zielStunden) return Math.floor(stunden / STUNDEN_PRO_RANG)
  return Math.min(MAX_RANG, RANG_ZIEL + Math.floor((stunden - zielStunden) / STUNDEN_PRO_BONUSRANG))
}

export function rangName(r: number): string {
  return RANG_NAMEN[Math.max(0, Math.min(MAX_RANG, r))]
}

/** Sekunden bis zum nächsten Rang, null beim höchsten Rang. */
export function bisNaechsterRang(produktivSekunden: number): number | null {
  const r = rang(produktivSekunden)
  if (r >= MAX_RANG) return null
  return rangSchwelle(r + 1) - produktivSekunden
}

/** Anteil des aktuellen Rangs, der schon voll ist (0 bis 1). */
export function rangFortschritt(produktivSekunden: number): number {
  const r = rang(produktivSekunden)
  if (r >= MAX_RANG) return 1
  const von = rangSchwelle(r)
  const bis = rangSchwelle(r + 1)
  return Math.max(0, Math.min(1, (produktivSekunden - von) / (bis - von)))
}

/** Ab welchem Rang die Woche geschafft ist. Standard 50 h = Rang 10. */
export function zielRang(gesamtzielStunden: number): number {
  return Math.max(1, rang(gesamtzielStunden * 3600))
}

export function rangStufe(r: number): RangStufe {
  if (r <= 0) return 'keine'
  if (r <= 3) return 'bronze'
  if (r <= 6) return 'silber'
  if (r <= 9) return 'gold'
  if (r === RANG_ZIEL) return 'champion'
  return 'diamant'
}

/** Tagesrichtwert: Gesamtziel auf 5 Arbeitstage verteilt. */
export function tagesrichtwert(gesamtzielStunden: number): number {
  return gesamtzielStunden / 5
}

/** Verbleibende Arbeitstage der Woche inklusive heute: Montag 5 … Freitag 1, Wochenende 0. */
export function verbleibendeArbeitstage(zeitpunkt: Date): number {
  const tag = wochentag(zeitpunkt)
  return tag >= 1 && tag <= 5 ? 6 - tag : 0
}
