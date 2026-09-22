import type { Block } from './typen'
import { berlinDatum, datumVerschieben, datumZuTagesanfang } from './zeit'

/*
 * Das Team-Spiel (22. September 2026, Go des Auftraggebers für "Boss-Raid, Season Pass mit Daily Quests und Streaks,
 * Duelle, Team-Feed"): hier steht die reine Rechnung, die überall gleich sein muss (Hauptprozess wertet aus und
 * schreibt Punkte, das Fenster zeigt an). Nichts hier greift auf die Datenbank zu.
 */

// ---------------------------------------------------------------------------------------------------------------------
// Season: zwölf Wochen, die erste beginnt mit dem Neustart auf null am Montag, 14. September 2026.
// ---------------------------------------------------------------------------------------------------------------------

export const SEASON_START = '2026-09-14'
export const SEASON_WOCHEN = 12
export const SEASON_LEVEL_MAX = 30
export const PUNKTE_JE_LEVEL = 150

export interface SeasonZeitraum {
  nummer: number
  /** Montag, an dem die Season beginnt (JJJJ-MM-TT) */
  start: string
  /** Montag nach der Season (nicht mehr dabei) */
  ende: string
}

/** Wochenindex seit dem ersten Season-Montag (0 = die Woche vom 14. September 2026), auch negativ davor. */
export function wochenIndex(datum: string): number {
  const ms = datumZuTagesanfang(datum).getTime() - datumZuTagesanfang(SEASON_START).getTime()
  return Math.floor(ms / (7 * 24 * 3_600_000))
}

export function seasonVon(datum: string): SeasonZeitraum {
  const index = Math.max(0, Math.floor(wochenIndex(datum) / SEASON_WOCHEN))
  const start = datumVerschieben(SEASON_START, index * SEASON_WOCHEN * 7)
  return { nummer: index + 1, start, ende: datumVerschieben(start, SEASON_WOCHEN * 7) }
}

export function seasonLevel(punkte: number): number {
  return Math.min(SEASON_LEVEL_MAX, Math.floor(Math.max(0, punkte) / PUNKTE_JE_LEVEL) + 1)
}

/** Punkte, ab denen ein Level erreicht ist. */
export function levelSchwelle(level: number): number {
  return Math.max(0, level - 1) * PUNKTE_JE_LEVEL
}

// ---------------------------------------------------------------------------------------------------------------------
// Belohnungen des Season Pass: Titel, Rahmen ums Wappen, Hintergrund-Stimmung, goldenes Tray-Symbol.
// ---------------------------------------------------------------------------------------------------------------------

export type BelohnungArt = 'titel' | 'rahmen' | 'hintergrund' | 'tray'

export interface Belohnung {
  level: number
  art: BelohnungArt
  schluessel: string
  name: string
  text: string
}

