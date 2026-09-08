/**
 * Schnittstelle zwischen Fenster (Renderer) und Hintergrundprozess (Main).
 * Wird vom Preload-Skript als window.api bereitgestellt.
 */
import type {
  Block,
  BlockAenderung,
  ErfassungsStatus,
  NeueRegel,
  NeuerEintrag,
  Profil,
  Regel,
  RegelAenderung,
  SymbolInfo,
  SystemInfo,
  Tagessumme,
  TeamMitglied,
  TeamWoche,
  Ziel
} from './typen'

export interface AuthStatus {
  /** false, wenn die Supabase-Zugangsdaten beim Bauen gefehlt haben */
  konfiguriert: boolean
  angemeldet: boolean
  userId: string | null
  email: string | null
  name: string | null
}

export interface AuthErgebnis {
  ok: boolean
  fehler: string | null
}

/** Abmelden einer Ereignis-Anmeldung. */
export type Abmelden = () => void

export interface Api {
  auth: {
    status: () => Promise<AuthStatus>
    anmelden: (email: string, passwort: string) => Promise<AuthErgebnis>
    abmelden: () => Promise<void>
  }
  erfassung: {
    status: () => Promise<ErfassungsStatus>
    pause: () => Promise<void>
    fortsetzen: () => Promise<void>
    /** Wird bei jedem Takt der Erfassung aufgerufen. */
    onStatus: (rueckruf: (status: ErfassungsStatus) => void) => Abmelden
  }
  bloecke: {
    /** Alle Blöcke eines Berliner Kalendertags ("JJJJ-MM-TT"). */
    tag: (datum: string) => Promise<Block[]>
    /** Alle Blöcke zwischen zwei Zeitpunkten (ISO). */
    zeitraum: (von: string, bis: string) => Promise<Block[]>
    /** Sekunden je Tag, Tätigkeit und Bewertung zwischen zwei Kalendertagen ("JJJJ-MM-TT"). Lange Zeiträume aus der Datenbank. */
    tagesSummen: (vonDatum: string, bisDatum: string) => Promise<Tagessumme[]>
    /** Wie viele automatische Blöcke noch nicht eingeordnet sind. */
    ungeklaert: () => Promise<number>
    /** Die nicht eingeordneten Blöcke, neueste zuerst. */
    ungeklaerteListe: () => Promise<Block[]>
    /** Einen Block von Hand eintragen (Dreh, Termin, Fahrt). Wirft bei ungültigen Angaben. */
    manuellAnlegen: (eintrag: NeuerEintrag) => Promise<Block>
    /** Die zuletzt von Hand eingetragenen Blöcke, neueste zuerst. */
    manuelleListe: (maximal?: number) => Promise<Block[]>
    /** Einen Block von Hand ändern. Wirft bei ungültigen Zeiten. */
    aendern: (id: string, aenderung: BlockAenderung) => Promise<Block | null>
    /** Mehrere Blöcke auf einmal ändern. Liefert die Anzahl. */
    mehrereAendern: (ids: string[], aenderung: BlockAenderung) => Promise<number>
    /** Wird aufgerufen, wenn sich die Blockliste geändert hat. */
    onAenderung: (rueckruf: () => void) => Abmelden
  }
  regeln: {
    liste: () => Promise<Regel[]>
    /** Legt eine Regel an und bewertet alle nicht geprüften Blöcke neu. */
    anlegen: (neu: NeueRegel) => Promise<{ regel: Regel; neuBewertet: number }>
    /** Ändert eine Regel und bewertet neu. */
    aendern: (id: string, aenderung: RegelAenderung) => Promise<{ regel: Regel; neuBewertet: number }>
    /** Löscht eine Regel und bewertet neu. Liefert die Anzahl neu bewerteter Blöcke. */
    loeschen: (id: string) => Promise<number>
  }
  taetigkeiten: {
    /** Alle bekannten Tätigkeitsnamen des Teams, alphabetisch. */
    liste: () => Promise<string[]>
    /** Symbol je Vergleichsschlüssel (siehe taetigkeitSchluessel). */
    symbole: () => Promise<Record<string, SymbolInfo>>
    /** Symbol einer Tätigkeit für das ganze Team setzen. */
    symbolSetzen: (name: string, symbol: SymbolInfo) => Promise<void>
  }
  ziele: {
    /** Die eigenen Wochenziele. */
    eigene: () => Promise<Ziel[]>
    /** Die Wochenziele aller drei (für den Team-Screen). */
    alle: () => Promise<Ziel[]>
    /** Eigenes Ziel setzen oder anlegen; taetigkeit null = Arbeitszeit gesamt. */
    setzen: (taetigkeit: string | null, stundenProWoche: number) => Promise<Ziel>
    loeschen: (id: string) => Promise<void>
  }
  system: {
    info: () => Promise<SystemInfo>
    /** Autostart ein- oder ausschalten; wirkt nur in der installierten App. */
    autostartSetzen: (an: boolean) => Promise<boolean>
  }
  team: {
    /** Produktive Wochenstunden aller aktiven Personen, eigene live. */
    stand: () => Promise<TeamMitglied[]>
    /** Produktive Sekunden je Person und Woche zwischen zwei Kalendertagen ("JJJJ-MM-TT"). */
    wochen: (vonDatum: string, bisDatum: string) => Promise<TeamWoche[]>
  }
  profil: {
    /** Die eigenen Einstellungen. */
    eigenes: () => Promise<Profil | null>
    /** Einstellungen ändern; wirkt sofort auf die Erfassung. */
    aendern: (aenderung: Partial<Profil>) => Promise<Profil>
  }
}
