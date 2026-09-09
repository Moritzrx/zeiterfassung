/**
 * Wochenstatistik und die Auszeichnungen. Einmal freigeschaltet, werden
 * sie nie zurückgenommen, auch wenn jemand die Woche später korrigiert.
 * Sie gelten für immer, deshalb gibt es viele davon, in Gruppen von leicht bis sehr lang.
 */
import { LIGEN, type LigaStufe } from './liga'
import { MAX_RANG, RANG_ZIEL, STANDARD_GESAMTZIEL, rang, zielRang } from './rang'
import { taetigkeitSchluessel } from './regeln'
import type { Auszeichnung, AuszeichnungTyp, Block, TeamWoche, Ziel } from './typen'
import { berlinDatum, datumVerschieben, datumZuTagesanfang, wochenanfang } from './zeit'

export type AuszeichnungGruppe = 'besondere' | 'serien' | 'stunden' | 'liga' | 'tage' | 'team' | 'lernen' | 'uhrzeit'

export const AUSZEICHNUNG_GRUPPEN: Array<{ id: AuszeichnungGruppe; titel: string; hinweis: string }> = [
  { id: 'besondere', titel: 'Besondere', hinweis: 'Die großen Momente.' },
  { id: 'serien', titel: 'Serien', hinweis: 'Woche für Woche dranbleiben.' },
  { id: 'stunden', titel: 'Stunden-Meilensteine', hinweis: 'Produktive Stunden seit dem Start, für immer gezählt.' },
  { id: 'liga', titel: 'Liga', hinweis: 'Zum ersten Mal in einer Liga angekommen.' },
  { id: 'tage', titel: 'Tage', hinweis: 'Einzelne starke Tage und volle Wochen.' },
  { id: 'team', titel: 'Team', hinweis: 'Gegen und mit den anderen beiden.' },
  { id: 'lernen', titel: 'Lernen und Disziplin', hinweis: 'Lernziele, Fokus und Ordnung.' },
  { id: 'uhrzeit', titel: 'Uhrzeit', hinweis: 'Wann gearbeitet wird.' }
]

