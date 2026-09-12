import { randomUUID } from 'crypto'
import type { Block } from '@shared/typen'
import type { Speicher } from './speicher'

/** Bleibt vor dem Fokus-Beginn weniger als das übrig, bekommt der ganze Block den Fokus statt geteilt zu werden. */
const MINDEST_REST_MS = 60_000

/**
 * Wendet einen rückwirkend gestarteten Fokus auf die schon gespeicherten Blöcke an: automatische
 * Arbeitsblöcke im Zeitraum bekommen die Tätigkeit, werden produktiv und gelten als von Hand geprüft
 * (keine Regel fasst sie danach mehr an). Ein Block, der vor dem Beginn anfängt, wird am Beginn geteilt,
 * der vordere Teil bleibt wie er war. Inaktive Blöcke, Hand-Einträge und der laufende Block (den die
 * Erfassung selbst behandelt) bleiben unberührt. Liefert die Zahl der geänderten Blöcke.
 */
export function fokusRueckwirkend(
  speicher: Speicher,
  taetigkeit: string,
  beginn: Date,
  ende: Date,
  ausser: string | null,
  kunde: string | null = null
): number {
  let n = 0
  const beginnIso = beginn.toISOString()
  const beginnMs = beginn.getTime()
  for (const b of speicher.imZeitraum(beginn, ende)) {
    // Abwesend (blau) und Unproduktives (Zeit ohne Eingabe, von einer Regel als unproduktiv eingestuft) bleiben,
    // wie beim laufenden Fokus: der Fokus schlägt nur Produktives und Ungeklärtes (12. September 2026).
    if (b.id === ausser || b.quelle !== 'auto' || b.bewertung === 'inaktiv' || b.bewertung === 'unproduktiv') continue
    if (Date.parse(b.start) < beginnMs - MINDEST_REST_MS) {
      const hinten: Block = {
        ...b,
        id: randomUUID(),
        start: beginnIso,
        taetigkeit,
        kunde,
        bewertung: 'produktiv',
        manuellGeprueft: true,
        geaendertAm: new Date().toISOString()
      }
      b.ende = beginnIso
      speicher.aktualisieren(b)
      speicher.hinzufuegen(hinten)
    } else {
      b.taetigkeit = taetigkeit
      b.kunde = kunde
      b.bewertung = 'produktiv'
      b.manuellGeprueft = true
      speicher.aktualisieren(b)
    }
    n++
  }
  return n
}
