/** Gemeinsame Datentypen für Hintergrundprozess und Fenster. */

export type Bewertung = 'produktiv' | 'unproduktiv' | 'ungeklaert' | 'inaktiv'
export type RegelBewertung = Exclude<Bewertung, 'inaktiv'>
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

/** Eine Regel: Programm oder Fenstertitel enthält ein Muster, dann Tätigkeit und Bewertung. */
export interface Regel {
  id: string
  muster: string
  feld: 'programm' | 'titel'
  taetigkeit: string | null
  bewertung: RegelBewertung
  /** null = Team-Regel für alle, sonst die Nutzer-Kennung */
  giltFuer: string | null
  prioritaet: number
  aktiv: boolean
  erstelltVon: string | null
}

export interface NeueRegel {
  muster: string
  feld: 'programm' | 'titel'
  taetigkeit: string | null
  bewertung: RegelBewertung
  fuerAlle: boolean
}

/** Sekunden je Tag, Tätigkeit und Bewertung. Gleiche Form wie die Datenbankfunktion tages_summen. */
export interface Tagessumme {
  datum: string
  taetigkeit: string | null
  bewertung: Bewertung
  sekunden: number
}

/** Der Wochenstand einer Person für den Team-Screen. Nur Summen, keine einzelnen Blöcke. */
export interface TeamMitglied {
  userId: string
  name: string
  produktiveSekunden: number
  zuletztSync: string | null
  istIch: boolean
}

/** Die persönlichen Einstellungen aus der Tabelle profile. */
export interface Profil {
  name: string
  urlaubswochen: number
  idleSchwelleSekunden: number
  fenstertitelSpeichern: boolean
}

/** Das Symbol einer Tätigkeit: ein Markenlogo oder ein lucide-Symbol. */
export interface SymbolInfo {
  typ: 'lucide' | 'marke'
  name: string
}

/** Ein Wochenziel. taetigkeit null = Arbeitszeit gesamt. */
export interface Ziel {
  id: string
  userId: string
  taetigkeit: string | null
  stundenProWoche: number
}

/** Ein neuer Eintrag von Hand: Dreh, Kundentermin, Telefonat, Fahrt. */
export interface NeuerEintrag {
  start: string
  ende: string
  taetigkeit: string
  notiz: string | null
}

/** Was sich an einem Block von Hand ändern lässt. */
export interface BlockAenderung {
  taetigkeit?: string | null
  bewertung?: Bewertung
  start?: string
  ende?: string
  notiz?: string | null
  loeschen?: boolean
}

export type ErfassungsZustand =
  | 'laeuft'
  | 'inaktiv'
  | 'abwesend'
  | 'pausiert'
  | 'gestoppt'
  | 'nicht-angemeldet'

export interface LaufenderBlock {
  id: string
  start: string
  programm: string | null
  fenstertitel: string | null
  taetigkeit: string | null
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
