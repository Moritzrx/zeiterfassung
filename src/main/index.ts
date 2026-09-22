import { app, BrowserWindow, dialog, globalShortcut, ipcMain, net, Notification, powerMonitor, shell } from 'electron'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { aktualisierungStarten } from './aktualisierung'
import type {
  Auszeichnung,
  Block,
  BlockAenderung,
  LigaStand,
  Urlaub,
  ErfassungsStatus,
  NeueRegel,
  NeuerEintrag,
  Profil as ProfilDaten,
  Regel,
  RegelAenderung,
  SymbolInfo,
  SystemInfo,
  Tagessumme,
  Bewertung,
  TeamAktuell,
  TeamMitglied,
  TeamTaetigkeit,
  TeamWoche,
  Ziel,
  Abwesenheit
} from '@shared/typen'
import { rang, rangName } from '@shared/rang'
import { AUSZEICHNUNGEN } from '@shared/auszeichnungen'
import { regelnAnwenden } from '@shared/regeln'
import { tagessummenAusBloecken } from '@shared/summen'
import {
  berlinDatum,
  berlinTeile,
  datumZuTagesanfang,
  naechsterTagesanfang,
  tagesanfang,
  wochenanfang,
  wochentag
} from '@shared/zeit'
import { authIpcRegistrieren, authStatus } from './auth'
import { Auszeichnungen } from './auszeichnungen'
import { blockAendern, eintragAnlegen } from './bearbeiten'
import { alleNeuBewerten } from './bewertung'
import { Erfassung, bildschirmrecht, bildschirmrechtAnfragen } from './erfassung'
import { protokollDateiFestlegen, protokollEinrichten, protokollNotiz, protokollPfad, protokollZeilen } from './protokoll'
import { release } from 'os'
import { Feier } from './feier'
import { Spiel } from './spiel'
import type { BossHalleEintrag, BossStand, Duell, DuellArt, Ereignis, EreignisTyp, Kosmetik, SeasonStand, SpielEreignis } from '@shared/spiel'
import { Profil } from './profil'
import { fokusRueckwirkend } from './fokus'
import { istFehlblock } from './programme'
import { Regelwerk } from './regelwerk'
import { Speicher } from './speicher'
import { supabase, supabaseKonfiguriert } from './supabase'
import { Sync, vonZeile, type Zeile as DbZeile } from './sync'
import { Taetigkeiten } from './taetigkeiten'
import { Kunden } from './kunden'
import { TrayLeiste } from './tray'
import { alleUrlaube, urlaubAnlegen, urlaubListe, urlaubLoeschen } from './urlaub'
import { Ziele } from './ziele'

const APP_ID = 'com.wessamedia.zeit'
const HINTERGRUND = '#0B0B0C'
const REGELN_TAKT_MS = 5 * 60_000
/** Team-Spiel: Quests, Streak, Boss und Duelle alle fünf Minuten prüfen (zusätzlich nach Blockänderungen). */
const SPIEL_TAKT_MS = 5 * 60_000

// Fehler und Warnungen des Hauptprozesses für die Diagnose mitschreiben (so früh wie möglich).
protokollEinrichten()

interface Sitzung {
  userId: string
  speicher: Speicher
  erfassung: Erfassung
  sync: Sync
  regelwerk: Regelwerk
  taetigkeiten: Taetigkeiten
  kunden: Kunden
  ziele: Ziele
  profil: Profil
  auszeichnungen: Auszeichnungen
  feier: Feier
  spiel: Spiel
  regelTimer: NodeJS.Timeout
  auszeichnungTimer: NodeJS.Timeout
  minutenTimer: NodeJS.Timeout
  wachhundTimer: NodeJS.Timeout
  spielTimer: NodeJS.Timeout
  pruefungAusstehend: NodeJS.Timeout | null
  gestartetMs: number
}

let fenster: BrowserWindow | null = null
let tray: TrayLeiste | null = null
let sitzung: Sitzung | null = null
let beendet = false
/** Rechner schläft oder ist gesperrt: der Wachhund schlägt dann nicht an. */
let schlaeft = false
/** Aktuelle Meldung des Wachhunds (steht im Status), sonst null. */
let wachhundWarnung: string | null = null
let wachhundGemeldetMs = 0
/** Wann der Wachhund zuletzt lief und wann der Rechner zuletzt aufgewacht ist (ms); nach dem Aufwachen gilt eine Schonfrist. */
let wachhundLetzterLaufMs = 0
let aufgewachtMs = 0
const WACHHUND_TAKT_MS = 60_000
const WACHHUND_SCHONFRIST_MS = 5 * 60_000
const WACHHUND_ERFASSUNG_MS = 3 * 60_000
const WACHHUND_SPEICHER_MS = 3 * 60_000
const WACHHUND_ABGLEICH_MS = 15 * 60_000
const WACHHUND_MELDUNG_ABSTAND_MS = 30 * 60_000

// Nur eine laufende App pro Rechner. Ein zweiter Start zeigt nur das Fenster.
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

function versteckterStart(): boolean {
  if (process.argv.includes('--hidden')) return true
  return process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin
}

/**
 * Ob die App beim Anmelden startet. Unter Windows muss die Abfrage dieselben Argumente nennen wie das Setzen
 * (`--hidden`), sonst vergleicht Electron gegen einen Eintrag ohne Argumente und meldet fälschlich "aus"
 * (Diagnose "Autostart: false" trotz vorhandenem Registry-Eintrag, 11. September 2026). macOS ignoriert die Option.
 */
function autostartAn(): boolean {
  return app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin
}

function fensterAnlegen(): BrowserWindow {
  const neu = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'wessamedia Zeit',
    backgroundColor: HINTERGRUND,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  neu.on('ready-to-show', () => {
    if (!versteckterStart()) neu.show()
  })

  // Das rote X schließt nur das Fenster. Die Erfassung läuft im Symbol weiter.
  neu.on('close', (ereignis) => {
    if (beendet) return
    ereignis.preventDefault()
    neu.hide()
    if (process.platform === 'darwin') app.dock?.hide()
  })
  neu.on('show', () => {
    if (process.platform === 'darwin') app.dock?.show()
  })

  // Links öffnen im Browser des Systems, nie in einem neuen App-Fenster.
  neu.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void neu.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void neu.loadFile(join(__dirname, '../renderer/index.html'))
  }
  // Zur Fehlersuche in der fertigen App: Start mit "--devtools" öffnet die Entwicklerwerkzeuge.
  if (process.argv.includes('--devtools')) neu.webContents.openDevTools({ mode: 'detach' })
  return neu
}

function fensterZeigen(): void {
  if (!fenster || fenster.isDestroyed()) fenster = fensterAnlegen()
  if (fenster.isMinimized()) fenster.restore()
  fenster.show()
  fenster.focus()
}

function stundenText(sekunden: number): string {
  return (sekunden / 3600).toFixed(1).replace('.', ',') + ' h'
}

function statusBerechnen(): ErfassungsStatus {
  if (!sitzung) {
    return {
      zustand: 'nicht-angemeldet',
      laufenderBlock: null,
      inaktivSeit: null,
      pausiertSeit: null,
      eigenesFenster: false,
      fokus: null,
      weg: null,
      offeneAbwesenheiten: [],
      nurFokus: true,
      heuteProduktivSekunden: 0,
      wocheProduktivSekunden: 0,
      rang: 0,
      neuerRang: null,
      unsynchronisiert: 0,
      letzterSync: null,
      syncFehler: null,
      warnung: null
    }
  }
  const jetzt = new Date()
  const { speicher, erfassung, sync, feier } = sitzung
  const heute = speicher.produktiveSekunden(tagesanfang(jetzt), naechsterTagesanfang(jetzt))
  const woche = speicher.produktiveSekunden(wochenanfang(jetzt), jetzt)
  const aktuellerRang = rang(woche)
  const gefeiert = feier.gefeierterRang(berlinDatum(wochenanfang(jetzt)))
  const e = erfassung.status()
  return {
    zustand: e.zustand,
    laufenderBlock: e.laufenderBlock,
    inaktivSeit: e.inaktivSeit,
    pausiertSeit: e.pausiertSeit,
    eigenesFenster: e.eigenesFenster,
    fokus: e.fokus,
    weg: e.weg,
    offeneAbwesenheiten: e.offeneAbwesenheiten,
    nurFokus: e.nurFokus,
    heuteProduktivSekunden: heute,
    wocheProduktivSekunden: woche,
    rang: aktuellerRang,
    neuerRang: aktuellerRang >= 1 && aktuellerRang > gefeiert ? aktuellerRang : null,
    unsynchronisiert: speicher.anzahlAusstehend(),
    letzterSync: sync.letzterSync?.toISOString() ?? null,
    syncFehler: sync.fehler,
    warnung: wachhundWarnung
  }
}

