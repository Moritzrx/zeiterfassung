import type { Block } from './typen'

/*
 * "Nicht am Rechner": ein automatischer Block ohne Programm, der Rechner lief, aber niemand tippte.
 * Entscheidung des Auftraggebers vom 10. September 2026: Diese Zeit zählt als UNPRODUKTIV (rot), nicht mehr
 * als neutrales "inaktiv" (grau), weil die App nur den Rechner sieht und Handy, Sofa oder Termin sonst
 * unsichtbar blieben. Wer unterwegs gearbeitet hat (Kundentermin, Telefonat, Handy), trägt es unter
 * "Eintragen" nach; der Hand-Eintrag ersetzt die rote Zeit. Ältere Blöcke stehen noch als "inaktiv".
 */

export const RUHE_NAME = 'Nicht am Rechner'

/** Block ohne Programm aus der automatischen Erfassung (neu: unproduktiv, alt: inaktiv). */
export function istRuhe(b: Pick<Block, 'quelle' | 'programm'>): boolean {
  return b.quelle === 'auto' && b.programm === null
}

/**
 * Fokus-Quote einer Woche: Anteil der produktiven Zeit an allem, was die App gezählt hat (produktiv,
 * unproduktiv einschließlich "Nicht am Rechner", ungeklärt). Null, wenn nichts gezählt wurde.
 */
export function fokusQuote(stat: { produktiv: number; unproduktiv: number; ungeklaert: number }): number {
  const gesamt = stat.produktiv + stat.unproduktiv + stat.ungeklaert
  return gesamt > 0 ? stat.produktiv / gesamt : 0
}

/** Ab dieser Quote gilt eine Woche als Fokus-Woche (Auszeichnung). */
export const FOKUS_QUOTE_ZIEL = 0.85