export const AUSZEICHNUNGEN: Record<AuszeichnungTyp, { titel: string; text: string; farbe: string; gruppe: AuszeichnungGruppe }> = {
  erste_woche_level10: { titel: 'Erster Champion', text: `Zum ersten Mal Rang ${RANG_ZIEL} in einer Woche erreicht.`, farbe: '#FE5303', gruppe: 'besondere' },
  comeback: { titel: 'Comeback', text: `Direkt nach einer Woche unter Rang 5 eine Woche auf Rang ${RANG_ZIEL} oder höher.`, farbe: '#FB7185', gruppe: 'besondere' },
  eternal: { titel: 'Eternal', text: `Rang ${MAX_RANG} in einer Woche erreicht, höher geht es nicht.`, farbe: '#7DD3FC', gruppe: 'besondere' },

  drei_wochen_level10: { titel: 'Serie', text: `Drei Wochen in Folge auf Rang ${RANG_ZIEL} oder höher.`, farbe: '#E8B923', gruppe: 'serien' },
  serie_6: { titel: 'Lange Serie', text: `Sechs Wochen in Folge auf Rang ${RANG_ZIEL} oder höher.`, farbe: '#C9CDD6', gruppe: 'serien' },
  serie_12: { titel: 'Eiserne Serie', text: `Zwölf Wochen in Folge auf Rang ${RANG_ZIEL} oder höher.`, farbe: '#FF4D4D', gruppe: 'serien' },
  dauerbrenner: { titel: 'Dauerbrenner', text: 'Vier Wochen in Folge mindestens 55 produktive Stunden, also deutlich über dem Ziel.', farbe: '#FF8A3D', gruppe: 'serien' },

  stunden_100: { titel: '100 Stunden', text: '100 produktive Stunden seit dem Start.', farbe: '#C4834B', gruppe: 'stunden' },
  stunden_500: { titel: '500 Stunden', text: '500 produktive Stunden seit dem Start.', farbe: '#C9CDD6', gruppe: 'stunden' },
  stunden_1000: { titel: '1.000 Stunden', text: '1.000 produktive Stunden seit dem Start.', farbe: '#E8B923', gruppe: 'stunden' },
  stunden_2500: { titel: '2.500 Stunden', text: '2.500 produktive Stunden seit dem Start.', farbe: '#7DD3FC', gruppe: 'stunden' },
  stunden_5000: { titel: '5.000 Stunden', text: '5.000 produktive Stunden seit dem Start. Bei 50 Stunden die Woche sind das zwei Jahre.', farbe: '#C084FC', gruppe: 'stunden' },

  liga_bronze: { titel: 'Bronze-Liga', text: 'Zum ersten Mal die Bronze-Liga erreicht (400 Trophäen).', farbe: '#C4834B', gruppe: 'liga' },
  liga_silber: { titel: 'Silber-Liga', text: 'Zum ersten Mal die Silber-Liga erreicht (800 Trophäen).', farbe: '#C9CDD6', gruppe: 'liga' },
  liga_gold: { titel: 'Gold-Liga', text: 'Zum ersten Mal die Gold-Liga erreicht (1.400 Trophäen).', farbe: '#E8B923', gruppe: 'liga' },
  liga_kristall: { titel: 'Kristall-Liga', text: 'Zum ersten Mal die Kristall-Liga erreicht (2.000 Trophäen).', farbe: '#7DD3FC', gruppe: 'liga' },
  liga_meister: { titel: 'Meister-Liga', text: 'Zum ersten Mal die Meister-Liga erreicht (2.600 Trophäen).', farbe: '#A78BFA', gruppe: 'liga' },
  liga_champion: { titel: 'Champion-Liga', text: 'Zum ersten Mal die Champion-Liga erreicht (3.200 Trophäen).', farbe: '#FE5303', gruppe: 'liga' },
  liga_titan: { titel: 'Titan-Liga', text: 'Zum ersten Mal die Titan-Liga erreicht (4.100 Trophäen).', farbe: '#F1F5F9', gruppe: 'liga' },
  liga_legende: { titel: 'Legenden-Liga', text: 'Die Legenden-Liga erreicht (5.000 Trophäen). Weiter geht es nicht.', farbe: '#FFD166', gruppe: 'liga' },

  perfekte_woche: { titel: 'Perfekte Woche', text: 'An allen sieben Tagen einer Woche mindestens 5 produktive Stunden.', farbe: '#FFD166', gruppe: 'tage' },
  durchlaeufer: { titel: 'Durchläufer', text: 'Sieben Tage in Folge jeweils mindestens 4 produktive Stunden, auch über den Wochenwechsel.', farbe: '#2DD4BF', gruppe: 'tage' },
  marathon: { titel: 'Marathon', text: '10 produktive Stunden an einem einzigen Tag.', farbe: '#38BDF8', gruppe: 'tage' },
  ultra: { titel: 'Ultra', text: '12 produktive Stunden an einem einzigen Tag.', farbe: '#60A5FA', gruppe: 'tage' },
  sprint: { titel: 'Sprint', text: '3 Stunden am Stück produktiv, ohne Unterbrechung über 5 Minuten.', farbe: '#34D399', gruppe: 'tage' },

  wochensieger: { titel: 'Wochensieger', text: 'In einer abgeschlossenen Woche die meisten produktiven Stunden im Team.', farbe: '#FFD166', gruppe: 'team' },
  dauersieger: { titel: 'Dauersieger', text: 'Drei Wochen in Folge Wochensieger.', farbe: '#FB7185', gruppe: 'team' },
  team_woche: { titel: 'Team-Woche', text: 'Alle drei erreichen in derselben Woche ihr Wochenziel.', farbe: '#00C076', gruppe: 'team' },

  alle_lernziele: { titel: 'Alle Lernziele', text: 'Alle Lernziele einer Woche erreicht.', farbe: '#00C076', gruppe: 'lernen' },
  lernmeister: { titel: 'Lernmeister', text: 'Vier Wochen in Folge alle Lernziele erreicht.', farbe: '#34D399', gruppe: 'lernen' },
  fokus_woche: { titel: 'Fokus-Woche', text: `Eine abgeschlossene Woche auf Rang ${RANG_ZIEL} oder höher mit höchstens 2 Stunden unproduktiver Zeit.`, farbe: '#FF4D4D', gruppe: 'lernen' },
  aufgeraeumt: { titel: 'Aufgeräumt', text: 'Eine abgeschlossene Woche mit mindestens 40 produktiven Stunden und keinem ungeklärten Block.', farbe: '#C9CDD6', gruppe: 'lernen' },
  blitzsauber: { titel: 'Blitzsauber', text: 'Vier abgeschlossene Wochen in Folge mit mindestens 40 produktiven Stunden und nichts Ungeklärtem.', farbe: '#E2E8F0', gruppe: 'lernen' },

  fruehaufsteher: { titel: 'Frühaufsteher', text: 'In einer Woche mindestens 2 produktive Stunden vor 8 Uhr.', farbe: '#FDBA74', gruppe: 'uhrzeit' },
  nachteule: { titel: 'Nachteule', text: 'In einer Woche mindestens 2 produktive Stunden nach 22 Uhr.', farbe: '#A78BFA', gruppe: 'uhrzeit' },
  wochenend_krieger: { titel: 'Wochenend-Krieger', text: '15 produktive Stunden an einem Wochenende.', farbe: '#F472B6', gruppe: 'uhrzeit' }
}

