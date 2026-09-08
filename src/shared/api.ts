/**
 * Schnittstelle zwischen Fenster (Renderer) und Hintergrundprozess (Main).
 * Wird vom Preload-Skript als window.api bereitgestellt.
 */
import type { Block, BlockAenderung, ErfassungsStatus, NeueRegel, Regel } from './typen'

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
    /** Wie viele automatische Blöcke noch nicht eingeordnet sind. */
    ungeklaert: () => Promise<number>
    /** Die nicht eingeordneten Blöcke, neueste zuerst. */
    ungeklaerteListe: () => Promise<Block[]>
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
  }
  taetigkeiten: {
    /** Alle bekannten Tätigkeitsnamen des Teams, alphabetisch. */
    liste: () => Promise<string[]>
  }
}
