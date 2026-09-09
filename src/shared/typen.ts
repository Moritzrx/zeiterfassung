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
  /** true bei erfundenen Blöcken aus dem Testdaten-Skript */
  testdaten?: boolean
}

export type AuszeichnungTyp =
  | 'erste_woche_level10'
  | 'drei_wochen_level10'
  | 'serie_6'
  | 'serie_12'
  | 'alle_lernziele'
  | 'lernmeister'
  | 'fokus_woche'
  | 'fruehaufsteher'
  | 'nachteule'
  | 'marathon'
  | 'ultra'
  | 'sprint'
  | 'durchlaeufer'
  | 'wochenend_krieger'
  | 'perfekte_woche'
  | 'eternal'
  | 'comeback'
  | 'dauerbrenner'
  | 'aufgeraeumt'
  | 'blitzsauber'
  | 'stunden_100'
  | 'stunden_500'
  | 'stunden_1000'
  | 'stunden_2500'
  | 'stunden_5000'
  | 'liga_bronze'
  | 'liga_silber'
  | 'liga_gold'
  | 'liga_kristall'
  | 'liga_meister'
  | 'liga_champion'
  | 'liga_titan'
  | 'liga_legende'
  | 'wochensieger'
  | 'dauersieger'
  | 'team_woche'

/** Eine freigeschaltete Auszeichnung. Einmal verdient, bleibt sie. */
export interface Auszeichnung {
  typ: AuszeichnungTyp
  wocheStart: string
  freigeschaltetAm: string
  testdaten: boolean
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

/** Was sich an einer Regel ändern lässt. */
export interface RegelAenderung {
  muster?: string
  feld?: 'programm' | 'titel'
  taetigkeit?: string | null
  bewertung?: RegelBewertung
  aktiv?: boolean
  fuerAlle?: boolean
}

/** Angaben zu App und System für die Einstellungen. */
export interface SystemInfo {
  version: string
  plattform: 'windows' | 'mac' | 'linux'
  /** true in der installierten App, false in der Entwicklungsversion */
  gepackt: boolean
  autostart: boolean
}

/** Stand der automatischen Aktualisierung (src/main/aktualisierung.ts). */
export interface UpdateStatus {
  aktuelleVersion: string
  /**
   * entwicklung: keine Prüfung in der Entwicklungsversion · unbekannt: noch nicht geprüft · prueft ·
   * aktuell · verfuegbar (Mac: neue Version auf GitHub) · laedt (Windows: Download läuft) ·
   * bereit (Windows: installiert beim Neustart) · fehler
   */
  zustand: 'entwicklung' | 'unbekannt' | 'prueft' | 'aktuell' | 'verfuegbar' | 'laedt' | 'bereit' | 'fehler'
  neueVersion: string | null
  /** Download-Fortschritt 0–100, sonst null */
  prozent: number | null
  fehler: string | null
  zuletztGeprueft: string | null
  /** true, wenn die App das Update selbst einspielen kann (Windows); auf dem Mac öffnet sich die Download-Seite */
  selbstInstallierend: boolean
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

/** Der Ligastand einer Person aus der Datenbankfunktion liga_stand. */
export interface LigaStand {
  userId: string
  name: string
  trophaeen: number
  /** Anzahl der Wochen, die bisher gezählt haben */
  wochen: number
  /** Montag der zuletzt gezählten Woche, "JJJJ-MM-TT" */
  letzteWoche: string | null
  /** Trophäen der zuletzt gezählten Woche */
  letztesDelta: number | null
  /** was die zuletzt gezählte Woche am Stand tatsächlich geändert hat (nie unter 0); null vor Skript 12 */
  letztesWirksam: number | null
  /** heute im hinterlegten Urlaub */
  imUrlaub: boolean
  istIch: boolean
}

/** Ein hinterlegter Urlaub (oder freie Tage), Kalendertage "JJJJ-MM-TT" einschließlich. */
export interface Urlaub {
  id: string
  userId: string
  von: string
  bis: string
  notiz: string | null
}

/** Produktive Sekunden einer Person in einer Woche, für den Team-Verlauf. */
export interface TeamWoche {
  userId: string
  name: string
  wocheStart: string
  produktiveSekunden: number
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
  rang: number
  /** Ein Rang, der diese Woche noch nicht gefeiert wurde, sonst null */
  neuerRang: number | null
  unsynchronisiert: number
  letzterSync: string | null
  syncFehler: string | null
}