/**
 * Wachhund (15. September 2026, nach dem stillen Hänger vom 14. September: die App lud hoch, schrieb aber keine
 * Dateien mehr). Prüft jede Minute drei Dinge und meldet Abweichungen im Status (rote Leiste "App neu starten"),
 * im Protokoll und höchstens alle 30 Minuten als Systemmeldung: (1) der Erfassungstakt läuft (letzter Takt unter
 * 3 Minuten her), (2) Änderungen an den Blöcken kommen auf die Platte (kein Schreibfehler, Datei nicht älter als
 * die letzte Änderung plus 3 Minuten), (3) wartende Blöcke kommen in die Datenbank (letzter Abgleich unter
 * 15 Minuten her, solange der Rechner online ist). Im Ruhezustand und am Sperrbildschirm wird nicht geprüft.
 */
function wachhundPruefen(s: Sitzung): void {
  if (schlaeft || sitzung !== s) return
  const jetzt = Date.now()
  // Zeitsprung (Ruhezustand ohne Meldung, zugeklappter Laptop): wie ein Aufwachen behandeln (16. September 2026,
  // "die App sagt, sie hakt seit 500 Minuten, dabei habe ich nur geschlafen").
  if (wachhundLetzterLaufMs && jetzt - wachhundLetzterLaufMs > 3 * WACHHUND_TAKT_MS) aufgewachtMs = jetzt
  wachhundLetzterLaufMs = jetzt
  // Nach Start oder Aufwachen erst einmal Ruhe: Takt, Speicher und Abgleich brauchen ein paar Minuten, bis sie wieder laufen.
  const grundlinie = Math.max(s.gestartetMs, aufgewachtMs)
  if (jetzt - grundlinie < WACHHUND_SCHONFRIST_MS) return
  const probleme: string[] = []
  const minuten = (ms: number): number => Math.max(1, Math.round(ms / 60_000))
  // Jede Prüfung misst höchstens seit der Grundlinie, nie über einen Schlaf hinweg.
  const seit = (zeitpunkt: number): number => jetzt - Math.max(zeitpunkt, grundlinie)

  const e = s.erfassung.status()
  if (e.zustand !== 'gestoppt' && s.erfassung.taktZuletztMs && seit(s.erfassung.taktZuletztMs) > WACHHUND_ERFASSUNG_MS) {
    probleme.push(`Die Erfassung hat seit ${minuten(seit(s.erfassung.taktZuletztMs))} Minuten keinen Takt mehr gemacht.`)
  }

  if (s.erfassung.ablageFehler) {
    probleme.push(`Der laufende Fokus kann nicht gesichert werden (${s.erfassung.ablageFehler}).`)
  }
  if (s.speicher.letzterSchreibfehler) {
    probleme.push(`Blöcke können nicht gespeichert werden (${s.speicher.letzterSchreibfehler}).`)
  } else if (
    s.speicher.letzteAenderungMs > grundlinie &&
    s.speicher.letzteAenderungMs > s.speicher.letzteSchreibzeitMs + WACHHUND_SPEICHER_MS &&
    seit(s.speicher.letzteSchreibzeitMs) > WACHHUND_SPEICHER_MS
  ) {
    probleme.push(`Änderungen werden seit ${minuten(seit(s.speicher.letzteSchreibzeitMs))} Minuten nicht mehr gespeichert.`)
  } else if (s.speicher.letzteSchreibzeitMs > grundlinie) {
    const datei = s.speicher.dateiZeitMs()
    if (datei === null || s.speicher.letzteSchreibzeitMs - datei > WACHHUND_SPEICHER_MS) {
      probleme.push('Die Blockdatei im Datenordner wird nicht mehr geschrieben.')
    }
  }

  if (supabaseKonfiguriert() && s.speicher.anzahlAusstehend() > 0 && net.isOnline()) {
    const bezug = s.sync.letzterSync?.getTime() ?? 0
    if (seit(bezug) > WACHHUND_ABGLEICH_MS) {
      probleme.push(`Der Abgleich mit der Datenbank hängt seit ${minuten(seit(bezug))} Minuten${s.sync.fehler ? ` (${s.sync.fehler})` : ''}.`)
    }
  }

  const neu = probleme.length ? probleme.join(' ') : null
  if (neu !== wachhundWarnung) {
    wachhundWarnung = neu
    if (neu) console.warn('Wachhund:', neu)
    else protokollNotiz('Wachhund: wieder in Ordnung')
    statusVerteilen()
  }
  if (!neu || jetzt - wachhundGemeldetMs < WACHHUND_MELDUNG_ABSTAND_MS) return
  wachhundGemeldetMs = jetzt
  if (fenster && !fenster.isDestroyed() && fenster.isVisible() && fenster.isFocused()) return
  if (!Notification.isSupported()) return
  const meldung = new Notification({ title: 'wessamedia Zeit hakt', body: `${neu} Klicken und die App neu starten.` })
  meldung.on('click', fensterZeigen)
  meldung.show()
}

/** Die App komplett neu starten (Wachhund-Leiste, Einstellungen). */
function appNeustarten(): void {
  protokollNotiz('Neustart auf Wunsch')
  beendet = true
  app.relaunch()
  app.quit()
}

function statusVerteilen(): void {
  const status = statusBerechnen()
  if (fenster && !fenster.isDestroyed()) fenster.webContents.send('erfassung:status', status)
  tray?.aktualisieren({
    angemeldet: sitzung !== null,
    heuteText: stundenText(status.heuteProduktivSekunden),
    rang: status.rang,
    pausiert: status.zustand === 'pausiert',
    fokus: status.fokus?.taetigkeit ?? null,
    weg: status.weg?.taetigkeit ?? null,
    ohneFokus: status.zustand === 'ohne-fokus',
    zaehlt: status.zustand === 'laeuft' || status.zustand === 'weg'
  })
}

/** Fenster nach vorn holen und den Fokus-Dialog öffnen (Symbol-Menü, Klick auf die Erinnerung). */
function fokusDialogOeffnen(): void {
  fensterZeigen()
  if (fenster && !fenster.isDestroyed()) fenster.webContents.send('fokus:dialogOeffnen')
}

/**
 * Nur im Fokus: Wer zehn Minuten am Rechner arbeitet, ohne einen Fokus zu starten, bekommt einmal eine Systemmeldung
 * (höchstens alle 45 Minuten), sonst geht die Zeit still verloren. Ist das Fenster sichtbar, reicht die Kopfzeile.
 */
function ohneFokusMelden(minuten: number): void {
  if (fenster && !fenster.isDestroyed() && fenster.isVisible() && fenster.isFocused()) return
  if (!Notification.isSupported()) return
  const meldung = new Notification({
    title: 'Kein Fokus aktiv',
    body: `Du arbeitest seit ${minuten} Minuten ohne Fokus, diese Zeit zählt nicht. Klicken und Fokus starten.`
  })
  meldung.on('click', fokusDialogOeffnen)
  meldung.show()
}

/**
 * Rückkehr von "Ich bin weg" durch eine Eingabe erkannt (12. September 2026): im Fokus-Modus läuft danach nichts,
 * bis ein Fokus startet. Ist das Fenster vorne, geht der Fokus-Dialog direkt auf, sonst fragt eine Systemmeldung.
 */
function wegZurueckMelden(taetigkeit: string): void {
  if (!sitzung || !sitzung.erfassung.nurFokus || sitzung.erfassung.fokusStand()) return
  if (fenster && !fenster.isDestroyed() && fenster.isVisible() && fenster.isFocused()) {
    fenster.webContents.send('fokus:dialogOeffnen')
    return
  }
  if (!Notification.isSupported()) return
  const meldung = new Notification({
    title: 'Willkommen zurück',
    body: `„${taetigkeit}“ ist gebucht. Ab jetzt zählt erst wieder ein Fokus: klicken und starten.`
  })
  meldung.on('click', fokusDialogOeffnen)
  meldung.show()
}

/** Alle zwei Stunden Fokus einmal nachfragen, ob er noch stimmt (12. September 2026). */
function fokusLangeMelden(taetigkeit: string, stunden: number): void {
  if (!Notification.isSupported()) return
  const meldung = new Notification({
    title: `Fokus „${taetigkeit}“ läuft seit ${stunden} Stunden`,
    body: 'Stimmt das noch? Sonst oben „Fokus beenden“ oder einen neuen Fokus starten.'
  })
  meldung.on('click', fensterZeigen)
  meldung.show()
}

