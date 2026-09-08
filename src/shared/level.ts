import { wochentag } from './zeit'

/** Die eine Rechnung, die überall gilt: 5 produktive Stunden in der Woche sind ein Level. */
export const STUNDEN_PRO_LEVEL = 5
export const SEKUNDEN_PRO_LEVEL = STUNDEN_PRO_LEVEL * 3600
export const STANDARD_GESAMTZIEL = 50

export function level(produktivSekunden: number): number {
  return Math.floor(produktivSekunden / SEKUNDEN_PRO_LEVEL)
}

/** Sekunden, die im aktuellen Level bis zum nächsten fehlen. */
export function bisNaechstesLevel(produktivSekunden: number): number {
  return SEKUNDEN_PRO_LEVEL - (produktivSekunden % SEKUNDEN_PRO_LEVEL)
}

/** Anteil des aktuellen Levels, der schon voll ist (0 bis 1). */
export function levelFortschritt(produktivSekunden: number): number {
  return (produktivSekunden % SEKUNDEN_PRO_LEVEL) / SEKUNDEN_PRO_LEVEL
}

/** Ab welchem Level die Woche geschafft ist: Gesamtziel geteilt durch 5, aufgerundet. Standard 50 h = Level 10. */
export function zielLevel(gesamtzielStunden: number): number {
  return Math.max(1, Math.ceil(gesamtzielStunden / STUNDEN_PRO_LEVEL))
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
