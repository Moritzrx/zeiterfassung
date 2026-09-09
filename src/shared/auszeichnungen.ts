/**
 * Wochenstatistik und die Auszeichnungen. Einmal freigeschaltet, werden
 * sie nie zurückgenommen, auch wenn jemand die Woche später korrigiert.
 */
import { MAX_RANG, RANG_ZIEL, STANDARD_GESAMTZIEL, rang, zielRang } from './rang'
import { taetigkeitSchluessel } from './regeln'
import type { Auszeichnung, AuszeichnungTyp, Block, Ziel } from './typen'
import { berlinDatum, datumVerschieben, datumZuTagesanfang, wochenanfang } from './zeit'

export const AUSZEICHNUNGEN: Record<AuszeichnungTyp, { titel: string; text: string; farbe: string }> = {
  erste_woche_level10: { titel: 'Erster Champion', text: `Zum ersten Mal Rang ${RANG_ZIEL} in einer Woche erreicht.`, farbe: '#FE5303' },
  drei_wochen_level10: { titel: 'Serie', text: `Drei Wochen in Folge auf Rang ${RANG_ZIEL} oder höher.`, farbe: '#E8B923' },
  dauerbrenner: { titel: 'Dauerbrenner', text: 'Vier Wochen in Folge mindestens Rang 5.', farbe: '#FF8A3D' },
  comeback: { titel: 'Comeback', text: `Direkt nach einer Woche unter Rang 5 eine Woche auf Rang ${RANG_ZIEL} oder höher.`, farbe: '#FB7185' },
  eternal: { titel: 'Eternal', text: `Rang ${MAX_RANG} in einer Woche erreicht, höher geht es nicht.`, farbe: '#7DD3FC' },
  perfekte_woche: { titel: 'Perfekte Woche', text: 'Montag bis Freitag jeden Tag mindestens 8 produktive Stunden.', farbe: '#FFD166' },
  alle_lernziele: { titel: 'Alle Lernziele', text: 'Alle Lernziele einer Woche erreicht.', farbe: '#00C076' },
  fokus_woche: { titel: 'Fokus-Woche', text: 'Eine Woche mit höchstens 2 Stunden unproduktiver Zeit, ab Rang 5.', farbe: '#FF4D4D' },
  marathon: { titel: 'Marathon', text: '10 produktive Stunden an einem einzigen Tag.', farbe: '#38BDF8' },
  sprint: { titel: 'Sprint', text: '3 Stunden am Stück produktiv, ohne Unterbrechung über 5 Minuten.', farbe: '#34D399' },
  fruehaufsteher: { titel: 'Frühaufsteher', text: 'In einer Woche mindestens 2 produktive Stunden vor 8 Uhr.', farbe: '#FDBA74' },
  nachteule: { titel: 'Nachteule', text: 'In einer Woche mindestens 2 produktive Stunden nach 22 Uhr.', farbe: '#A78BFA' },
  wochenend_krieger: { titel: 'Wochenend-Krieger', text: '5 produktive Stunden an einem Wochenende.', farbe: '#F472B6' },
  aufgeraeumt: { titel: 'Aufgeräumt', text: 'Eine abgeschlossene Woche mit mindestens 20 produktiven Stunden und keinem ungeklärten Block.', farbe: '#C9CDD6' }
}

export const AUSZEICHNUNG_REIHENFOLGE: AuszeichnungTyp[] = [
  'erste_woche_level10',
  'drei_wochen_level10',
  'dauerbrenner',
  'comeback',
  'eternal',
  'perfekte_woche',
  'alle_lernziele',
  'fokus_woche',
  'marathon',
  'sprint',
  'fruehaufsteher',
  'nachteule',
  'wochenend_krieger',
  'aufgeraeumt'
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
  /** produktive Sekunden je Wochentag, Index 0 = Montag */
  tage: number[]
  /** produktive Sekunden vor 8 Uhr */
  frueh: number
  /** produktive Sekunden nach 22 Uhr */
  spaet: number
  /** längste produktive Strecke am Stück (Lücken bis 5 Minuten erlaubt) */
  laengsteStrecke: number
  /** true, wenn es gar keine Blöcke gab */
  leer: boolean
  /** true, wenn mindestens ein Block aus den Testdaten stammt */
  testdaten: boolean
}

const STUNDE = 3600
const STRECKE_LUECKE = 5 * 60