export const BELOHNUNGEN: readonly Belohnung[] = [
  { level: 2, art: 'titel', schluessel: 'aufsteiger', name: 'Aufsteiger', text: 'Ein Titel unter deinem Namen im Team.' },
  { level: 3, art: 'rahmen', schluessel: 'lorbeer', name: 'Bronze-Lorbeer', text: 'Ein Lorbeerkranz um dein Wappen.' },
  { level: 5, art: 'hintergrund', schluessel: 'smaragd', name: 'Smaragd', text: 'Der Hintergrund der App in Grün und Türkis.' },
  { level: 6, art: 'titel', schluessel: 'fokusjaeger', name: 'Fokus-Jäger', text: 'Titel unter deinem Namen.' },
  { level: 8, art: 'rahmen', schluessel: 'fluegel', name: 'Silber-Flügel', text: 'Silberne Flügel an deinem Wappen.' },
  { level: 10, art: 'tray', schluessel: 'gold', name: 'Goldenes Symbol', text: 'Das Symbol unten rechts in der Taskleiste leuchtet gold statt grün.' },
  { level: 11, art: 'titel', schluessel: 'bossjaeger', name: 'Boss-Jäger', text: 'Titel unter deinem Namen.' },
  { level: 13, art: 'hintergrund', schluessel: 'violett', name: 'Violett', text: 'Der Hintergrund in Violett und Magenta.' },
  { level: 15, art: 'rahmen', schluessel: 'krone', name: 'Gold-Krone', text: 'Eine goldene Krone über deinem Wappen.' },
  { level: 18, art: 'titel', schluessel: 'streakmeister', name: 'Streak-Meister', text: 'Titel unter deinem Namen.' },
  { level: 20, art: 'hintergrund', schluessel: 'rotgold', name: 'Rot-Gold', text: 'Der Hintergrund in Rot und Gold.' },
  { level: 22, art: 'titel', schluessel: 'dauerlaeufer', name: 'Dauerläufer', text: 'Titel unter deinem Namen.' },
  { level: 25, art: 'rahmen', schluessel: 'halo', name: 'Astral-Halo', text: 'Ein violetter Lichtkranz um dein Wappen.' },
  { level: 28, art: 'titel', schluessel: 'legende', name: 'Legende der Season', text: 'Titel unter deinem Namen.' },
  { level: 30, art: 'hintergrund', schluessel: 'monochrom', name: 'Monochrom', text: 'Der Hintergrund in Weiß und Silber, nur für Level 30.' }
]

export const TITEL: Record<string, string> = {
  aufsteiger: 'Aufsteiger',
  fokusjaeger: 'Fokus-Jäger',
  bossjaeger: 'Boss-Jäger',
  streakmeister: 'Streak-Meister',
  dauerlaeufer: 'Dauerläufer',
  legende: 'Legende der Season',
  champion: 'Season-Champion'
}

export const RAHMEN: Record<string, { name: string; farbe: string }> = {
  lorbeer: { name: 'Bronze-Lorbeer', farbe: '#C4834B' },
  fluegel: { name: 'Silber-Flügel', farbe: '#C9CDD6' },
  krone: { name: 'Gold-Krone', farbe: '#E8B923' },
  halo: { name: 'Astral-Halo', farbe: '#C084FC' }
}

/** Hintergrund-Stimmungen: zwei Lichtfarben (a = bisher Orange, b = bisher Grün). */
export const STIMMUNGEN: Record<string, { name: string; a: string; b: string }> = {
  standard: { name: 'Standard', a: '#FE5303', b: '#00C076' },
  smaragd: { name: 'Smaragd', a: '#00C076', b: '#2DD4BF' },
  violett: { name: 'Violett', a: '#C084FC', b: '#EC4899' },
  rotgold: { name: 'Rot-Gold', a: '#FF4D4D', b: '#E8B923' },
  monochrom: { name: 'Monochrom', a: '#F2F2F3', b: '#9CA3AF' }
}

export function belohnungenBisLevel(level: number): Belohnung[] {
  return BELOHNUNGEN.filter((b) => b.level <= level)
}

export function naechsteBelohnung(level: number): Belohnung | null {
  return BELOHNUNGEN.find((b) => b.level > level) ?? null
}

// ---------------------------------------------------------------------------------------------------------------------
// Punkte: woher sie kommen und wie viel es gibt.
// ---------------------------------------------------------------------------------------------------------------------

export const PUNKTE = {
  questTag: 15, // alle drei Quests eines Tages geschafft
  streakTag: 10, // ein Tag mit mindestens STREAK_STUNDEN produktiv
  boss: 60, // der Wochen-Boss ist gefallen (jeder im Team)
  duell: 40, // ein Duell gewonnen
  auszeichnung: 20 // eine Medaille freigeschaltet
} as const

export const STREAK_STUNDEN = 4
export const STREAK_MEILENSTEINE: ReadonlyArray<{ tage: number; punkte: number }> = [
  { tage: 3, punkte: 30 },
  { tage: 7, punkte: 70 },
  { tage: 14, punkte: 140 },
  { tage: 30, punkte: 300 }
]

// ---------------------------------------------------------------------------------------------------------------------
// Daily Quests: drei je Tag und Person, fest gewürfelt aus Kennung und Datum.
// ---------------------------------------------------------------------------------------------------------------------