/** Alle Typen in Anzeige-Reihenfolge (nach Gruppen). */
export const AUSZEICHNUNG_REIHENFOLGE: AuszeichnungTyp[] = AUSZEICHNUNG_GRUPPEN.flatMap((g) =>
  (Object.keys(AUSZEICHNUNGEN) as AuszeichnungTyp[]).filter((t) => AUSZEICHNUNGEN[t].gruppe === g.id)
)

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
 * Was die Prüfung über die eigenen Blöcke hinaus braucht (kommt aus der Datenbank).
 * Unbekannte Werte (null, leere Listen) lassen die betroffenen Auszeichnungen einfach aus.
 */
export interface AuszeichnungsKontext {
  /** produktive Sekunden seit dem Start, über alle Zeit */
  gesamtProduktiv: number | null
  /** aktueller Trophäenstand der Liga */
  trophaeen: number | null
  /** produktive Sekunden je Person und Woche (team_wochen) für die letzten Wochen */
  teamWochen: TeamWoche[]
  /** Wochenziele aller Personen, für die Team-Woche */
  teamZiele: Ziel[]
  eigeneUserId: string | null
}

export const LEERER_KONTEXT: AuszeichnungsKontext = { gesamtProduktiv: null, trophaeen: null, teamWochen: [], teamZiele: [], eigeneUserId: null }

const STUNDEN_MEILENSTEINE: Array<[AuszeichnungTyp, number]> = [
  ['stunden_100', 100],
  ['stunden_500', 500],
  ['stunden_1000', 1000],
  ['stunden_2500', 2500],
  ['stunden_5000', 5000]
]

const LIGA_MEILENSTEINE: Array<[AuszeichnungTyp, LigaStufe]> = [
  ['liga_bronze', 'bronze'],
  ['liga_silber', 'silber'],
  ['liga_gold', 'gold'],
  ['liga_kristall', 'kristall'],
  ['liga_meister', 'meister'],
  ['liga_champion', 'champion'],
  ['liga_titan', 'titan'],
  ['liga_legende', 'legende']
]

/**
 * Prüft, welche Auszeichnungen neu dazukommen. Die meisten gibt es sofort, sobald
 * erfüllt, auch mitten in der Woche. Alles, was "abgeschlossene Woche" sagt (Fokus-Woche,
 * Aufgeräumt, Blitzsauber, die Team-Auszeichnungen), erst nach dem Wochenende, weil bis
 * dahin noch etwas dazukommen kann. Stunden- und Liga-Meilensteine kommen aus dem Kontext.
 */
