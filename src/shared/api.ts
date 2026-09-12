/**
 * Schnittstelle zwischen Fenster (Renderer) und Hintergrundprozess (Main).
 * Wird vom Preload-Skript als window.api bereitgestellt.
 */
import type {
  Auszeichnung,
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
  UpdateStatus,
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

import type { LigaStand, Urlaub } from './typen'

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
    /** Einstellung "Nur im Fokus aufzeichnen": an = ohne Fokus kein Block (Standard), aus = durchgehend nach Regeln. */
    nurFokusSetzen: (an: boolean) => Promise<void>
  }
  fokus: {
    /** Startet einen Fokus mit dieser Tätigkeit (und optional Kunde) ab dem Beginn (ISO, heute, darf in der Vergangenheit liegen). */
    starten: (taetigkeit: string, beginn: string, kunde?: string | null) => Promise<void>
    beenden: () => Promise<void>
    /** Der Hintergrundprozess möchte den Fokus-Dialog sehen (Symbol-Menü, Klick auf die Erinnerung "Kein Fokus"). */
    onDialogOeffnen: (rueckruf: () => void) => Abmelden
  }
  kunden: {
    /** Alle bekannten Kunden (Projekte) des Teams, alphabetisch. */
    liste: () => Promise<string[]>
    /** Kunden im ganzen Team umbenennen; heißt ein Kunde schon so, werden beide zusammengelegt. Liefert die Zahl geänderter Blöcke. */
    umbenennen: (alt: string, neu: string) => Promise<number>
    /** Kunden aus der Liste und aus allen Blöcken des Teams nehmen (die Blöcke bleiben, ohne Kunden). */
    loeschen: (name: string) => Promise<number>
  }
  weg: {
    /** "Ich bin weg": ab dem Beginn (ISO, bis drei Stunden zurück) läuft ein produktiver Block mit dieser Tätigkeit (und optional Kunde) bis zur Rückkehr. */
    starten: (taetigkeit: string, beginn: string, kunde?: string | null) => Promise<void>
    /** Rückkehr von Hand melden (sonst beendet die erste Eingabe die Abwesenheit). */
    beenden: () => Promise<void>
  }
  abwesenheit: {
    /** Die Abwesenheit war ein Termin o. Ä.: als produktiver Hand-Block mit dieser Tätigkeit buchen, der rote Block verschwindet. */
    zuordnen: (id: string, taetigkeit: string, notiz: string | null) => Promise<void>
    /** Die Abwesenheit war eine Pause: zählt nirgends, der rote Block verschwindet. */
    pause: (id: string) => Promise<void>
    /** Privat oder Handy: bleibt unproduktiv, gilt als eingeordnet. */
    privat: (id: string) => Promise<void>
    /** Später einordnen: die Rückfrage verschwindet, der Block bleibt in der Liste änderbar. */
    spaeter: (id: string) => Promise<void>
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
    /** Vergleichsschlüssel der Unterwegs-Tätigkeiten (nicht am Rechner: Dreh, Fahrt, Kundentermin), Wert true. */
    unterwegs: () => Promise<Record<string, boolean>>
    /** Einordnung "unterwegs" für das ganze Team setzen; braucht das Skript 16 in Supabase. */
    unterwegsSetzen: (name: string, an: boolean) => Promise<void>
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
    /** Mac: die Berechtigung "Bildschirmaufnahme" anfragen und die Systemeinstellungen öffnen; liefert den Stand danach. */
    bildschirmrechtAnfragen: () => Promise<SystemInfo['bildschirmrecht']>
    /** Diagnosetext (App, System, Erfassung, Abgleich, letzte Fehler) zum Einfügen in den Chat. */
    diagnose: () => Promise<string>
  }
  update: {
    status: () => Promise<UpdateStatus>
    /** Jetzt nach einer neuen Version sehen; liefert den Stand danach. */
    pruefen: () => Promise<UpdateStatus>
    /** Windows: App neu starten und Update einspielen. Mac: Download-Seite öffnen. */
    installieren: () => Promise<void>
    onStatus: (rueckruf: (status: UpdateStatus) => void) => Abmelden
  }
  auszeichnungen: {
    /** Die eigenen freigeschalteten Auszeichnungen. */
    liste: () => Promise<Auszeichnung[]>
    /** Wird aufgerufen, wenn gerade eine neue Auszeichnung dazugekommen ist. */
    onNeu: (rueckruf: (neue: Auszeichnung[]) => void) => Abmelden
  }
  rang: {
    /** Meldet, dass die Aufstiegs-Einblendung für diesen Rang gezeigt wurde. */
    gefeiert: (rang: number) => Promise<void>
  }
  liga: {
    /** Trophäen und Liga aller aktiven Personen, aus abgeschlossenen Wochen. */
    stand: () => Promise<LigaStand[]>
  }
  urlaub: {
    /** Die eigenen Urlaube, neueste zuerst. */
    eigene: () => Promise<Urlaub[]>
    /** Die Urlaube aller Personen (für die Team-Prognose). */
    alle: () => Promise<Urlaub[]>
    /** Urlaub eintragen; von und bis als "JJJJ-MM-TT". */
    anlegen: (von: string, bis: string, notiz: string | null) => Promise<Urlaub>
    loeschen: (id: string) => Promise<void>
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