/** Fokus über das Fenster oder das Symbol-Menü beenden. */
function fokusBeenden(): void {
  if (!sitzung) return
  sitzung.erfassung.fokusBeenden(new Date())
  bloeckeGeaendert()
  statusVerteilen()
}

/** Rückkehr von "Ich bin weg" über das Fenster oder das Symbol-Menü melden. */
function wegBeenden(): void {
  if (!sitzung) return
  sitzung.erfassung.wegBeenden(new Date())
  bloeckeGeaendert()
  statusVerteilen()
  auszeichnungenBaldPruefen(sitzung)
}

/**
 * Nach einer Abwesenheit (15 Minuten bis 3 Stunden) einmal fragen, was das war: die Karte auf "Heute" zeigt es
 * sowieso; ist das Fenster gerade nicht zu sehen, kommt zusätzlich eine Systemmeldung, ein Klick öffnet die App.
 */
function abwesenheitMelden(a: Abwesenheit): void {
  if (fenster && !fenster.isDestroyed() && fenster.isVisible() && fenster.isFocused()) return
  if (!Notification.isSupported()) return
  const minuten = Math.round((Date.parse(a.ende) - Date.parse(a.start)) / 60_000)
  const meldung = new Notification({
    title: `Du warst ${minuten} Minuten weg`,
    body: 'Was war das? Pause, Termin oder privat: zum Einordnen Fenster öffnen.'
  })
  meldung.on('click', fensterZeigen)
  meldung.show()
}

function bloeckeGeaendert(): void {
  if (fenster && !fenster.isDestroyed()) fenster.webContents.send('bloecke:aenderung')
}

/** Neue Auszeichnungen prüfen, speichern und dem Fenster melden. */
async function auszeichnungenPruefen(s: Sitzung): Promise<void> {
  try {
    const neue = await s.auszeichnungen.pruefenUndSpeichern(s.speicher.alle(), s.ziele.eigene(), new Date())
    if (neue.length && fenster && !fenster.isDestroyed()) fenster.webContents.send('auszeichnungen:neu', neue)
    // Team-Spiel: jede neue Medaille bringt Season-Punkte und steht im Feed.
    for (const a of neue) {
      const info = AUSZEICHNUNGEN[a.typ]
      void s.spiel.auszeichnungMelden(a.typ, info.titel, info.text, a.wocheStart)
    }
    // Quests, Streak, Boss und Duelle gleich mit prüfen (alle 10 Minuten und 30 s nach Blockänderungen).
    void s.spiel.pruefen()
    // Ist das Fenster gerade nicht vorne, sagt eine Systemmeldung, welche Medaille es ist und wofür (16. September 2026).
    if (neue.length && !(fenster && !fenster.isDestroyed() && fenster.isVisible() && fenster.isFocused()) && Notification.isSupported()) {
      for (const a of neue.slice(0, 3)) {
        const info = AUSZEICHNUNGEN[a.typ]
        protokollNotiz(`Auszeichnung freigeschaltet: ${info.titel}`)
        const meldung = new Notification({ title: `Auszeichnung freigeschaltet: ${info.titel}`, body: `${info.text} Klicken zum Ansehen.` })
        meldung.on('click', fensterZeigen)
        meldung.show()
      }
    }
  } catch (fehler) {
    console.error('Auszeichnungen:', fehler)
  }
}

/** Nach Änderungen an Blöcken: Prüfung gebündelt, frühestens 30 Sekunden später. */
function auszeichnungenBaldPruefen(s: Sitzung): void {
  if (s.pruefungAusstehend) return
  s.pruefungAusstehend = setTimeout(() => {
    s.pruefungAusstehend = null
    void auszeichnungenPruefen(s)
  }, 30_000)
}

/** Sonntags ab 18 Uhr einmal eine Systemmeldung, dass die Wochenzusammenfassung bereitsteht. */
function sonntagsMeldung(s: Sitzung): void {
  const jetzt = new Date()
  if (wochentag(jetzt) !== 0 || berlinTeile(jetzt).stunde < 18) return
  const woche = berlinDatum(wochenanfang(jetzt))
  if (s.feier.istBenachrichtigt(woche)) return
  s.feier.benachrichtigt(woche)
  if (!Notification.isSupported()) return
  const sekunden = s.speicher.produktiveSekunden(wochenanfang(jetzt), jetzt)
  const r = rang(sekunden)
  const meldung = new Notification({
    title: 'Wochenzusammenfassung',
    body: `Rang ${r} · ${rangName(r)}, ${(sekunden / 3600).toFixed(1).replace('.', ',')} h produktiv. Zum Ansehen Fenster öffnen.`
  })
  meldung.on('click', fensterZeigen)
  meldung.show()
}

/** Persönliche Einstellungen auf die Erfassung anwenden. */
function profilAnwenden(s: Sitzung): void {
  s.erfassung.idleSchwelleSekunden = s.profil.daten.idleSchwelleSekunden
  s.erfassung.fenstertitelSpeichern = s.profil.daten.fenstertitelSpeichern
}

/** Regeln, Ziele und Profil neu laden und alle nicht geprüften Blöcke danach bewerten. */
async function regelnAktualisieren(s: Sitzung): Promise<number> {
  void s.ziele.laden()
  void s.profil.laden().then(() => profilAnwenden(s))
  const ok = await s.regelwerk.laden()
  if (!ok) return 0
  const geaendert = alleNeuBewerten(s.speicher, s.regelwerk.liste(), s.userId)
  if (geaendert) {
    bloeckeGeaendert()
    statusVerteilen()
  }
  return geaendert
}

/**
 * Team-Spiel (22. September 2026): neue Punkte, Level, Boss-Siege und Duell-Anfragen gehen ans Fenster (feiern) und, wenn
 * das Fenster nicht vorne ist, als Systemmeldung.
 */
function spielMelden(ereignisse: SpielEreignis[]): void {
  if (fenster && !fenster.isDestroyed()) fenster.webContents.send('spiel:ereignis', ereignisse)
  const vorne = fenster && !fenster.isDestroyed() && fenster.isVisible() && fenster.isFocused()
  if (vorne || !Notification.isSupported()) return
  for (const e of ereignisse) {
    if (e.art !== 'duell-anfrage' && e.art !== 'boss' && e.art !== 'level' && e.art !== 'duell') continue
    const titel = e.art === 'duell-anfrage' ? 'Duell-Herausforderung' : e.art === 'boss' ? 'Boss besiegt!' : e.art === 'duell' ? 'Duell gewonnen!' : 'Season-Level erreicht'
    protokollNotiz(`Spiel: ${titel}: ${e.text}`)
    const meldung = new Notification({ title: titel, body: `${e.text} Klicken zum Ansehen.` })
    meldung.on('click', fensterZeigen)
    meldung.show()
  }
}

