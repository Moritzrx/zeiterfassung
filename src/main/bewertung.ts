import type { Block, Regel } from '@shared/typen'
import { regelnAnwenden, taetigkeitSchluessel } from '@shared/regeln'
import type { Speicher } from './speicher'

/**
 * Kurze Wechsel in ein anderes Programm (bis zu dieser Dauer), die ungeklärt bleiben und
 * zwischen zwei Blöcken derselben Tätigkeit liegen, erben diese Tätigkeit. So landet nicht
 * jeder Blick in Teams, Asana oder den Kalender im Postfach.
 */
export const KURZWECHSEL_SEKUNDEN = 5 * 60
/** Höchstens so viel Lücke zu den Nachbarn, damit die Blöcke als zusammenhängend gelten. */
const LUECKE_SEKUNDEN = 120

/**
 * Bewertet einen automatischen Block nach den Regeln. Von Hand geprüfte Blöcke
 * werden nie angefasst. Liefert true, wenn sich etwas geändert hat.
 */
export function blockBewerten(block: Block, regeln: Regel[], userId: string): boolean {
  if (!frei(block)) return false
  const zuordnung = regelnAnwenden(block.programm, block.fenstertitel, regeln, userId)
  const taetigkeit = zuordnung?.taetigkeit ?? null
  const bewertung = zuordnung?.bewertung ?? 'ungeklaert'
  if (block.taetigkeit === taetigkeit && block.bewertung === bewertung) return false
  block.taetigkeit = taetigkeit
  block.bewertung = bewertung
  return true
}

/** Darf von Regeln und Kurzwechsel-Übernahme verändert werden. */
function frei(b: Block): boolean {
  // Blöcke ohne Programm ("Nicht am Rechner", alt "inaktiv") bleiben, wie sie sind: keine Regel greift dort.
  return b.quelle === 'auto' && !b.manuellGeprueft && b.bewertung !== 'inaktiv' && b.programm !== null && !b.geloeschtAm
}

function sekunden(b: Block): number {
  return (Date.parse(b.ende) - Date.parse(b.start)) / 1000
}

function luecke(ende: string, start: string): number {
  return (Date.parse(start) - Date.parse(ende)) / 1000
}

interface Zielwert {
  taetigkeit: string | null
  bewertung: Block['bewertung']
}

/**
 * Alle eigenen, nicht von Hand geprüften Blöcke neu bewerten: erst nach den Regeln,
 * dann erben kurze ungeklärte Wechsel die Tätigkeit ihrer gleichen Nachbarn.
 * Liefert die Anzahl der Änderungen.
 */
export function alleNeuBewerten(speicher: Speicher, regeln: Regel[], userId: string): number {
  const alle = speicher
    .alle()
    .filter((b) => !b.geloeschtAm)
    .sort((a, b) => a.start.localeCompare(b.start))

  // 1. Zielwerte nach den Regeln (feste Blöcke behalten ihren Stand)
  const ziel = new Map<string, Zielwert>()
  for (const b of alle) {
    if (frei(b)) {
      const z = regelnAnwenden(b.programm, b.fenstertitel, regeln, userId)
      ziel.set(b.id, { taetigkeit: z?.taetigkeit ?? null, bewertung: z?.bewertung ?? 'ungeklaert' })
    } else {
      ziel.set(b.id, { taetigkeit: b.taetigkeit, bewertung: b.bewertung })
    }
  }

  // 2. Kurzwechsel übernehmen; zwei Durchläufe, damit auch zwei kurze Blöcke hintereinander erben
  for (let runde = 0; runde < 2; runde++) {
    for (let i = 1; i < alle.length - 1; i++) {
      const b = alle[i]
      const z = ziel.get(b.id)
      if (!z || !frei(b) || z.bewertung !== 'ungeklaert' || sekunden(b) > KURZWECHSEL_SEKUNDEN) continue
      const p = alle[i - 1]
      const n = alle[i + 1]
      if (luecke(p.ende, b.start) > LUECKE_SEKUNDEN || luecke(b.ende, n.start) > LUECKE_SEKUNDEN) continue
      const zp = ziel.get(p.id)
      const zn = ziel.get(n.id)
      if (!zp || !zn || zp.bewertung !== zn.bewertung) continue
      if (zp.bewertung !== 'produktiv' && zp.bewertung !== 'unproduktiv') continue
      if (taetigkeitSchluessel(zp.taetigkeit ?? '') !== taetigkeitSchluessel(zn.taetigkeit ?? '')) continue
      ziel.set(b.id, { taetigkeit: zp.taetigkeit, bewertung: zp.bewertung })
    }
  }

  // 3. Nur wirklich Geändertes schreiben
  let geaendert = 0
  for (const b of alle) {
    if (!frei(b)) continue
    const z = ziel.get(b.id)
    if (!z || (b.taetigkeit === z.taetigkeit && b.bewertung === z.bewertung)) continue
    b.taetigkeit = z.taetigkeit
    b.bewertung = z.bewertung
    speicher.aktualisieren(b)
    geaendert++
  }
  return geaendert
}
