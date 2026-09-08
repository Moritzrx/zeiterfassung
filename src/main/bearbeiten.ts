import type { Block, BlockAenderung } from '@shared/typen'
import type { Speicher } from './speicher'
import type { Taetigkeiten } from './taetigkeiten'

/**
 * Ändert einen Block von Hand. Danach gilt er als "von Hand geprüft" und wird
 * von keiner Regel mehr angefasst. Löschen blendet nur aus und leert sofort
 * Fenstertitel und Notiz.
 */
export function blockAendern(
  speicher: Speicher,
  taetigkeiten: Taetigkeiten,
  id: string,
  aenderung: BlockAenderung
): Block | null {
  const block = speicher.get(id)
  if (!block || block.geloeschtAm) return null

  if (aenderung.loeschen) {
    block.geloeschtAm = new Date().toISOString()
    block.fenstertitel = null
    block.notiz = null
    block.manuellGeprueft = true
    speicher.aktualisieren(block)
    return block
  }

  if (aenderung.start !== undefined) block.start = new Date(aenderung.start).toISOString()
  if (aenderung.ende !== undefined) block.ende = new Date(aenderung.ende).toISOString()
  if (Date.parse(block.ende) <= Date.parse(block.start)) {
    throw new Error('Das Ende muss nach dem Anfang liegen.')
  }
  if (Date.parse(block.ende) - Date.parse(block.start) > 24 * 3600_000) {
    throw new Error('Ein Block darf nicht länger als einen Tag sein.')
  }
  if (aenderung.taetigkeit !== undefined) {
    block.taetigkeit = aenderung.taetigkeit ? taetigkeiten.merken(aenderung.taetigkeit) || null : null
  }
  if (aenderung.bewertung !== undefined) block.bewertung = aenderung.bewertung
  if (aenderung.notiz !== undefined) block.notiz = aenderung.notiz?.trim() || null
  block.manuellGeprueft = true
  speicher.aktualisieren(block)
  return block
}