function sitzungStarten(userId: string): void {
  if (sitzung?.userId === userId) return
  sitzungBeenden()
  const speicher = new Speicher(userId)
  speicher.aufraeumen()
  const regelwerk = new Regelwerk(userId)
  const taetigkeiten = new Taetigkeiten(userId)
  const kunden = new Kunden(userId)
  const ziele = new Ziele(userId)
  const profil = new Profil(userId)
  const auszeichnungen = new Auszeichnungen(userId)
  const feier = new Feier(userId)
  const spiel = new Spiel(userId, speicher, ziele, spielMelden)
  taetigkeiten.ausBloecken(speicher.alle())
  kunden.ausBloecken(speicher.alle())
  const erfassung = new Erfassung(speicher, userId, (programm, titel) =>
    regelnAnwenden(programm, titel, regelwerk.liste(), userId)
  )
  const fehlbloecke = speicher.fehlbloeckeAusblenden(istFehlblock)
  if (fehlbloecke) console.log(`Speicher: ${fehlbloecke} Blöcke von Systemfenstern und der App selbst ausgeblendet`)
  const sync = new Sync(speicher, userId, () => {
    // Aus der Datenbank geholte Blöcke nach den aktuellen Regeln bewerten.
    speicher.fehlbloeckeAusblenden(istFehlblock)
    taetigkeiten.ausBloecken(speicher.alle())
    kunden.ausBloecken(speicher.alle())
    alleNeuBewerten(speicher, regelwerk.liste(), userId)
    bloeckeGeaendert()
    statusVerteilen()
  })
  const s: Sitzung = {
    userId,
    speicher,
    erfassung,
    sync,
    regelwerk,
    taetigkeiten,
    kunden,
    ziele,
    profil,
    auszeichnungen,
    feier,
    spiel,
    regelTimer: setInterval(() => void regelnAktualisieren(s), REGELN_TAKT_MS),
    auszeichnungTimer: setInterval(() => void auszeichnungenPruefen(s), 10 * 60_000),
    minutenTimer: setInterval(() => sonntagsMeldung(s), 60_000),
    wachhundTimer: setInterval(() => wachhundPruefen(s), WACHHUND_TAKT_MS),
    spielTimer: setInterval(() => void s.spiel.pruefen(), SPIEL_TAKT_MS),
    pruefungAusstehend: null,
    gestartetMs: Date.now()
  }
  sitzung = s
  wachhundWarnung = null
  protokollNotiz(`Sitzung gestartet für ${userId.slice(0, 8)}…, ${speicher.alle().length} Blöcke lokal`)
  profilAnwenden(s)
  erfassung.on('status', statusVerteilen)
  erfassung.on('abwesenheit', (a: Abwesenheit) => abwesenheitMelden(a))
  erfassung.on('ohne-fokus', (minuten: number) => ohneFokusMelden(minuten))
  erfassung.on('weg-zurueck', (taetigkeit: string) => wegZurueckMelden(taetigkeit))
  erfassung.on('fokus-lange', (taetigkeit: string, stunden: number) => fokusLangeMelden(taetigkeit, stunden))
  erfassung.on('bloecke', () => {
    // Sobald ein Block endet, können kurze Wechsel davor ihre Nachbarn erben.
    alleNeuBewerten(s.speicher, s.regelwerk.liste(), s.userId)
    bloeckeGeaendert()
    auszeichnungenBaldPruefen(s)
  })
  erfassung.start()
  sync.start()
  // Auszeichnungen erst prüfen, wenn Regeln und der erste Abgleich da sind, sonst zählen veraltete Blöcke mit.
  void Promise.all([regelnAktualisieren(s), sync.erstAbgleich])
    .then(() => auszeichnungenPruefen(s))
    // Das Team-Spiel braucht die Profile und die eigenen Punkte, danach die erste Prüfung (Quests, Streak, Boss, Duelle).
    .then(() => spiel.laden())
    .then(() => spiel.pruefen())
  // Nach dem Laden bekommen Tätigkeiten mit dem neutralen Etikett einmal ein passendes Symbol (15. September 2026).
  void taetigkeiten
    .laden()
    .then(() => taetigkeiten.symboleErgaenzen())
    .then((n) => {
      if (n) bloeckeGeaendert()
    })
  void kunden.laden()
  statusVerteilen()
}

function sitzungBeenden(): void {
  if (!sitzung) return
  const alt = sitzung
  sitzung = null
  clearInterval(alt.regelTimer)
  clearInterval(alt.auszeichnungTimer)
  clearInterval(alt.minutenTimer)
  clearInterval(alt.wachhundTimer)
  clearInterval(alt.spielTimer)
  if (alt.pruefungAusstehend) clearTimeout(alt.pruefungAusstehend)
  alt.erfassung.stop()
  alt.sync.stop()
  alt.speicher.speichern()
  wachhundWarnung = null
  protokollNotiz('Sitzung beendet')
  statusVerteilen()
}