export interface QuestDefinition {
  id: string
  titel: string
  text: string
  punkte: number
  /** Erst am Tagesende entscheidbar (z. B. "kein Rot"), wird deshalb erst am nächsten Tag vergeben. */
  abendlich?: boolean
}

export const QUESTS: readonly QuestDefinition[] = [
  { id: 'frueher_vogel', titel: 'Früher Vogel', text: 'Vor 9 Uhr die erste produktive Minute.', punkte: 15 },
  { id: 'am_stueck', titel: 'Am Stück', text: '2 Stunden produktiv ohne Unterbrechung über 5 Minuten.', punkte: 20 },
  { id: 'tagesziel', titel: 'Tagesziel', text: '7 Stunden produktiv an einem Tag.', punkte: 30 },
  { id: 'halbzeit', titel: 'Halbzeit', text: '4 Stunden produktiv bis 13 Uhr.', punkte: 20 },
  { id: 'zwei_kunden', titel: 'Zwei Kunden', text: 'Für zwei verschiedene Kunden je 15 Minuten gearbeitet.', punkte: 15 },
  { id: 'vielseitig', titel: 'Vielseitig', text: 'Drei Tätigkeiten mit je mindestens 30 Minuten.', punkte: 15 },
  { id: 'tiefenfokus', titel: 'Tiefenfokus', text: '90 Minuten am Stück in einer Tätigkeit.', punkte: 20 },
  { id: 'sechs_stunden', titel: 'Sechs Stunden', text: '6 Stunden produktiv an einem Tag.', punkte: 25 },
  { id: 'nachgetragen', titel: 'Nachgetragen', text: 'Mindestens eine Zeit von Hand eingetragen.', punkte: 10 },
  // "Kein Rot" und "Sauberer Tag" gab es kurz (22. September 2026), der Auftraggeber hat sie gestrichen: Zeit nicht am Rechner ist
  // immer rot, "man kann ja nicht den ganzen Tag durcharbeiten".
  { id: 'nachmittag', titel: 'Nachmittagsschub', text: '2 Stunden produktiv nach 14 Uhr.', punkte: 15 },
  { id: 'feierabend', titel: 'Feierabend', text: 'Mindestens 4 Stunden am Tag und nach 21 Uhr nichts mehr (gilt am Tagesende).', punkte: 10, abendlich: true }
]

