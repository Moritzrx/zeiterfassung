/**
 * Schnittstelle zwischen Fenster (Renderer) und Hintergrundprozess (Main).
 * Wird vom Preload-Skript als window.api bereitgestellt.
 */
import type { Block, ErfassungsStatus } from './typen'

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
    /** Wie viele automatische Blöcke noch nicht eingeordnet sind. */
    ungeklaert: () => Promise<number>
    /** Wird aufgerufen, wenn sich die Blockliste geändert hat. */
    onAenderung: (rueckruf: () => void) => Abmelden
  }
}