function ipcRegistrieren(): void {
  ipcMain.handle('erfassung:status', () => statusBerechnen())
  ipcMain.handle('erfassung:pause', () => {
    sitzung?.erfassung.pause()
  })
  ipcMain.handle('erfassung:fortsetzen', () => {
    sitzung?.erfassung.fortsetzen()
  })
  // Einstellung "Nur im Fokus aufzeichnen" (Standard an): aus = durchgehend aufzeichnen und nach Regeln bewerten wie früher.
  ipcMain.handle('erfassung:nurFokusSetzen', (_ereignis, an: boolean) => {
    if (!sitzung) return
    sitzung.erfassung.nurFokusSetzen(an)
    bloeckeGeaendert()
    statusVerteilen()
  })

  // Fokus: ab dem Beginn (heute, darf zurückliegen) zählt alles als produktiv mit dieser Tätigkeit.
  ipcMain.handle('fokus:starten', (_ereignis, taetigkeit: string, beginnIso: string, kundeName: string | null = null): void => {
    if (!sitzung) return
    const name = sitzung.taetigkeiten.merken(taetigkeit)
    if (!name) throw new Error('Bitte eine Tätigkeit angeben.')
    const kunde = kundeName ? sitzung.kunden.merken(kundeName) || null : null
    const jetzt = new Date()
    const gewuenscht = Date.parse(beginnIso) || jetzt.getTime()
    const beginn = new Date(Math.min(jetzt.getTime(), Math.max(gewuenscht, tagesanfang(jetzt).getTime())))
    sitzung.erfassung.fokusStarten(name, beginn, jetzt, kunde)
    const n = fokusRueckwirkend(sitzung.speicher, name, beginn, jetzt, sitzung.erfassung.laufendeId(), kunde)
    if (n) console.log(`Fokus „${name}“: ${n} Blöcke rückwirkend übernommen`)
    // Nur im Fokus: für die Zeit vor dem Start gibt es keine Aufzeichnung, die Lücken werden als Hand-Blöcke nachgetragen.
    const m = sitzung.erfassung.fokusNachtragen(beginn, jetzt)
    if (m) console.log(`Fokus „${name}“: ${m} Blöcke nachgetragen`)
    sitzung.erfassung.sofort()
    bloeckeGeaendert()
    statusVerteilen()
    auszeichnungenBaldPruefen(sitzung)
  })
  ipcMain.handle('fokus:beenden', () => fokusBeenden())

  // "Ich bin weg": ab dem Beginn (bis drei Stunden zurück) ein produktiver Hand-Block bis zur Rückkehr.
  ipcMain.handle('weg:starten', (_ereignis, taetigkeit: string, beginnIso: string, kundeName: string | null = null): void => {
    if (!sitzung) return
    const neu = !sitzung.taetigkeiten.kennt(taetigkeit)
    const name = sitzung.taetigkeiten.merken(taetigkeit)
    if (!name) throw new Error('Bitte eine Tätigkeit angeben.')
    // Eine hier neu angelegte Tätigkeit ist eine Unterwegs-Tätigkeit (gehört nicht in den Fokus-Dialog).
    if (neu) void sitzung.taetigkeiten.unterwegsSetzen(name, true).catch(() => undefined)
    const kunde = kundeName ? sitzung.kunden.merken(kundeName) || null : null
    const jetzt = new Date()
    const gewuenscht = Date.parse(beginnIso) || jetzt.getTime()
    const beginn = new Date(Math.min(jetzt.getTime(), Math.max(gewuenscht, jetzt.getTime() - 3 * 3_600_000, tagesanfang(jetzt).getTime())))
    sitzung.erfassung.wegStarten(name, beginn, jetzt, kunde)
    bloeckeGeaendert()
    statusVerteilen()
  })
  ipcMain.handle('weg:beenden', () => wegBeenden())

  // Rückfrage nach einer Abwesenheit: Termin (Hand-Block mit Tätigkeit, roter Block weg), Pause (roter Block weg),
  // privat (bleibt rot, gilt als eingeordnet), später (Rückfrage verschwindet).
  // Ein Ruheblock und alle Doppelgänger über exakt denselben Zeitraum (kommen in alten Daten vor).
  const abwesenheitBloecke = (id: string): Block[] => {
    if (!sitzung) return []
    const block = sitzung.speicher.get(id)
    if (!block || block.geloeschtAm) return []
    return sitzung.speicher
      .imZeitraum(new Date(block.start), new Date(block.ende))
      .filter((b) => b.quelle === 'auto' && b.programm === null && b.start === block.start && b.ende === block.ende)
  }
  ipcMain.handle('abwesenheit:zuordnen', (_ereignis, id: string, taetigkeit: string, notiz: string | null): void => {
    if (!sitzung) return
    const bloecke = abwesenheitBloecke(id)
    if (!bloecke.length) throw new Error('Diese Abwesenheit gibt es nicht mehr.')
    // Eine hier neu angelegte Tätigkeit ist eine Unterwegs-Tätigkeit (man war ja nicht am Rechner).
    const neu = !sitzung.taetigkeiten.kennt(taetigkeit)
    eintragAnlegen(sitzung.speicher, sitzung.taetigkeiten, sitzung.kunden, sitzung.userId,{ start: bloecke[0].start, ende: bloecke[0].ende, taetigkeit, notiz })
    if (neu) void sitzung.taetigkeiten.unterwegsSetzen(sitzung.taetigkeiten.merken(taetigkeit), true).catch(() => undefined)
    for (const b of bloecke) blockAendern(sitzung.speicher, sitzung.taetigkeiten, sitzung.kunden,b.id, { loeschen: true })
    bloeckeGeaendert()
    statusVerteilen()
    auszeichnungenBaldPruefen(sitzung)
  })
  ipcMain.handle('abwesenheit:pause', (_ereignis, id: string): void => {
    if (!sitzung) return
    for (const b of abwesenheitBloecke(id)) blockAendern(sitzung.speicher, sitzung.taetigkeiten, sitzung.kunden,b.id, { loeschen: true })
    bloeckeGeaendert()
    statusVerteilen()
    auszeichnungenBaldPruefen(sitzung)
  })
  ipcMain.handle('abwesenheit:privat', (_ereignis, id: string): void => {
    if (!sitzung) return
    for (const b of abwesenheitBloecke(id)) blockAendern(sitzung.speicher, sitzung.taetigkeiten, sitzung.kunden,b.id, {})
    bloeckeGeaendert()
    statusVerteilen()
  })
  ipcMain.handle('abwesenheit:spaeter', (_ereignis, id: string): void => {
    if (!sitzung) return
    for (const b of abwesenheitBloecke(id)) sitzung.erfassung.spaeterEinordnen(b.id)
  })

  ipcMain.handle('bloecke:tag', (_ereignis, datum: string): Block[] => {
    if (!sitzung) return []
    const von = datumZuTagesanfang(datum)
    const bis = naechsterTagesanfang(von)
    return sitzung.speicher.imZeitraum(von, bis)
  })
  ipcMain.handle('bloecke:zeitraum', (_ereignis, von: string, bis: string): Block[] => {
    if (!sitzung) return []
    return sitzung.speicher.imZeitraum(new Date(von), new Date(bis))
  })
  ipcMain.handle('bloecke:tagesSummen', async (_ereignis, vonDatum: string, bisDatum: string): Promise<Tagessumme[]> => {
    if (!sitzung) return []
    // Die letzten 90 Tage liegen lokal vor (13 Wochen); alles davor kommt als fertige Summen aus der Datenbank.
    const lokalAb = berlinDatum(new Date(Date.now() - 90 * 86_400_000))
    if (vonDatum >= lokalAb) return tagessummenAusBloecken(sitzung.speicher.alle(), vonDatum, bisDatum)
    if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
    const { data, error } = await supabase().rpc('tages_summen', { von: vonDatum, bis: bisDatum })
    if (error) {
      if (/tages_summen/.test(error.message)) {
        throw new Error('Für Zeiträume über zwölf Wochen muss in Supabase einmal das Skript 5 (05_auswertung.sql) ausgeführt werden.')
      }
      throw new Error('Datenbank nicht erreichbar: ' + error.message)
    }
    return ((data ?? []) as Array<{ datum: string; taetigkeit: string | null; bewertung: Tagessumme['bewertung']; sekunden: number | string }>).map(
      (z) => ({ datum: z.datum, taetigkeit: z.taetigkeit, bewertung: z.bewertung, sekunden: Number(z.sekunden) })
    )
  })
  ipcMain.handle('bloecke:manuellAnlegen', (_ereignis, eintrag: NeuerEintrag): Block => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    const block = eintragAnlegen(sitzung.speicher, sitzung.taetigkeiten, sitzung.kunden, sitzung.userId,eintrag)
    bloeckeGeaendert()
    statusVerteilen()
    return block
  })
  ipcMain.handle('bloecke:manuelleListe', (_ereignis, maximal?: number): Block[] =>
    sitzung?.speicher.manuelleListe(maximal) ?? []
  )
  ipcMain.handle('bloecke:ungeklaert', (): number => sitzung?.speicher.anzahlUngeklaert() ?? 0)
  ipcMain.handle('bloecke:ungeklaerteListe', (): Block[] => sitzung?.speicher.ungeklaerteListe() ?? [])

  ipcMain.handle('bloecke:aendern', (_ereignis, id: string, aenderung: BlockAenderung): Block | null => {
    if (!sitzung) return null
    if (sitzung.erfassung.laufendeId() === id) throw new Error('Der laufende Block lässt sich erst ändern, wenn er beendet ist.')
    const block = blockAendern(sitzung.speicher, sitzung.taetigkeiten, sitzung.kunden,id, aenderung)
    bloeckeGeaendert()
    statusVerteilen()
    auszeichnungenBaldPruefen(sitzung)
    return block
  })
  // Papierkorb (15. September 2026): gelöschte Blöcke der letzten 30 Tage, lokal und aus der Datenbank (der
  // Vollabgleich wirft gelöschte Blöcke lokal weg, darum reicht der Zwischenspeicher allein nicht).
  ipcMain.handle('bloecke:geloeschte', async (): Promise<Block[]> => {
    if (!sitzung) return []
    const s = sitzung
    const karte = new Map<string, Block>()
    for (const b of s.speicher.geloeschteListe()) karte.set(b.id, b)
    if (supabaseKonfiguriert()) {
      try {
        const grenze = new Date(Date.now() - 30 * 86_400_000).toISOString()
        const { data, error } = await supabase()
          .from('block')
          .select('*')
          .eq('user_id', s.userId)
          .not('geloescht_am', 'is', null)
          .gte('geloescht_am', grenze)
          .order('geloescht_am', { ascending: false })
          .limit(50)
        if (error) throw new Error(error.message)
        for (const z of (data ?? []) as DbZeile[]) {
          const b = vonZeile(z)
          if (!karte.has(b.id) && Date.parse(b.ende) > Date.parse(b.start)) karte.set(b.id, b)
        }
      } catch (e) {
        console.warn('Papierkorb aus der Datenbank:', e)
      }
    }
    return [...karte.values()].sort((a, b) => (b.geloeschtAm ?? '').localeCompare(a.geloeschtAm ?? '')).slice(0, 50)
  })
  ipcMain.handle('bloecke:wiederherstellen', async (_ereignis, id: string): Promise<Block | null> => {
    if (!sitzung) return null
    const s = sitzung
    let block = s.speicher.get(id)
    if (!block && supabaseKonfiguriert()) {
      const { data } = await supabase().from('block').select('*').eq('id', id).eq('user_id', s.userId).maybeSingle()
      if (data) {
        s.speicher.vomServerUebernehmen([vonZeile(data as DbZeile)])
        block = s.speicher.get(id)
      }
    }
    if (!block) return null
    if (block.geloeschtAm) {
      block.geloeschtAm = null
      s.speicher.aktualisieren(block)
      protokollNotiz(`Block ${id.slice(0, 8)} aus dem Papierkorb wiederhergestellt`)
      bloeckeGeaendert()
      statusVerteilen()
      auszeichnungenBaldPruefen(s)
    }
    return block
  })
  // Datenexport (15. September 2026): eigene Blöcke im Zeitraum; was älter als der lokale Vorrat ist, kommt aus der Datenbank.
  ipcMain.handle('bloecke:exportieren', async (_ereignis, von: string, bis: string): Promise<Block[]> => {
    if (!sitzung) return []
    const s = sitzung
    const karte = new Map<string, Block>()
    for (const b of s.speicher.imZeitraum(new Date(von), new Date(bis))) karte.set(b.id, b)
    const lokalAb = Date.now() - 13 * 7 * 86_400_000
    if (Date.parse(von) < lokalAb && supabaseKonfiguriert()) {
      let ab = 0
      for (;;) {
        const { data, error } = await supabase()
          .from('block')
          .select('*')
          .eq('user_id', s.userId)
          .is('geloescht_am', null)
          .gte('ende', von)
          .lt('start', bis)
          .order('start', { ascending: true })
          .range(ab, ab + 999)
        if (error) throw new Error('Export aus der Datenbank: ' + error.message)
        const zeilen = (data ?? []) as DbZeile[]
        for (const z of zeilen) {
          const b = vonZeile(z)
          if (!karte.has(b.id)) karte.set(b.id, b)
        }
        if (zeilen.length < 1000) break
        ab += 1000
      }
    }
    return [...karte.values()].filter((b) => Date.parse(b.ende) > Date.parse(b.start)).sort((a, b) => a.start.localeCompare(b.start))
  })
  ipcMain.handle('bloecke:mehrereAendern', (_ereignis, ids: string[], aenderung: BlockAenderung): number => {
    if (!sitzung) return 0
    let n = 0
    for (const id of ids) {
      if (sitzung.erfassung.laufendeId() === id) continue
      if (blockAendern(sitzung.speicher, sitzung.taetigkeiten, sitzung.kunden,id, aenderung)) n++
    }
    bloeckeGeaendert()
    statusVerteilen()
    return n
  })

  ipcMain.handle('regeln:liste', (): Regel[] => sitzung?.regelwerk.liste() ?? [])
  ipcMain.handle('regeln:anlegen', async (_ereignis, neu: NeueRegel): Promise<{ regel: Regel; neuBewertet: number }> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    const regel = await sitzung.regelwerk.anlegen({
      ...neu,
      taetigkeit: neu.taetigkeit ? sitzung.taetigkeiten.merken(neu.taetigkeit) || null : null
    })
    const neuBewertet = alleNeuBewerten(sitzung.speicher, sitzung.regelwerk.liste(), sitzung.userId)
    bloeckeGeaendert()
    statusVerteilen()
    return { regel, neuBewertet }
  })

  ipcMain.handle('regeln:aendern', async (_ereignis, id: string, aenderung: RegelAenderung): Promise<{ regel: Regel; neuBewertet: number }> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    const regel = await sitzung.regelwerk.aendern(id, {
      ...aenderung,
      taetigkeit:
        aenderung.taetigkeit === undefined
          ? undefined
          : aenderung.taetigkeit
            ? sitzung.taetigkeiten.merken(aenderung.taetigkeit) || null
            : null
    })
    const neuBewertet = alleNeuBewerten(sitzung.speicher, sitzung.regelwerk.liste(), sitzung.userId)
    bloeckeGeaendert()
    statusVerteilen()
    return { regel, neuBewertet }
  })
  ipcMain.handle('regeln:loeschen', async (_ereignis, id: string): Promise<number> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    await sitzung.regelwerk.loeschen(id)
    const neuBewertet = alleNeuBewerten(sitzung.speicher, sitzung.regelwerk.liste(), sitzung.userId)
    bloeckeGeaendert()
    statusVerteilen()
    return neuBewertet
  })

  ipcMain.handle('taetigkeiten:liste', (): string[] => sitzung?.taetigkeiten.liste() ?? [])
  ipcMain.handle('kunden:liste', (): string[] => sitzung?.kunden.liste() ?? [])
  // Kunden verwalten (Einstellungen → Kunden): wirkt über die Datenbankfunktionen aus Skript 15 auf das ganze Team.
  ipcMain.handle('kunden:umbenennen', async (_ereignis, alt: string, neu: string): Promise<number> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    const n = await sitzung.kunden.umbenennen(sitzung.speicher, alt, neu)
    bloeckeGeaendert()
    statusVerteilen()
    return n
  })
  ipcMain.handle('kunden:loeschen', async (_ereignis, name: string): Promise<number> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    const n = await sitzung.kunden.loeschen(sitzung.speicher, name)
    bloeckeGeaendert()
    statusVerteilen()
    return n
  })

  ipcMain.handle('taetigkeiten:unterwegs', (): Record<string, boolean> => sitzung?.taetigkeiten.unterwegs() ?? {})
  // Einordnung "unterwegs" (Dreh, Fahrt, Kundentermin ...) für das ganze Team; das Fenster lädt die Listen über bloecke:aenderung neu.
  ipcMain.handle('taetigkeiten:unterwegsSetzen', async (_ereignis, name: string, an: boolean): Promise<void> => {
    if (!sitzung) return
    await sitzung.taetigkeiten.unterwegsSetzen(name, an)
    bloeckeGeaendert()
  })
  // Tätigkeit umbenennen oder zusammenlegen, im ganzen Team (Skript 19); danach Regeln und Ziele neu laden, weil
  // die Datenbankfunktion auch dort den Namen tauscht.
  ipcMain.handle('taetigkeiten:umbenennen', async (_ereignis, alt: string, neu: string): Promise<number> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    const n = await sitzung.taetigkeiten.umbenennen(sitzung.speicher, alt, neu)
    await Promise.all([sitzung.regelwerk.laden().catch(() => false), sitzung.ziele.laden().catch(() => false)])
    bloeckeGeaendert()
    statusVerteilen()
    return n
  })
  // Kundenbericht als Datei (15. September 2026): Speichern-Dialog, Vorgabe im Dokumente-Ordner, UTF-8 mit BOM für Excel.
  ipcMain.handle('bericht:speichern', async (_ereignis, dateiname: string, inhalt: string): Promise<string | null> => {
    const sauber = dateiname.replace(/[^\wäöüÄÖÜß.\- ]/g, '_')
    const wahl = await dialog.showSaveDialog(fenster ?? undefined!, {
      title: 'Bericht speichern',
      defaultPath: join(app.getPath('documents'), sauber),
      filters: [{ name: 'CSV-Tabelle', extensions: ['csv'] }]
    })
    if (wahl.canceled || !wahl.filePath) return null
    writeFileSync(wahl.filePath, '﻿' + inhalt, 'utf8')
    return wahl.filePath
  })
  ipcMain.handle('taetigkeiten:symbole', (): Record<string, SymbolInfo> => sitzung?.taetigkeiten.symbole() ?? {})
  ipcMain.handle('taetigkeiten:symbolSetzen', async (_ereignis, name: string, symbol: SymbolInfo): Promise<void> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    await sitzung.taetigkeiten.symbolSetzen(name, symbol)
    bloeckeGeaendert()
  })

  ipcMain.handle('ziele:eigene', (): Ziel[] => sitzung?.ziele.eigene() ?? [])
  ipcMain.handle('ziele:alle', (): Ziel[] => sitzung?.ziele.alle() ?? [])
  ipcMain.handle('ziele:setzen', async (_ereignis, taetigkeit: string | null, stunden: number): Promise<Ziel> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    const name = taetigkeit ? sitzung.taetigkeiten.merken(taetigkeit) || null : null
    const ziel = await sitzung.ziele.setzen(name, stunden)
    bloeckeGeaendert()
    statusVerteilen()
    return ziel
  })
  ipcMain.handle('ziele:loeschen', async (_ereignis, id: string): Promise<void> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    await sitzung.ziele.loeschen(id)
    bloeckeGeaendert()
  })

  ipcMain.handle('auszeichnungen:liste', async (): Promise<Auszeichnung[]> => {
    if (!sitzung) return []
    if (sitzung.auszeichnungen.liste.length === 0) await sitzung.auszeichnungen.laden()
    return sitzung.auszeichnungen.liste
  })
  ipcMain.handle('rang:gefeiert', (_ereignis, r: number): void => {
    const wocheStart = berlinDatum(wochenanfang(new Date()))
    sitzung?.feier.feiern(wocheStart, r)
    // Team-Feed: Rang 5, 10, 15 und 20 sind eine Meldung wert.
    void sitzung?.spiel.rangMelden(r, rangName(r), wocheStart)
    statusVerteilen()
  })

  // Team-Spiel (22. September 2026): Boss der Woche, Season Pass, Duelle, Feed. Tabellen aus Skript 21.
  ipcMain.handle('spiel:stand', async (): Promise<SeasonStand | null> => (sitzung ? sitzung.spiel.stand() : null))
  ipcMain.handle('spiel:boss', async (): Promise<BossStand | null> => (sitzung ? sitzung.spiel.boss() : null))
  ipcMain.handle('spiel:bossHalle', async (): Promise<BossHalleEintrag[]> => (sitzung ? sitzung.spiel.bossHalle() : []))
  ipcMain.handle('spiel:duelle', async (): Promise<Duell[]> => (sitzung ? sitzung.spiel.duelle() : []))
  ipcMain.handle(
    'spiel:duellErstellen',
    async (_ereignis, anUser: string, art: DuellArt, taetigkeit: string | null, bisIso: string, einsatz: string): Promise<Duell> => {
      if (!sitzung) throw new Error('Nicht angemeldet.')
      return sitzung.spiel.duellErstellen(anUser, art, taetigkeit, bisIso, einsatz)
    }
  )
  ipcMain.handle('spiel:duellAntworten', async (_ereignis, id: string, annehmen: boolean): Promise<void> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    await sitzung.spiel.duellAntworten(id, annehmen)
  })
  ipcMain.handle('spiel:duellEinloesen', async (_ereignis, id: string): Promise<void> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    await sitzung.spiel.duellEinloesen(id)
  })
  ipcMain.handle('spiel:feed', async (): Promise<Ereignis[]> => (sitzung ? sitzung.spiel.feed() : []))
  ipcMain.handle('spiel:posten', async (_ereignis, typ: EreignisTyp, text: string, schluessel: string | null): Promise<boolean> =>
    sitzung ? sitzung.spiel.posten(typ, text, schluessel) : false
  )
  ipcMain.handle('spiel:reagieren', async (_ereignis, id: string, emoji: string): Promise<void> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    await sitzung.spiel.reagieren(id, emoji)
  })
  ipcMain.handle('spiel:kosmetikSetzen', async (_ereignis, k: Partial<Kosmetik>): Promise<Kosmetik> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    const neu = await sitzung.spiel.kosmetikSetzen(k)
    statusVerteilen()
    return neu
  })
  ipcMain.handle('spiel:pruefen', async (): Promise<void> => sitzung?.spiel.pruefen())

  ipcMain.handle('system:info', (): SystemInfo => ({
    version: app.getVersion(),
    plattform: process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux',
    gepackt: app.isPackaged,
    autostart: app.isPackaged ? autostartAn() : false,
    bildschirmrecht: bildschirmrecht()
  }))
  // Diagnose als Text für den Chat (Einstellungen → System → "Diagnose kopieren"): Stand von App, System, Erfassung,
  // Abgleich und die letzten Fehlerzeilen des Hauptprozesses. Keine Blockinhalte, keine Fenstertitel.
  ipcMain.handle('system:diagnose', (): string => {
    const jetzt = new Date()
    const z: string[] = []
    z.push(`wessamedia Zeit ${app.getVersion()} (${app.isPackaged ? 'installiert' : 'Entwicklung'})`)
    z.push(`System: ${process.platform} ${release()} · Electron ${process.versions.electron} · Node ${process.versions.node}`)
    z.push(`Zeit: ${jetzt.toISOString()} (${berlinDatum(jetzt)} ${berlinTeile(jetzt).stunde}:${String(berlinTeile(jetzt).minute).padStart(2, '0')} Berlin)`)
    z.push(`Autostart: ${app.isPackaged ? autostartAn() : 'nur installiert'} · Bildschirmaufnahme: ${bildschirmrecht()}`)
    z.push(`Datenbank konfiguriert: ${supabaseKonfiguriert()}`)
    z.push(`Protokolldatei: ${protokollPfad() ?? 'keine'}${wachhundWarnung ? ` · Wachhund: ${wachhundWarnung}` : ''}`)
    if (sitzung) {
      const s = sitzung
      const e = s.erfassung.status()
      const alle = s.speicher.alle()
      const heute = s.speicher.imZeitraum(tagesanfang(jetzt), naechsterTagesanfang(jetzt))
      z.push(`Konto: ${s.userId.slice(0, 8)}…`)
      z.push(`Erfassung: ${e.zustand}${e.laufenderBlock ? ` · läuft seit ${e.laufenderBlock.start} (${e.laufenderBlock.programm ?? '-'})` : ''}${e.fokus ? ` · Fokus ${e.fokus.taetigkeit}` : ''}${e.weg ? ` · Weg ${e.weg.taetigkeit}` : ''} · nur im Fokus: ${e.nurFokus ? 'ja' : 'nein'}`)
      z.push(`Untätigkeit ab ${s.erfassung.idleSchwelleSekunden} s · Fenstertitel speichern: ${s.erfassung.fenstertitelSpeichern}`)
      z.push(`Blöcke lokal: ${alle.length} (heute ${heute.length}, ungeklärt ${s.speicher.anzahlUngeklaert()}, offene Rückfragen ${e.offeneAbwesenheiten.length})`)
      z.push(`Abgleich: ${s.sync.letzterSync ? s.sync.letzterSync.toISOString() : 'noch keiner'} · wartend ${s.speicher.anzahlAusstehend()}${s.sync.fehler ? ` · Fehler: ${s.sync.fehler}` : ''}`)
      z.push(`Regeln: ${s.regelwerk.liste().length} · Tätigkeiten: ${s.taetigkeiten.liste().length}`)
    } else {
      z.push('Nicht angemeldet.')
    }
    const p = protokollZeilen()
    z.push(`Protokoll (${p.length} Zeilen):`)
    z.push(...(p.length ? p : ['(keine Fehler gemerkt)']))
    return z.join('\n')
  })
  // Mac: Berechtigung "Bildschirmaufnahme" anfragen (Systemabfrage) und die passende Seite der Systemeinstellungen öffnen.
  ipcMain.handle('system:bildschirmrechtAnfragen', async () => {
    const stand = await bildschirmrechtAnfragen()
    if (process.platform === 'darwin' && stand !== 'erteilt') {
      void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
    }
    return stand
  })
  ipcMain.handle('system:protokollOeffnen', (): string | null => {
    const pfad = protokollPfad()
    if (!pfad || !existsSync(pfad)) return null
    shell.showItemInFolder(pfad)
    return pfad
  })
  ipcMain.handle('system:neustart', (): void => appNeustarten())
  ipcMain.handle('system:autostartSetzen', (_ereignis, an: boolean): boolean => {
    if (!app.isPackaged) return false
    app.setLoginItemSettings({ openAtLogin: an, args: an ? ['--hidden'] : [] })
    return autostartAn()
  })

  ipcMain.handle('team:stand', async (): Promise<TeamMitglied[]> => {
    if (!sitzung) return []
    if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
    const jetzt = new Date()
    const von = wochenanfang(jetzt)
    const { data, error } = await supabase().rpc('team_stand', { von: von.toISOString(), bis: jetzt.toISOString() })
    if (error) throw new Error('Datenbank nicht erreichbar: ' + error.message)
    const zeilen = (data ?? []) as Array<{
      user_id: string
      name: string
      produktive_sekunden: number | string
      zuletzt_sync: string | null
    }>
    const eigeneId = sitzung.userId
    const eigeneSekunden = sitzung.speicher.produktiveSekunden(von, jetzt)
    return zeilen.map((z) => {
      const istIch = z.user_id === eigeneId
      return {
        userId: z.user_id,
        name: z.name,
        // Die eigenen Zahlen kommen live vom Rechner, die der anderen aus der Datenbank.
        produktiveSekunden: istIch ? eigeneSekunden : Number(z.produktive_sekunden),
        zuletztSync: istIch ? jetzt.toISOString() : z.zuletzt_sync ? new Date(z.zuletzt_sync).toISOString() : null,
        istIch
      }
    })
  })

  ipcMain.handle('liga:stand', async (): Promise<LigaStand[]> => {
    if (!sitzung) return []
    if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
    const { data, error } = await supabase().rpc('liga_stand')
    if (error) {
      if (/liga_stand/.test(error.message)) {
        throw new Error('Für die Liga muss in Supabase einmal das Skript 8 (08_liga.sql) ausgeführt werden.')
      }
      throw new Error('Datenbank nicht erreichbar: ' + error.message)
    }
    const eigeneId = sitzung.userId
    return (
      (data ?? []) as Array<{
        user_id: string
        name: string
        trophaeen: number
        wochen: number
        letzte_woche: string | null
        letztes_delta: number | null
        letztes_wirksam?: number | null
        im_urlaub?: boolean
      }>
    ).map((z) => ({
      userId: z.user_id,
      name: z.name,
      trophaeen: Number(z.trophaeen),
      wochen: Number(z.wochen),
      letzteWoche: z.letzte_woche,
      letztesDelta: z.letztes_delta === null ? null : Number(z.letztes_delta),
      letztesWirksam: z.letztes_wirksam === null || z.letztes_wirksam === undefined ? null : Number(z.letztes_wirksam),
      imUrlaub: z.im_urlaub === true,
      istIch: z.user_id === eigeneId
    }))
  })

  ipcMain.handle('urlaub:eigene', async (): Promise<Urlaub[]> => {
    if (!sitzung) return []
    return urlaubListe(sitzung.userId)
  })
  ipcMain.handle('urlaub:alle', async (): Promise<Urlaub[]> => {
    if (!sitzung) return []
    return alleUrlaube()
  })
  ipcMain.handle('urlaub:anlegen', async (_ereignis, von: string, bis: string, notiz: string | null): Promise<Urlaub> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    return urlaubAnlegen(sitzung.userId, von, bis, notiz)
  })
  ipcMain.handle('urlaub:loeschen', async (_ereignis, id: string): Promise<void> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    await urlaubLoeschen(id)
  })

  // Tätigkeiten der anderen (15. September 2026): Summen je Person, Tätigkeit und Kunde aus team_taetigkeiten (Skript 18);
  // die eigenen kommen live aus den lokalen Blöcken. Keine Programme, keine Fenstertitel.
  ipcMain.handle('team:taetigkeiten', async (_ereignis, vonIso: string, bisIso: string): Promise<TeamTaetigkeit[]> => {
    if (!sitzung) return []
    if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
    const von = new Date(vonIso)
    const bis = new Date(bisIso)
    const { data, error } = await supabase().rpc('team_taetigkeiten', { von: von.toISOString(), bis: bis.toISOString() })
    if (error) {
      if (/team_taetigkeiten/.test(error.message)) throw new Error('Dafür muss in Supabase einmal das Skript 18 (18_team_taetigkeiten.sql) ausgeführt werden.')
      throw new Error('Datenbank nicht erreichbar: ' + error.message)
    }
    const eigeneId = sitzung.userId
    const eigenerName = sitzung.profil.daten?.name ?? 'Ich'
    const fremde = ((data ?? []) as Array<{ user_id: string; name: string; taetigkeit: string | null; kunde: string | null; produktive_sekunden: number | string }>)
      .filter((z) => z.user_id !== eigeneId)
      .map((z) => ({ userId: z.user_id, name: z.name, taetigkeit: z.taetigkeit, kunde: z.kunde, produktiveSekunden: Number(z.produktive_sekunden) }))
    const eigene = new Map<string, TeamTaetigkeit>()
    for (const b of sitzung.speicher.imZeitraum(von, bis)) {
      if (b.bewertung !== 'produktiv' || b.geloeschtAm) continue
      const s = Math.max(Date.parse(b.start), von.getTime())
      const e = Math.min(Date.parse(b.ende), bis.getTime())
      if (e <= s) continue
      const schluessel = `${b.taetigkeit ?? ''}|${b.kunde ?? ''}`
      const z = eigene.get(schluessel) ?? { userId: eigeneId, name: eigenerName, taetigkeit: b.taetigkeit, kunde: b.kunde, produktiveSekunden: 0 }
      z.produktiveSekunden += (e - s) / 1000
      eigene.set(schluessel, z)
    }
    return [...fremde, ...eigene.values()]
  })
  ipcMain.handle('team:aktuell', async (): Promise<TeamAktuell[]> => {
    if (!sitzung) return []
    if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
    const { data, error } = await supabase().rpc('team_aktuell')
    if (error) {
      if (/team_aktuell/.test(error.message)) throw new Error('Dafür muss in Supabase einmal das Skript 18 (18_team_taetigkeiten.sql) ausgeführt werden.')
      throw new Error('Datenbank nicht erreichbar: ' + error.message)
    }
    const eigeneId = sitzung.userId
    const liste = ((data ?? []) as Array<{ user_id: string; name: string; taetigkeit: string | null; kunde: string | null; start: string; ende: string; bewertung: Bewertung }>)
      .filter((z) => z.user_id !== eigeneId)
      .map((z) => ({ userId: z.user_id, name: z.name, taetigkeit: z.taetigkeit, kunde: z.kunde, start: new Date(z.start).toISOString(), ende: new Date(z.ende).toISOString(), bewertung: z.bewertung }))
    // Eigener Stand live: der laufende Block, sonst der jüngste lokale Block der letzten 24 Stunden.
    const e = sitzung.erfassung.status()
    const jetzt = new Date()
    const eigenerName = sitzung.profil.daten?.name ?? 'Ich'
    if (e.laufenderBlock) {
      liste.push({ userId: eigeneId, name: eigenerName, taetigkeit: e.laufenderBlock.taetigkeit, kunde: e.fokus?.kunde ?? null, start: e.laufenderBlock.start, ende: jetzt.toISOString(), bewertung: e.laufenderBlock.bewertung })
    } else {
      const letzter = sitzung.speicher
        .imZeitraum(new Date(jetzt.getTime() - 86_400_000), jetzt)
        .filter((b) => !b.geloeschtAm)
        .sort((a, b) => b.ende.localeCompare(a.ende))[0]
      if (letzter) liste.push({ userId: eigeneId, name: eigenerName, taetigkeit: letzter.taetigkeit, kunde: letzter.kunde, start: letzter.start, ende: letzter.ende, bewertung: letzter.bewertung })
    }
    return liste
  })
  ipcMain.handle('team:wochen', async (_ereignis, vonDatum: string, bisDatum: string): Promise<TeamWoche[]> => {
    if (!sitzung) return []
    if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
    const { data, error } = await supabase().rpc('team_wochen', { von: vonDatum, bis: bisDatum })
    if (error) {
      if (/team_wochen/.test(error.message)) {
        throw new Error('Für den Team-Verlauf muss in Supabase einmal das Skript 6 (06_team.sql) ausgeführt werden.')
      }
      throw new Error('Datenbank nicht erreichbar: ' + error.message)
    }
    const jetzt = new Date()
    const laufendeWoche = berlinDatum(wochenanfang(jetzt))
    const eigeneSekunden = sitzung.speicher.produktiveSekunden(wochenanfang(jetzt), jetzt)
    const eigeneId = sitzung.userId
    return ((data ?? []) as Array<{ user_id: string; name: string; woche_start: string; produktive_sekunden: number | string }>).map(
      (z) => ({
        userId: z.user_id,
        name: z.name,
        wocheStart: z.woche_start,
        // Die laufende Woche der eigenen Person live vom Rechner.
        produktiveSekunden:
          z.user_id === eigeneId && z.woche_start === laufendeWoche ? eigeneSekunden : Number(z.produktive_sekunden)
      })
    )
  })

  ipcMain.handle('profil:eigenes', (): ProfilDaten | null => sitzung?.profil.daten ?? null)
  ipcMain.handle('profil:aendern', async (_ereignis, aenderung: Partial<ProfilDaten>): Promise<ProfilDaten> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    const neu = await sitzung.profil.aendern(aenderung)
    profilAnwenden(sitzung)
    return neu
  })
}