export function auszeichnungenPruefen(
  bloecke: Block[],
  ziele: Ziel[],
  vorhandene: Auszeichnung[],
  jetzt: Date,
  kontext: AuszeichnungsKontext = LEERER_KONTEXT,
  wochenZurueck = 12
): NeueAuszeichnung[] {
  const hat = new Set(vorhandene.map((a) => a.typ))
  const gesamtziel = ziele.find((z) => !z.taetigkeit)?.stundenProWoche ?? STANDARD_GESAMTZIEL
  const ziel = zielRang(gesamtziel)
  const lernziele = ziele.filter((z) => z.taetigkeit)
  const laufende = berlinDatum(wochenanfang(jetzt))

  const wochen: Wochenstatistik[] = []
  for (let k = wochenZurueck; k >= 0; k--) wochen.push(wochenstatistik(bloecke, datumVerschieben(laufende, -7 * k)))
  const aktuelle = wochen[wochen.length - 1]
  const r = (w: Wochenstatistik): number => rang(w.produktiv)
  const aufZiel = (w: Wochenstatistik): boolean => r(w) >= ziel
  const abgeschlossen = (w: Wochenstatistik): boolean => w.start < laufende

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
  /** Wie `melden` für eine Folge: Testdaten-Marke, wenn eine Woche der Folge Testdaten enthält */
  const meldenFolge = (typ: AuszeichnungTyp, n: number, bedingung: (w: Wochenstatistik) => boolean): void => {
    const w = folge(n, bedingung)
    if (!w) return
    const i = wochen.indexOf(w)
    melden(typ, w, wochen.slice(i - n + 1, i + 1).some((x) => x.testdaten))
  }

  // Besondere
  melden('erste_woche_level10', erste(aufZiel))
  melden('comeback', erste((w, i) => i > 0 && !wochen[i - 1].leer && r(wochen[i - 1]) < 5 && aufZiel(w)))
  melden('eternal', erste((w) => r(w) >= MAX_RANG))

  // Serien
  meldenFolge('drei_wochen_level10', 3, aufZiel)
  meldenFolge('serie_6', 6, aufZiel)
  meldenFolge('serie_12', 12, aufZiel)
  meldenFolge('dauerbrenner', 4, (w) => w.produktiv >= 55 * STUNDE)

  // Stunden-Meilensteine (aus der Datenbank, über alle Zeit)
  if (kontext.gesamtProduktiv !== null) {
    for (const [typ, stunden] of STUNDEN_MEILENSTEINE) if (kontext.gesamtProduktiv >= stunden * STUNDE) melden(typ, aktuelle, false)
  }

  // Liga-Meilensteine
  if (kontext.trophaeen !== null) {
    for (const [typ, stufe] of LIGA_MEILENSTEINE) {
      const ab = LIGEN.find((l) => l.stufe === stufe)?.ab ?? Infinity
      if (kontext.trophaeen >= ab) melden(typ, aktuelle, false)
    }
  }

  // Tage
  melden('perfekte_woche', erste((w) => w.tage.every((t) => t >= 5 * STUNDE)))
  {
    // Sieben Tage in Folge, auch über den Wochenwechsel: alle Tage der Wochen hintereinander
    let lauf = 0
    for (const w of wochen) {
      for (const t of w.tage) {
        lauf = t >= 4 * STUNDE ? lauf + 1 : 0
        if (lauf >= 7) {
          melden('durchlaeufer', w)
          break
        }
      }
      if (lauf >= 7) break
    }
  }
  melden('marathon', erste((w) => w.tage.some((t) => t >= 10 * STUNDE)))
  melden('ultra', erste((w) => w.tage.some((t) => t >= 12 * STUNDE)))
  melden('sprint', erste((w) => w.laengsteStrecke >= 3 * STUNDE))

  // Team (nur abgeschlossene Wochen, aus team_wochen)
  if (kontext.eigeneUserId && kontext.teamWochen.length > 0) {
    const jeWoche = new Map<string, TeamWoche[]>()
    for (const z of kontext.teamWochen) {
      const l = jeWoche.get(z.wocheStart) ?? []
      l.push(z)
      jeWoche.set(z.wocheStart, l)
    }
    const personen = new Set(kontext.teamWochen.map((z) => z.userId)).size
    const sieger = (w: Wochenstatistik): boolean => {
      if (!abgeschlossen(w)) return false
      const zeilen = jeWoche.get(w.start) ?? []
      if (zeilen.length < 2) return false
      const meine = zeilen.find((z) => z.userId === kontext.eigeneUserId)
      if (!meine || meine.produktiveSekunden <= 0) return false
      return zeilen.every((z) => z.userId === meine.userId || z.produktiveSekunden < meine.produktiveSekunden)
    }
    melden('wochensieger', erste(sieger), false)
    meldenFolge('dauersieger', 3, sieger)
    const zielVon = (userId: string): number =>
      zielRang(kontext.teamZiele.find((z) => z.userId === userId && !z.taetigkeit)?.stundenProWoche ?? STANDARD_GESAMTZIEL)
    melden(
      'team_woche',
      erste((w) => {
        if (!abgeschlossen(w) || personen < 2) return false
        const zeilen = jeWoche.get(w.start) ?? []
        return zeilen.length === personen && zeilen.every((z) => rang(z.produktiveSekunden) >= zielVon(z.userId))
      }),
      false
    )
  }

  // Lernen und Disziplin
  if (lernziele.length > 0) {
    const alleZiele = (w: Wochenstatistik): boolean => !w.leer && zieleErreicht(w, lernziele).every((z) => z.erreicht)
    melden('alle_lernziele', erste(alleZiele))
    meldenFolge('lernmeister', 4, alleZiele)
  }
  melden('fokus_woche', erste((w) => abgeschlossen(w) && !w.leer && w.unproduktiv <= 2 * STUNDE && aufZiel(w)))
  const sauber = (w: Wochenstatistik): boolean => abgeschlossen(w) && !w.leer && w.produktiv >= 40 * STUNDE && w.ungeklaert === 0
  melden('aufgeraeumt', erste(sauber))
  meldenFolge('blitzsauber', 4, sauber)

  // Uhrzeit
  melden('fruehaufsteher', erste((w) => w.frueh >= 2 * STUNDE))
  melden('nachteule', erste((w) => w.spaet >= 2 * STUNDE))
  melden('wochenend_krieger', erste((w) => w.tage[5] + w.tage[6] >= 15 * STUNDE))
  return neue
}
