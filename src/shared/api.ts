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
  TeamAktuell,
  TeamMitglied,
  TeamTaetigkeit,
  TeamWoche,
  Ziel
} from './typen'
import type { BossHalleEintrag, BossStand, Duell, DuellArt, Ereignis, EreignisTyp, Kosmetik, SeasonStand, SpielEreignis } from './spiel'

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
    /** Papierkorb: die in den letzten 30 Tagen gelöschten Blöcke, zuletzt gelöschte zuerst (lokal und aus der Datenbank). */
    geloeschte: () => Promise<Block[]>
    /** Einen gelöschten Block zurückholen. Fenstertitel und Notiz sind beim Löschen entfernt worden und bleiben leer. */
    wiederherstellen: (id: string) => Promise<Block | null>
    /** Datenexport: alle eigenen Blöcke zwischen zwei Zeitpunkten (ISO), auch älter als 13 Wochen (dann aus der Datenbank). */
    exportieren: (von: string, bis: string) => Promise<Block[]>
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
    /** Tätigkeit im ganzen Team umbenennen; heißt eine schon so, werden beide zusammengelegt. Liefert die Zahl geänderter Blöcke. Braucht Skript 19. */
    umbenennen: (alt: string, neu: string) => Promise<number>
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
    /** Die Protokolldatei im Dateimanager zeigen; liefert den Pfad oder null, wenn es noch keine gibt. */
    protokollOeffnen: () => Promise<string | null>
    /** Die App komplett neu starten (Wachhund-Leiste "App neu starten"). */
    neustart: () => Promise<void>
  }
  update: {
    status: () => Promise<UpdateStatus>
    /** Jetzt nach einer neuen Version sehen; liefert den Stand danach. */
    pruefen: () => Promise<UpdateStatus>
    /** Geladenes Update einspielen und die App neu starten (Windows und Mac); sonst die Download-Seite öffnen. */
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
    /** Produktive Sekunden je Person, Tätigkeit und Kunde im Zeitraum (ISO), eigene aus den lokalen Blöcken. Braucht Skript 18. */
    taetigkeiten: (von: string, bis: string) => Promise<TeamTaetigkeit[]>
    /** Der jüngste Block je Person aus den letzten 24 Stunden ("Gerade: …"), eigener live. Braucht Skript 18. */
    aktuell: () => Promise<TeamAktuell[]>
  }
  bericht: {
    /** Textdatei über den Speichern-Dialog ablegen (Kundenbericht als CSV); liefert den Pfad oder null bei Abbruch. */
    speichern: (dateiname: string, inhalt: string) => Promise<string | null>
  }
  profil: {
    /** Die eigenen Einstellungen. */
    eigenes: () => Promise<Profil | null>
    /** Einstellungen ändern; wirkt sofort auf die Erfassung. */
    aendern: (aenderung: Partial<Profil>) => Promise<Profil>
  }
  /** Team-Spiel (22. September 2026): Boss-Raid, Season Pass, Duelle, Feed. Braucht Skript 21. */
  spiel: {
    /** Season, Level, Quests von heute, Streak, Teamstand, gewählte Kosmetik. */
    stand: () => Promise<SeasonStand | null>
    /** Der Boss der laufenden Woche mit Schaden je Person. */
    boss: () => Promise<BossStand | null>
    /** Alle abgeschlossenen Bosse (Trophäenhalle). */
    bossHalle: () => Promise<BossHalleEintrag[]>
    duelle: () => Promise<Duell[]>
    duellErstellen: (anUser: string, art: DuellArt, taetigkeit: string | null, bisIso: string, einsatz: string) => Promise<Duell>
    duellAntworten: (id: string, annehmen: boolean) => Promise<void>
    /** Der Einsatz (Kaffee) ist bezahlt. */
    duellEinloesen: (id: string) => Promise<void>
    feed: () => Promise<Ereignis[]>
    /** Eigener Eintrag in den Feed (Nachricht ans Team oder ein Ereignis mit Schlüssel gegen Doppelte). */
    posten: (typ: EreignisTyp, text: string, schluessel?: string | null) => Promise<boolean>
    /** Reaktion setzen oder wieder wegnehmen. */
    reagieren: (id: string, emoji: string) => Promise<void>
    kosmetikSetzen: (k: Partial<Kosmetik>) => Promise<Kosmetik>
    /** Sofort prüfen (nach eigenen Aktionen). */
    pruefen: () => Promise<void>
    /** Neue Punkte, Level, Boss-Siege, Duell-Anfragen. */
    onEreignis: (rueckruf: (ereignisse: SpielEreignis[]) => void) => Abmelden
  }
}