/**
 * Die fertige App schaltet beim allerersten Start den Autostart ein (mit dem Rechner, versteckt im Symbol).
 * Danach entscheidet allein der Schalter in den Einstellungen; eine Marke im Datenordner merkt sich das.
 */
function autostartEinrichten(): void {
  if (!app.isPackaged) return
  const marke = join(app.getPath('userData'), 'autostart-eingerichtet')
  if (existsSync(marke)) return
  app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] })
  try {
    writeFileSync(marke, new Date().toISOString())
  } catch (fehler) {
    console.error('Autostart-Marke:', fehler)
  }
}

void app.whenReady().then(async () => {
  electronApp.setAppUserModelId(APP_ID)
  protokollDateiFestlegen(app.getPath('userData'))
  protokollNotiz(`App gestartet: Version ${app.getVersion()}, ${process.platform}, ${app.isPackaged ? 'installiert' : 'Entwicklung'}`)

  // F12 öffnet die Entwicklerwerkzeuge, aber nur in der Entwicklungsversion.
  app.on('browser-window-created', (_, f) => optimizer.watchWindowShortcuts(f))

  authIpcRegistrieren({
    onAngemeldet: (userId) => sitzungStarten(userId),
    onAbgemeldet: () => sitzungBeenden()
  })
  ipcRegistrieren()

  tray = new TrayLeiste({
    oeffnen: fensterZeigen,
    pause: () => sitzung?.erfassung.pause(),
    fortsetzen: () => sitzung?.erfassung.fortsetzen(),
    fokusBeenden,
    fokusStarten: fokusDialogOeffnen,
    wegBeenden,
    beenden: () => {
      beendet = true
      app.quit()
    }
  })

  autostartEinrichten()
  fenster = fensterAnlegen()
  aktualisierungStarten(fenster, () => {
    beendet = true
    app.quit()
  })

  const status = await authStatus()
  if (status.angemeldet && status.userId) sitzungStarten(status.userId)
  statusVerteilen()

  // Ruhezustand und Sperren: laufenden Block sofort beenden, nach dem Aufwachen neu beginnen.
  powerMonitor.on('suspend', () => {
    schlaeft = true
    sitzung?.erfassung.unterbrechen()
  })
  powerMonitor.on('lock-screen', () => {
    schlaeft = true
    sitzung?.erfassung.unterbrechen()
  })
  powerMonitor.on('resume', () => {
    schlaeft = false
    aufgewachtMs = Date.now()
    sitzung?.erfassung.weiter()
  })
  powerMonitor.on('unlock-screen', () => {
    schlaeft = false
    aufgewachtMs = Date.now()
    sitzung?.erfassung.weiter()
  })
  powerMonitor.on('shutdown', () => {
    beendet = true
    sitzung?.speicher.speichern()
  })

  app.on('activate', fensterZeigen)
  app.on('second-instance', fensterZeigen)

  // Fokus von überall starten (15. September 2026): Strg+Alt+F, am Mac Cmd+Alt+F, auch wenn die App im Hintergrund ist.
  if (!globalShortcut.register('CommandOrControl+Alt+F', fokusDialogOeffnen)) console.warn('Tastenkürzel Strg/Cmd+Alt+F ist schon belegt')
})

// Alle Fenster zu heißt nicht Ende: die App läuft im Symbol weiter.
app.on('window-all-closed', () => {
  /* bewusst leer */
})

// Auf dem Mac versteckt Cmd+Q nur das Fenster. Beenden geht über das Symbol-Menü.
app.on('before-quit', (ereignis) => {
  if (!beendet && process.platform === 'darwin') {
    ereignis.preventDefault()
    fenster?.hide()
    app.dock?.hide()
    return
  }
  beendet = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  sitzungBeenden()
  protokollNotiz('App beendet')
})
