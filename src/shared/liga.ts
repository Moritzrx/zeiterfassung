/**
 * Die Liga: ein Langzeit-Stand über alle Wochen, wie die Ligen in Clash of Clans.
 * Jede abgeschlossene Woche bringt Trophäen dazu oder nimmt welche weg, je nachdem,
 * wie weit man über oder unter dem neutralen Punkt lag (Gesamtziel minus 10 Stunden).
 *
 * Die Summe über alle Wochen rechnet die Datenbank (supabase/08_liga.sql) mit genau
 * dieser Formel. Hier steht sie für die Vorschau der laufenden Woche und die Ligastufen.
 */

/** Erste Woche, die zählt (Montag). */
export const LIGA_START_DATUM = '2026-09-07'
/** Damit fängt jeder an: Bronze-Liga III. */
export const LIGA_START_TROPHAEEN = 400
/** Neutraler Punkt = Gesamtziel minus so viele Stunden. */
export const LIGA_NEUTRAL_ABSTAND = 10
/** Trophäen je Stunde über oder unter dem neutralen Punkt. */
export const LIGA_FAKTOR = 10
export const LIGA_MIN_DELTA = -120
export const LIGA_MAX_DELTA = 200

export type LigaStufe = 'keine' | 'bronze' | 'silber' | 'gold' | 'kristall' | 'meister' | 'champion' | 'titan' | 'legende'

export interface Liga {
  /** Position in LIGEN, 0 = ohne Liga */
  index: number
  name: string
  stufe: LigaStufe
  /** III, II, I als 3, 2, 1; 0 ohne Unterteilung */
  nummer: 0 | 1 | 2 | 3
  /** ab so vielen Trophäen */
  ab: number
}

function stufen(stufe: LigaStufe, name: string, ab: [number, number, number]): Omit<Liga, 'index'>[] {
  return [
    { name: `${name} III`, stufe, nummer: 3, ab: ab[0] },
    { name: `${name} II`, stufe, nummer: 2, ab: ab[1] },
    { name: `${name} I`, stufe, nummer: 1, ab: ab[2] }
  ]
}

const OHNE_INDEX: Omit<Liga, 'index'>[] = [
  { name: 'Ohne Liga', stufe: 'keine', nummer: 0, ab: 0 },
  ...stufen('bronze', 'Bronze-Liga', [400, 500, 600]),
  ...stufen('silber', 'Silber-Liga', [800, 1000, 1200]),
  ...stufen('gold', 'Gold-Liga', [1400, 1600, 1800]),
  ...stufen('kristall', 'Kristall-Liga', [2000, 2200, 2400]),
  ...stufen('meister', 'Meister-Liga', [2600, 2800, 3000]),
  ...stufen('champion', 'Champion-Liga', [3200, 3500, 3800]),
  ...stufen('titan', 'Titan-Liga', [4100, 4400, 4700]),
  { name: 'Legenden-Liga', stufe: 'legende', nummer: 0, ab: 5000 }
]

/** Alle Ligen von unten nach oben, Schwellen wie in Clash of Clans. */
export const LIGEN: Liga[] = OHNE_INDEX.map((l, index) => ({ ...l, index }))

export const LIGA_FARBEN: Record<LigaStufe, string> = {
  keine: '#5A5A60',
  bronze: '#C4834B',
  silber: '#C9CDD6',
  gold: '#E8B923',
  kristall: '#7DD3FC',
  meister: '#A78BFA',
  champion: '#FE5303',
  titan: '#F1F5F9',
  legende: '#FFD166'
}

export const LIGA_STUFEN_NAMEN: Record<LigaStufe, string> = {
  keine: 'Ohne Liga',
  bronze: 'Bronze',
  silber: 'Silber',
  gold: 'Gold',
  kristall: 'Kristall',
  meister: 'Meister',
  champion: 'Champion',
  titan: 'Titan',
  legende: 'Legende'
}

/** Die Liga zu einem Trophäenstand. */
export function liga(trophaeen: number): Liga {
  let aktuelle = LIGEN[0]
  for (const l of LIGEN) if (trophaeen >= l.ab) aktuelle = l
  return aktuelle
}

/** Die nächste Liga darüber, null in der Legenden-Liga. */
export function naechsteLiga(trophaeen: number): Liga | null {
  const l = liga(trophaeen)
  return LIGEN[l.index + 1] ?? null
}

/** Wie weit man innerhalb der aktuellen Liga ist, 0 bis 1. */
export function ligaFortschritt(trophaeen: number): number {
  const l = liga(trophaeen)
  const n = naechsteLiga(trophaeen)
  if (!n) return 1
  return Math.max(0, Math.min(1, (trophaeen - l.ab) / (n.ab - l.ab)))
}

/** Trophäen, die eine Woche mit so vielen produktiven Sekunden bringt (oder kostet). */
export function ligaDelta(produktivSekunden: number, gesamtziel: number): number {
  const stunden = produktivSekunden / 3600
  const roh = Math.round((stunden - (gesamtziel - LIGA_NEUTRAL_ABSTAND)) * LIGA_FAKTOR)
  return Math.max(LIGA_MIN_DELTA, Math.min(LIGA_MAX_DELTA, roh))
}

/** "+100", "−40" oder "±0". */
export function deltaText(delta: number): string {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `−${Math.abs(delta)}`
  return '±0'
}
