import { randomUUID } from 'crypto'
import { hostname } from 'os'
import type { Block, BlockAenderung, NeuerEintrag } from '@shared/typen'
import type { Speicher } from './speicher'
import type { Taetigkeiten } from './taetigkeiten'

const MAX_EINTRAG_MS = 24 * 3600_000

/**
 * Legt einen Block von Hand an. Er gilt als produktiv und als von Hand geprüft,
 * bleibt aber wie jeder Block änderbar.
 */
export function eintragAnlegen(
  speicher: Speicher,
  taetigkeiten: Taetigkeiten,
  userId: string,
  eintrag: NeuerEintrag
): Block {
  const start = new Date(eintrag.start)
  const ende = new Date(eintrag.ende)
  if (Number.isNaN(start.getTime()) || Number.isNaN(ende.getTime())) {
    throw new Error('Bitte Datum und Uhrzeiten angeben.')
  }
  if (ende <= start) throw new Error('Das Ende muss nach dem Anfang liegen.')
  if (ende.getTime() - start.getTime() > MAX_EINTRAG_MS) throw new Error('Ein Eintrag darf nicht länger als einen Tag sein.')
  const taetigkeit = taetigkeiten.merken(eintrag.taetigkeit)
  if (!taetigkeit) throw new Error('Bitte eine Tätigkeit angeben.')

  const jetzt = new Date().toISOString()
  const block: Block = {
    id: randomUUID(),
    userId,
    start: start.toISOString(),
    ende: ende.toISOString(),
    quelle: 'manuell',
    programm: null,
    programmRoh: null,
    fenstertitel: null,
    taetigkeit,
    bewertung: 'produktiv',
    notiz: eintrag.notiz?.trim() || null,
    manuellGeprueft: true,
    geraet: hostname(),
    geaendertAm: jetzt,
    geloeschtAm: null
  }
  speicher.hinzufuegen(block)
  return block
}

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
