import type { Block } from './typen'

/*
 * "Nicht am Rechner": ein automatischer Block ohne Programm, der Rechner lief, aber niemand tippte.
 * Entscheidung des Auftraggebers vom 10. September 2026: Diese Zeit zählt als UNPRODUKTIV (rot), nicht mehr
 * als neutrales "inaktiv" (grau), weil die App nur den Rechner sieht und Handy, Sofa oder Termin sonst
 * unsichtbar blieben. Wer unterwegs gearbeitet hat (Kundentermin, Telefonat, Handy), trägt es unter
 * "Eintragen" nach; der Hand-Eintrag ersetzt die rote Zeit. Ältere Blöcke stehen noch als "inaktiv".
 */

export const RUHE_NAME = 'Nicht am Rechner'
/** Bewertung "inaktiv" heißt in der Oberfläche "Abwesend" (blau): länger als 90 Minuten weg, zählt nicht. */
export const ABWESEND_NAME = 'Abwesend'
/**
 * Seit 15. September 2026 ("Unproduktiv brauchen wir nicht"): Zeit ohne Eingabe im Fokus wird als neutrale
 * "Pause" (Bewertung inaktiv, zählt nicht) gespeichert, nicht mehr rot. Kurze Stücke heißen "Pause", ab
 * 90 Minuten "Abwesend". Rot gibt es nur noch durch Regeln oder von Hand.
 */
export const PAUSE_NAME = 'Pause'
export const ABWESEND_GRENZE_MS = 90 * 60_000

/** Block ohne Programm aus der automatischen Erfassung (neu: unproduktiv, alt: inaktiv). */
export function istRuhe(b: Pick<Block, 'quelle' | 'programm'>): boolean {
  return b.quelle === 'auto' && b.programm === null
}

/** Anzeigename eines Blocks ohne Programm: "Pause", "Abwesend" oder "Nicht am Rechner" (rot, alte Daten). */
export function ruheName(b: Pick<Block, 'bewertung' | 'start' | 'ende'>): string {
  if (b.bewertung !== 'inaktiv') return RUHE_NAME
  return Date.parse(b.ende) - Date.parse(b.start) < ABWESEND_GRENZE_MS ? PAUSE_NAME : ABWESEND_NAME
}

/** Kurze Pause im Fokus (Zeit ohne Eingabe unter 90 Minuten, neutral gespeichert). */
export function istPause(b: Pick<Block, 'quelle' | 'programm' | 'bewertung' | 'start' | 'ende'>): boolean {
  return istRuhe(b) && b.bewertung === 'inaktiv' && Date.parse(b.ende) - Date.parse(b.start) < ABWESEND_GRENZE_MS
}

/**
 * Fokus-Quote einer Woche: Anteil der produktiven Zeit an allem, was die App gezählt hat (produktiv,
 * unproduktiv einschließlich "Nicht am Rechner", ungeklärt). Null, wenn nichts gezählt wurde.
 */
export function fokusQuote(stat: { produktiv: number; unproduktiv: number; ungeklaert: number }): number {
  const gesamt = stat.produktiv + stat.unproduktiv + stat.ungeklaert
  return gesamt > 0 ? stat.produktiv / gesamt : 0
}

/** Ab dieser Quote gilt eine Woche als Fokus-Woche (Auszeichnung); 80 % seit 10. September 2026 ("muss realistisch sein"). */
export const FOKUS_QUOTE_ZIEL = 0.8
