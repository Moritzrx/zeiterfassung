/**
 * Wochenstatistik und die vier Auszeichnungen. Einmal freigeschaltet, werden
 * sie nie zurückgenommen, auch wenn jemand die Woche später korrigiert.
 */
import { RANG_ZIEL, STANDARD_GESAMTZIEL, rang, zielRang } from './rang'
import { taetigkeitSchluessel } from './regeln'
import type { Auszeichnung, AuszeichnungTyp, Block, Ziel } from './typen'
import { berlinDatum, datumVerschieben, datumZuTagesanfang, wochenanfang } from './zeit'

export const AUSZEICHNUNGEN: Record<AuszeichnungTyp, { titel: string; text: string }> = {
  erste_woche_level10: { titel: 'Erster Champion', text: `Zum ersten Mal Rang ${RANG_ZIEL} in einer Woche erreicht.` },
  drei_wochen_level10: { titel: 'Serie', text: `Drei Wochen in Folge auf Rang ${RANG_ZIEL} oder höher.` },
  alle_lernziele: { titel: 'Alle Lernziele', text: 'Alle Lernziele einer Woche erreicht.' },
  fokus_woche: { titel: 'Fokus-Woche', text: 'Eine Woche mit höchstens 2 Stunden unproduktiver Zeit, ab Rang 5.' }
}

export const AUSZEICHNUNG_REIHENFOLGE: AuszeichnungTyp[] = [
  'erste_woche_level10',
  'drei_wochen_level10',
  'alle_lernziele',
  'fokus_woche'
]

export interface Wochenstatistik {
  /** Montag als "JJJJ-MM-TT" */
  start: string
  produktiv: number
  unproduktiv: number
  ungeklaert: number
  inaktiv: number
  /** produktive Sekunden je Tätigkeitsschlüssel */
  jeTaetigkeit: Map<string, { name: string; sekunden: number }>
  /** true, wenn es gar keine Blöcke gab */
  leer: boolean
  /** true, wenn mindestens ein Block aus den Testdaten stammt */
  testdaten: boolean
}

function anteil(block: Block, von: number, bis: number): number {
  const s = Math.max(Date.parse(block.start), von)
  const e = Math.min(Date.parse(block.ende), bis)
  return e > s ? (e - s) / 1000 : 0
}

/** Summen einer Woche ab dem gegebenen Montag ("JJJJ-MM-TT"). */
export function wochenstatistik(bloecke: Block[], start: string): Wochenstatistik {
  const von = datumZuTagesanfang(start).getTime()
  const bis = datumZuTagesanfang(datumVerschieben(start, 7)).getTime()
  const stat: Wochenstatistik = {
    start,
    produktiv: 0,
    unproduktiv: 0,
    ungeklaert: 0,
    inaktiv: 0,
    jeTaetigkeit: new Map(),
    leer: true,
    testdaten: false
  }
  for (const b of bloecke) {
    if (b.geloeschtAm) continue
    const a = anteil(b, von, bis)
    if (a <= 0) continue
    stat.leer = false
    if (b.testdaten) stat.testdaten = true
    stat[b.bewertung] += a
    if (b.bewertung === 'produktiv' && b.taetigkeit) {
      const s = taetigkeitSchluessel(b.taetigkeit)
      const e = stat.jeTaetigkeit.get(s) ?? { name: b.taetigkeit, sekunden: 0 }
      e.sekunden += a
      stat.jeTaetigkeit.set(s, e)
    }
  }
  return stat
}

/** Welche Lernziele in dieser Woche erreicht sind. */
export function zieleErreicht(stat: Wochenstatistik, ziele: Ziel[]): Array<{ ziel: Ziel; sekunden: number; erreicht: boolean }> {
  return ziele
    .filter((z) => z.taetigkeit)
    .map((z) => {
      const sekunden = stat.jeTaetigkeit.get(taetigkeitSchluessel(z.taetigkeit ?? ''))?.sekunden ?? 0
      return { ziel: z, sekunden, erreicht: sekunden >= z.stundenProWoche * 3600 }
    })
}

export interface NeueAuszeichnung {
  typ: AuszeichnungTyp
  wocheStart: string
  testdaten: boolean
}

/**
 * Prüft, welche Auszeichnungen neu dazukommen. "Erster Champion", "Serie" und
 * "Alle Lernziele" gibt es sofort, sobald erfüllt, auch mitten in der Woche.
 * "Fokus-Woche" erst nach Wochenende, weil bis dahin noch Unproduktives dazukommen kann.
 */
export function auszeichnungenPruefen(
  bloecke: Block[],
  ziele: Ziel[],
  vorhandene: Auszeichnung[],
  jetzt: Date,
  wochenZurueck = 12
): NeueAuszeichnung[] {
  const hat = new Set(vorhandene.map((a) => a.typ))
  const gesamtziel = ziele.find((z) => !z.taetigkeit)?.stundenProWoche ?? STANDARD_GESAMTZIEL
  const ziel = zielRang(gesamtziel)
  const lernziele = ziele.filter((z) => z.taetigkeit)
  const laufende = berlinDatum(wochenanfang(jetzt))

  const wochen: Wochenstatistik[] = []
  for (let k = wochenZurueck; k >= 0; k--) wochen.push(wochenstatistik(bloecke, datumVerschieben(laufende, -7 * k)))
  const aufZiel = (w: Wochenstatistik): boolean => rang(w.produktiv) >= ziel

  const neue: NeueAuszeichnung[] = []
  if (!hat.has('erste_woche_level10')) {
    const w = wochen.find(aufZiel)
    if (w) neue.push({ typ: 'erste_woche_level10', wocheStart: w.start, testdaten: w.testdaten })
  }
  if (!hat.has('drei_wochen_level10')) {
    for (let i = 2; i < wochen.length; i++) {
      if (aufZiel(wochen[i - 2]) && aufZiel(wochen[i - 1]) && aufZiel(wochen[i])) {
        neue.push({
          typ: 'drei_wochen_level10',
          wocheStart: wochen[i].start,
          testdaten: wochen[i].testdaten || wochen[i - 1].testdaten || wochen[i - 2].testdaten
        })
        break
      }
    }
  }
  if (!hat.has('alle_lernziele') && lernziele.length > 0) {
    const w = wochen.find((w) => !w.leer && zieleErreicht(w, lernziele).every((z) => z.erreicht))
    if (w) neue.push({ typ: 'alle_lernziele', wocheStart: w.start, testdaten: w.testdaten })
  }
  if (!hat.has('fokus_woche')) {
    const w = wochen.find((w) => w.start < laufende && !w.leer && w.unproduktiv <= 2 * 3600 && rang(w.produktiv) >= 5)
    if (w) neue.push({ typ: 'fokus_woche', wocheStart: w.start, testdaten: w.testdaten })
  }
  return neue
}
