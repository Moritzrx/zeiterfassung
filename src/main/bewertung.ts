import type { Block, Regel } from '@shared/typen'
import { regelnAnwenden } from '@shared/regeln'
import type { Speicher } from './speicher'

/**
 * Bewertet einen automatischen Block nach den Regeln. Von Hand geprüfte Blöcke
 * werden nie angefasst. Liefert true, wenn sich etwas geändert hat.
 */
export function blockBewerten(block: Block, regeln: Regel[], userId: string): boolean {
  if (block.quelle !== 'auto' || block.manuellGeprueft || block.bewertung === 'inaktiv' || block.geloeschtAm) {
    return false
  }
  const zuordnung = regelnAnwenden(block.programm, block.fenstertitel, regeln, userId)
  const taetigkeit = zuordnung?.taetigkeit ?? null
  const bewertung = zuordnung?.bewertung ?? 'ungeklaert'
  if (block.taetigkeit === taetigkeit && block.bewertung === bewertung) return false
  block.taetigkeit = taetigkeit
  block.bewertung = bewertung
  return true
}

/** Alle eigenen, nicht von Hand geprüften Blöcke neu bewerten. Liefert die Anzahl der Änderungen. */
export function alleNeuBewerten(speicher: Speicher, regeln: Regel[], userId: string): number {
  let geaendert = 0
  for (const block of speicher.alle()) {
    if (blockBewerten(block, regeln, userId)) {
      speicher.aktualisieren(block)
      geaendert++
    }
  }
  return geaendert
}