function saat(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function zufall(saatWert: number): () => number {
  let a = saatWert
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Die drei Quests einer Person an einem Tag: fest aus Kennung und Datum gewürfelt, höchstens eine "abendliche". */
export function tagesQuests(userId: string, datum: string): QuestDefinition[] {
  const wuerfel = zufall(saat(`${userId}|${datum}`))
  const topf = [...QUESTS]
  for (let i = topf.length - 1; i > 0; i--) {
    const j = Math.floor(wuerfel() * (i + 1))
    ;[topf[i], topf[j]] = [topf[j], topf[i]]
  }
  const gewaehlt: QuestDefinition[] = []
  let abendlich = 0
  for (const q of topf) {
    if (q.abendlich && abendlich >= 1) continue
    // Tagesziel und Sechs Stunden nicht am selben Tag, das wäre doppelt dasselbe.
    if (q.id === 'tagesziel' && gewaehlt.some((g) => g.id === 'sechs_stunden')) continue
    if (q.id === 'sechs_stunden' && gewaehlt.some((g) => g.id === 'tagesziel')) continue
    gewaehlt.push(q)
    if (q.abendlich) abendlich++
    if (gewaehlt.length === 3) break
  }
  return gewaehlt
}

export interface QuestStand {
  id: string
  titel: string
  text: string
  punkte: number
  /** 0 bis 1 */
  fortschritt: number
  erfuellt: boolean
  /** Erst am Tagesende entscheidbar */
  abendlich: boolean
}

interface Tageswerte {
  produktivSekunden: number
  ersterStartMs: number | null
  laengsteStreckeSekunden: number
  bisMittagSekunden: number
  kundenMit15Min: number
  taetigkeitenMit30Min: number
  laengsteTaetigkeitSekunden: number
  handEintraege: number
  nach14Sekunden: number
  nach21Sekunden: number
}

/** Alle Kennzahlen eines Berliner Kalendertags aus den Blöcken (am Tagesrand anteilig). */
export function tageswerte(bloecke: Block[], datum: string): Tageswerte {
  const tagVon = datumZuTagesanfang(datum).getTime()
  const tagBis = datumZuTagesanfang(datumVerschieben(datum, 1)).getTime()
  // Uhrzeit des Tages: Berliner Mitternacht plus Stunden (am Tag der Zeitumstellung eine Stunde ungenau, für Quests egal).
  const um = (stunde: number): number => tagVon + stunde * 3_600_000
  const w: Tageswerte = {
    produktivSekunden: 0,
    ersterStartMs: null,
    laengsteStreckeSekunden: 0,
    bisMittagSekunden: 0,
    kundenMit15Min: 0,
    taetigkeitenMit30Min: 0,
    laengsteTaetigkeitSekunden: 0,
    handEintraege: 0,
    nach14Sekunden: 0,
    nach21Sekunden: 0
  }
  const imTag = bloecke
    .filter((b) => !b.geloeschtAm && Date.parse(b.ende) > tagVon && Date.parse(b.start) < tagBis)
    .map((b) => ({ ...b, s: Math.max(Date.parse(b.start), tagVon), e: Math.min(Date.parse(b.ende), tagBis) }))
    .filter((b) => b.e > b.s)
    .sort((a, b) => a.s - b.s)
  const produktiv = imTag.filter((b) => b.bewertung === 'produktiv')
  const kunden = new Map<string, number>()
  const taetigkeiten = new Map<string, number>()
  let streckeStart = 0
  let streckeEnde = 0
  let laufStart = 0
  let laufEnde = 0
  let laufTaetigkeit: string | null = null
  for (const b of produktiv) {
    const dauer = (b.e - b.s) / 1000
    w.produktivSekunden += dauer
    if (w.ersterStartMs === null) w.ersterStartMs = b.s
    w.bisMittagSekunden += Math.max(0, Math.min(b.e, um(13)) - b.s) / 1000
    w.nach14Sekunden += Math.max(0, b.e - Math.max(b.s, um(14))) / 1000
    w.nach21Sekunden += Math.max(0, b.e - Math.max(b.s, um(21))) / 1000
    if (b.kunde) kunden.set(b.kunde, (kunden.get(b.kunde) ?? 0) + dauer)
    if (b.taetigkeit) taetigkeiten.set(b.taetigkeit, (taetigkeiten.get(b.taetigkeit) ?? 0) + dauer)
    if (b.quelle === 'manuell') w.handEintraege++
    // Längste Strecke: Lücken bis 5 Minuten zählen nicht als Unterbrechung.
    if (streckeEnde && b.s - streckeEnde <= 5 * 60_000) streckeEnde = Math.max(streckeEnde, b.e)
    else {
      streckeStart = b.s
      streckeEnde = b.e
    }
    w.laengsteStreckeSekunden = Math.max(w.laengsteStreckeSekunden, (streckeEnde - streckeStart) / 1000)
    // Tiefenfokus: dieselbe Tätigkeit am Stück (Lücken bis 2 Minuten).
    if (laufTaetigkeit !== null && b.taetigkeit === laufTaetigkeit && b.s - laufEnde <= 2 * 60_000) laufEnde = Math.max(laufEnde, b.e)
    else {
      laufTaetigkeit = b.taetigkeit
      laufStart = b.s
      laufEnde = b.e
    }
    w.laengsteTaetigkeitSekunden = Math.max(w.laengsteTaetigkeitSekunden, (laufEnde - laufStart) / 1000)
  }
  w.kundenMit15Min = [...kunden.values()].filter((s) => s >= 15 * 60).length
  w.taetigkeitenMit30Min = [...taetigkeiten.values()].filter((s) => s >= 30 * 60).length
  return w
}

/** Der Stand jeder Quest eines Tages; abendliche Quests gelten erst, wenn der Tag vorbei ist. */
export function questsBewerten(quests: QuestDefinition[], bloecke: Block[], datum: string, jetztMs: number): QuestStand[] {
  const w = tageswerte(bloecke, datum)
  const tagVorbei = jetztMs >= datumZuTagesanfang(datumVerschieben(datum, 1)).getTime()
  const tagVon = datumZuTagesanfang(datum).getTime()
  const anteil = (ist: number, soll: number): number => Math.max(0, Math.min(1, soll <= 0 ? 0 : ist / soll))
  return quests.map((q) => {
    let fortschritt = 0
    switch (q.id) {
      case 'frueher_vogel':
        fortschritt = w.ersterStartMs !== null && w.ersterStartMs < tagVon + 9 * 3_600_000 ? 1 : 0
        break
      case 'am_stueck':
        fortschritt = anteil(w.laengsteStreckeSekunden, 2 * 3600)
        break
      case 'tagesziel':
        fortschritt = anteil(w.produktivSekunden, 7 * 3600)
        break
      case 'halbzeit':
        fortschritt = anteil(w.bisMittagSekunden, 4 * 3600)
        break
      case 'zwei_kunden':
        fortschritt = anteil(w.kundenMit15Min, 2)
        break
      case 'vielseitig':
        fortschritt = anteil(w.taetigkeitenMit30Min, 3)
        break
      case 'tiefenfokus':
        fortschritt = anteil(w.laengsteTaetigkeitSekunden, 90 * 60)
        break
      case 'sechs_stunden':
        fortschritt = anteil(w.produktivSekunden, 6 * 3600)
        break
      case 'nachgetragen':
        fortschritt = w.handEintraege > 0 ? 1 : 0
        break
      case 'nachmittag':
        fortschritt = anteil(w.nach14Sekunden, 2 * 3600)
        break
      case 'feierabend':
        fortschritt = w.produktivSekunden >= 4 * 3600 && w.nach21Sekunden === 0 ? 1 : 0
        break
    }
    const erfuellt = fortschritt >= 1 && (!q.abendlich || tagVorbei)
    return { id: q.id, titel: q.titel, text: q.text, punkte: q.punkte, fortschritt, erfuellt, abendlich: !!q.abendlich }
  })
}

// ---------------------------------------------------------------------------------------------------------------------
// Streak: Tage in Folge mit mindestens STREAK_STUNDEN produktiv.
// ---------------------------------------------------------------------------------------------------------------------

export interface StreakStand {
  /** Tage in Folge bis heute (heute zählt mit, sobald es geschafft ist) */
  laenge: number
  heuteErreicht: boolean
  heuteSekunden: number
}

export function produktivAmTag(bloecke: Block[], datum: string): number {
  const von = datumZuTagesanfang(datum).getTime()
  const bis = datumZuTagesanfang(datumVerschieben(datum, 1)).getTime()
  let summe = 0
  for (const b of bloecke) {
    if (b.geloeschtAm || b.bewertung !== 'produktiv') continue
    const s = Math.max(Date.parse(b.start), von)
    const e = Math.min(Date.parse(b.ende), bis)
    if (e > s) summe += (e - s) / 1000
  }
  return summe
}

export function streakBerechnen(bloecke: Block[], heute: string, hoechstensTage = 120): StreakStand {
  const heuteSekunden = produktivAmTag(bloecke, heute)
  const heuteErreicht = heuteSekunden >= STREAK_STUNDEN * 3600
  let laenge = heuteErreicht ? 1 : 0
  let datum = datumVerschieben(heute, -1)
  for (let i = 0; i < hoechstensTage; i++) {
    if (produktivAmTag(bloecke, datum) < STREAK_STUNDEN * 3600) break
    laenge++
    datum = datumVerschieben(datum, -1)
  }
  return { laenge, heuteErreicht, heuteSekunden }
}

// ---------------------------------------------------------------------------------------------------------------------
// Boss-Raid: je Woche ein Boss, seine Lebenspunkte sind Teamstunden. Jede produktive Stunde ist Schaden.
// ---------------------------------------------------------------------------------------------------------------------

export interface BossDefinition {
  schluessel: string
  name: string
  spruch: string
}

export const BOSSE: readonly BossDefinition[] = [
  { schluessel: 'prokrastinator', name: 'Der Prokrastinator', spruch: 'Morgen ist auch noch ein Tag. Oder übermorgen.' },
  { schluessel: 'scrolldaemon', name: 'Der Scroll-Dämon', spruch: 'Nur noch ein Reel. Nur noch eins.' },
  { schluessel: 'meetinghydra', name: 'Die Meeting-Hydra', spruch: 'Für jedes Meeting, das ihr absagt, wachsen zwei nach.' },
  { schluessel: 'tabkraken', name: 'Der Tab-Kraken', spruch: 'Achtundvierzig Tabs. Alle wichtig.' },
  { schluessel: 'deadlinedrache', name: 'Der Deadline-Drache', spruch: 'Ich atme Freitagabend.' },
  { schluessel: 'chaostitan', name: 'Der Chaos-Titan', spruch: 'Ordnung ist nur Chaos, das noch nicht angefangen hat.' }
]

export const BOSS_FAKTOR_START = 0.8
export const BOSS_FAKTOR_SCHRITT = 0.05
export const BOSS_FAKTOR_MIN = 0.6
export const BOSS_FAKTOR_MAX = 1.3

export function bossFuerWoche(index: number): BossDefinition {
  return BOSSE[((index % BOSSE.length) + BOSSE.length) % BOSSE.length]
}

/** Faktor der nächsten Woche aus dem Ausgang der letzten: Sieg macht ihn stärker, Niederlage schwächer. */
export function bossFaktorDanach(faktor: number, besiegt: boolean | null): number {
  if (besiegt === null) return faktor
  const neu = faktor + (besiegt ? BOSS_FAKTOR_SCHRITT : -BOSS_FAKTOR_SCHRITT)
  return Math.round(Math.max(BOSS_FAKTOR_MIN, Math.min(BOSS_FAKTOR_MAX, neu)) * 100) / 100
}

/** Lebenspunkte in Sekunden: Summe der Wochenziele des Teams mal Faktor, auf Viertelstunden gerundet. */
export function bossHpSekunden(zielSummeStunden: number, faktor: number): number {
  return Math.round((zielSummeStunden * faktor) / 0.25) * 0.25 * 3600
}

export interface BossAnteil {
  userId: string
  name: string
  sekunden: number
  istIch: boolean
}

export interface BossStand {
  wocheStart: string
  schluessel: string
  name: string
  spruch: string
  hpSekunden: number
  schadenSekunden: number
  faktor: number
  anteile: BossAnteil[]
  /** null = läuft noch */
  besiegt: boolean | null
  /** Wie viele Bosse das Team schon besiegt hat (Trophäenhalle) */
  siege: number
  niederlagen: number
}

export interface BossHalleEintrag {
  wocheStart: string
  schluessel: string
  name: string
  hpSekunden: number
  ergebnisSekunden: number
  besiegt: boolean
}

// ---------------------------------------------------------------------------------------------------------------------
// Duelle
// ---------------------------------------------------------------------------------------------------------------------

/**
 * stunden: mehr produktive Stunden bis zum Ende (wahlweise nur eine Tätigkeit und/oder ein Kunde) · ziel: Wettlauf, wer zuerst
 * N Stunden hat (gleiche Filter; endet sofort, sobald jemand die Marke erreicht, sonst am Ende der Höhere) · fruehstart: wer
 * am gewählten Tag die erste produktive Minute früher hat · taetigkeit: alte Form bis 22. September 2026 (= stunden mit Tätigkeit).
 */
export type DuellArt = 'stunden' | 'taetigkeit' | 'fruehstart' | 'ziel'
export type DuellStatus = 'offen' | 'angenommen' | 'abgelehnt' | 'beendet'

export const DUELL_ARTEN: Record<DuellArt, { name: string; text: string }> = {
  stunden: { name: 'Mehr Stunden', text: 'Wer bis zum Ende mehr produktive Stunden hat, gewinnt. Auf Wunsch nur in einer Tätigkeit oder für einen Kunden.' },
  ziel: { name: 'Wettlauf', text: 'Wer zuerst die gewählte Stundenzahl erreicht, gewinnt sofort. Schafft es bis zum Ende keiner, gewinnt der Höhere.' },
  fruehstart: { name: 'Früher am Start', text: 'Wer am gewählten Tag die erste produktive Minute früher hat, gewinnt.' },
  taetigkeit: { name: 'Mehr in einer Tätigkeit', text: 'Wer bis zum Ende mehr Stunden in der gewählten Tätigkeit hat, gewinnt.' }
}

/** Was das Duell-Fenster zum Anlegen schickt. */
export interface NeuesDuell {
  anUser: string
  art: DuellArt
  taetigkeit: string | null
  kunde: string | null
  /** Ende als ISO; bei fruehstart der Tag (JJJJ-MM-TT) */
  bis: string
  einsatz: string
  zielStunden: number | null
  beschreibung: string | null
}

export interface Duell {
  id: string
  vonUser: string
  vonName: string
  anUser: string
  anName: string
  art: DuellArt
  taetigkeit: string | null
  kunde: string | null
  zielStunden: number | null
  beschreibung: string | null
  von: string
  bis: string
  einsatz: string
  status: DuellStatus
  gewinner: string | null
  unentschieden: boolean
  vonWert: number | null
  anWert: number | null
  eingeloestAm: string | null
  erstelltAm: string
}

// ---------------------------------------------------------------------------------------------------------------------
// Team-Feed
// ---------------------------------------------------------------------------------------------------------------------

export type EreignisTyp =
  | 'auszeichnung'
  | 'rang'
  | 'liga'
  | 'boss'
  | 'boss-schaden'
  | 'streak'
  | 'quests'
  | 'duell'
  | 'season'
  | 'nachricht'

export const REAKTIONEN: readonly string[] = ['🔥', '👏', '💪', '😂', '❤️']

export interface EreignisReaktion {
  emoji: string
  anzahl: number
  meine: boolean
}

export interface Ereignis {
  id: string
  userId: string
  name: string
  typ: EreignisTyp
  text: string
  erstelltAm: string
  reaktionen: EreignisReaktion[]
}

// ---------------------------------------------------------------------------------------------------------------------
// Season-Stand fürs Fenster
// ---------------------------------------------------------------------------------------------------------------------

export interface SeasonPerson {
  userId: string
  name: string
  punkte: number
  level: number
  istIch: boolean
  titel: string | null
  rahmen: string | null
}

export interface Kosmetik {
  titel: string | null
  rahmen: string | null
  hintergrund: string | null
}

export interface SeasonStand {
  season: SeasonZeitraum
  punkte: number
  level: number
  team: SeasonPerson[]
  quests: QuestStand[]
  /** Quests von gestern, die noch offen waren und heute noch zählen (abendliche) */
  streak: StreakStand
  kosmetik: Kosmetik
  /** Wie viele Punkte heute schon dazukamen */
  heutePunkte: number
}

export function heuteDatum(jetzt = new Date()): string {
  return berlinDatum(jetzt)
}

/** Was der Hauptprozess nach einer Prüfung ans Fenster meldet (feiern, Hinweis, Systemmeldung). */
export interface SpielEreignis {
  art: 'quest' | 'quest-tag' | 'streak' | 'boss' | 'duell' | 'duell-anfrage' | 'duell-angenommen' | 'level'
  text: string
  punkte: number
  level?: number
  belohnung?: Belohnung | null
  boss?: { name: string; schluessel: string; ergebnisSekunden: number; hpSekunden: number }
  /** Bei duell und duell-angenommen: Gegner und worum es geht, für die große Einblendung */
  duell?: { gegner: string; worum: string; einsatz: string }
}
