/** Gemeinsame Datentypen für Hintergrundprozess und Fenster. */

export type Bewertung = 'produktiv' | 'unproduktiv' | 'ungeklaert' | 'inaktiv'
export type Quelle = 'auto' | 'manuell'

/** Ein Zeitblock. Zeiten als ISO-Text in UTC (immer aus Date.toISOString()). */
export interface Block {
  id: string
  userId: string
  start: string
  ende: string
  quelle: Quelle
  programm: string | null
  programmRoh: string | null
  fenstertitel: string | null
  taetigkeit: string | null
  bewertung: Bewertung
  notiz: string | null
  manuellGeprueft: boolean
  geraet: string | null
  geaendertAm: string
  geloeschtAm: string | null
}

export type ErfassungsZustand =
  | 'laeuft'
  | 'inaktiv'
  | 'abwesend'
  | 'pausiert'
  | 'gestoppt'
  | 'nicht-angemeldet'

export interface LaufenderBlock {
  start: string
  programm: string | null
  fenstertitel: string | null
  bewertung: Bewertung
}

/** Was das Fenster über den Stand der Erfassung wissen muss. Wird alle 5 Sekunden geschickt. */
export interface ErfassungsStatus {
  zustand: ErfassungsZustand
  laufenderBlock: LaufenderBlock | null
  inaktivSeit: string | null
  pausiertSeit: string | null
  heuteProduktivSekunden: number
  wocheProduktivSekunden: number
  level: number
  unsynchronisiert: number
  letzterSync: string | null
  syncFehler: string | null
}