function ueberlappung(block: Block, von: number, bis: number): number {
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
    tage: [0, 0, 0, 0, 0, 0, 0],
    frueh: 0,
    spaet: 0,
    laengsteStrecke: 0,
    leer: true,
    testdaten: false
  }
  const tagesgrenzen = Array.from({ length: 7 }, (_, i) => datumZuTagesanfang(datumVerschieben(start, i)).getTime())
  const produktive: Array<[number, number]> = []
  for (const b of bloecke) {
    if (b.geloeschtAm) continue
    const a = ueberlappung(b, von, bis)
    if (a <= 0) continue
    stat.leer = false
    if (b.testdaten) stat.testdaten = true
    stat[b.bewertung] += a
    if (b.bewertung !== 'produktiv') continue
    if (b.taetigkeit) {
      const s = taetigkeitSchluessel(b.taetigkeit)
      const e = stat.jeTaetigkeit.get(s) ?? { name: b.taetigkeit, sekunden: 0 }
      e.sekunden += a
      stat.jeTaetigkeit.set(s, e)
    }
    for (let i = 0; i < 7; i++) {
      const tagVon = tagesgrenzen[i]
      const tagBis = i < 6 ? tagesgrenzen[i + 1] : bis
      const amTag = ueberlappung(b, tagVon, tagBis)
      if (amTag <= 0) continue
      stat.tage[i] += amTag
      stat.frueh += ueberlappung(b, tagVon, tagVon + 8 * STUNDE * 1000)
      stat.spaet += ueberlappung(b, tagVon + 22 * STUNDE * 1000, tagBis)
    }
    produktive.push([Math.max(Date.parse(b.start), von), Math.min(Date.parse(b.ende), bis)])
  }
  // Längste Strecke: produktive Blöcke nach Start sortiert, Lücken bis 5 Minuten überbrücken
  produktive.sort((x, y) => x[0] - y[0])
  let streckeStart = 0
  let streckeEnde = 0
  for (const [s, e] of produktive) {
    if (streckeEnde && s - streckeEnde <= STRECKE_LUECKE * 1000) {
      streckeEnde = Math.max(streckeEnde, e)
    } else {
      streckeStart = s
      streckeEnde = e
    }
    stat.laengsteStrecke = Math.max(stat.laengsteStrecke, (streckeEnde - streckeStart) / 1000)
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
 * Prüft, welche Auszeichnungen neu dazukommen. Die meisten gibt es sofort, sobald
 * erfüllt, auch mitten in der Woche. "Fokus-Woche" und "Aufgeräumt" erst nach dem
 * Wochenende, weil bis dahin noch Unproduktives oder Ungeklärtes dazukommen kann.
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
  const r = (w: Wochenstatistik): number => rang(w.produktiv)
  const aufZiel = (w: Wochenstatistik): boolean => r(w) >= ziel

  const neue: NeueAuszeichnung[] = []
  const melden = (typ: AuszeichnungTyp, w: Wochenstatistik | undefined, testdaten = w?.testdaten ?? false): void => {
    if (w && !hat.has(typ)) neue.push({ typ, wocheStart: w.start, testdaten })
  }
  /** Erste Woche, die eine Bedingung erfüllt */
  const erste = (bedingung: (w: Wochenstatistik, i: number) => boolean): Wochenstatistik | undefined => wochen.find((w, i) => bedingung(w, i))
  /** Erste Woche, ab der n Wochen in Folge eine Bedingung erfüllen; liefert die letzte Woche der Folge */
  const folge = (n: number, bedingung: (w: Wochenstatistik) => boolean): Wochenstatistik | undefined => {
    for (let i = n - 1; i < wochen.length; i++) {
      if (wochen.slice(i - n + 1, i + 1).every(bedingung)) return wochen[i]
    }
    return undefined
  }

  melden('erste_woche_level10', erste(aufZiel))
  const serie = folge(3, aufZiel)
  if (serie) {
    const i = wochen.indexOf(serie)
    melden('drei_wochen_level10', serie, wochen.slice(i - 2, i + 1).some((w) => w.testdaten))
  }
  const brenner = folge(4, (w) => r(w) >= 5)
  if (brenner) {
    const i = wochen.indexOf(brenner)
    melden('dauerbrenner', brenner, wochen.slice(i - 3, i + 1).some((w) => w.testdaten))
  }
  melden('comeback', erste((w, i) => i > 0 && !wochen[i - 1].leer && r(wochen[i - 1]) < 5 && aufZiel(w)))
  melden('eternal', erste((w) => r(w) >= MAX_RANG))
  melden('perfekte_woche', erste((w) => w.tage.slice(0, 5).every((t) => t >= 8 * STUNDE)))
  if (lernziele.length > 0) {
    melden('alle_lernziele', erste((w) => !w.leer && zieleErreicht(w, lernziele).every((z) => z.erreicht)))
  }
  melden('fokus_woche', erste((w) => w.start < laufende && !w.leer && w.unproduktiv <= 2 * STUNDE && r(w) >= 5))
  melden('marathon', erste((w) => w.tage.some((t) => t >= 10 * STUNDE)))
  melden('sprint', erste((w) => w.laengsteStrecke >= 3 * STUNDE))
  melden('fruehaufsteher', erste((w) => w.frueh >= 2 * STUNDE))
  melden('nachteule', erste((w) => w.spaet >= 2 * STUNDE))
  melden('wochenend_krieger', erste((w) => w.tage[5] + w.tage[6] >= 5 * STUNDE))
  melden('aufgeraeumt', erste((w) => w.start < laufende && !w.leer && w.produktiv >= 20 * STUNDE && w.ungeklaert === 0))
  return neue
}
