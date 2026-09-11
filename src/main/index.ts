import { app, BrowserWindow, ipcMain, Notification, powerMonitor, shell } from 'electron'
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
  TeamMitglied,
  TeamWoche,
  Ziel,
  Abwesenheit
} from '@shared/typen'
import { rang, rangName } from '@shared/rang'
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
import { protokollEinrichten, protokollZeilen } from './protokoll'
import { release } from 'os'
import { Feier } from './feier'
import { Profil } from './profil'
import { fokusRueckwirkend } from './fokus'
import { istFehlblock } from './programme'
import { Regelwerk } from './regelwerk'
import { Speicher } from './speicher'
import { supabase, supabaseKonfiguriert } from './supabase'
import { Sync } from './sync'
import { Taetigkeiten } from './taetigkeiten'
import { Kunden } from './kunden'
import { TrayLeiste } from './tray'
import { alleUrlaube, urlaubAnlegen, urlaubListe, urlaubLoeschen } from './urlaub'
import { Ziele } from './ziele'

const APP_ID = 'com.wessamedia.zeit'
const HINTERGRUND = '#0B0B0C'
const REGELN_TAKT_MS = 5 * 60_000

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
  regelTimer: NodeJS.Timeout
  auszeichnungTimer: NodeJS.Timeout
  minutenTimer: NodeJS.Timeout
  pruefungAusstehend: NodeJS.Timeout | null
}

let fenster: BrowserWindow | null = null
let tray: TrayLeiste | null = null
let sitzung: Sitzung | null = null
let beendet = false

// Nur eine laufende App pro Rechner. Ein zweiter Start zeigt nur das Fenster.
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

function versteckterStart(): boolean {
  if (process.argv.includes('--hidden')) return true
  return process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin
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
      heuteProduktivSekunden: 0,
      wocheProduktivSekunden: 0,
      rang: 0,
      neuerRang: null,
      unsynchronisiert: 0,
      letzterSync: null,
      syncFehler: null
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
    heuteProduktivSekunden: heute,
    wocheProduktivSekunden: woche,
    rang: aktuellerRang,
    neuerRang: aktuellerRang >= 1 && aktuellerRang > gefeiert ? aktuellerRang : null,
    unsynchronisiert: speicher.anzahlAusstehend(),
    letzterSync: sync.letzterSync?.toISOString() ?? null,
    syncFehler: sync.fehler
  }
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
    weg: status.weg?.taetigkeit ?? null
  })
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
    regelTimer: setInterval(() => void regelnAktualisieren(s), REGELN_TAKT_MS),
    auszeichnungTimer: setInterval(() => void auszeichnungenPruefen(s), 10 * 60_000),
    minutenTimer: setInterval(() => sonntagsMeldung(s), 60_000),
    pruefungAusstehend: null
  }
  sitzung = s
  profilAnwenden(s)
  erfassung.on('status', statusVerteilen)
  erfassung.on('abwesenheit', (a: Abwesenheit) => abwesenheitMelden(a))
  erfassung.on('bloecke', () => {
    // Sobald ein Block endet, können kurze Wechsel davor ihre Nachbarn erben.
    alleNeuBewerten(s.speicher, s.regelwerk.liste(), s.userId)
    bloeckeGeaendert()
    auszeichnungenBaldPruefen(s)
  })
  erfassung.start()
  sync.start()
  // Auszeichnungen erst prüfen, wenn Regeln und der erste Abgleich da sind, sonst zählen veraltete Blöcke mit.
  void Promise.all([regelnAktualisieren(s), sync.erstAbgleich]).then(() => auszeichnungenPruefen(s))
  void taetigkeiten.laden()
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
  if (alt.pruefungAusstehend) clearTimeout(alt.pruefungAusstehend)
  alt.erfassung.stop()
  alt.sync.stop()
  alt.speicher.speichern()
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
    bloeckeGeaendert()
    statusVerteilen()
    auszeichnungenBaldPruefen(sitzung)
  })
  ipcMain.handle('fokus:beenden', () => fokusBeenden())

  // "Ich bin weg": ab dem Beginn (bis drei Stunden zurück) ein produktiver Hand-Block bis zur Rückkehr.
  ipcMain.handle('weg:starten', (_ereignis, taetigkeit: string, beginnIso: string, kundeName: string | null = null): void => {
    if (!sitzung) return
    const name = sitzung.taetigkeiten.merken(taetigkeit)
    if (!name) throw new Error('Bitte eine Tätigkeit angeben.')
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
    eintragAnlegen(sitzung.speicher, sitzung.taetigkeiten, sitzung.kunden, sitzung.userId,{ start: bloecke[0].start, ende: bloecke[0].ende, taetigkeit, notiz })
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
    sitzung?.feier.feiern(berlinDatum(wochenanfang(new Date())), r)
    statusVerteilen()
  })

  ipcMain.handle('system:info', (): SystemInfo => ({
    version: app.getVersion(),
    plattform: process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux',
    gepackt: app.isPackaged,
    autostart: app.isPackaged ? app.getLoginItemSettings().openAtLogin : false,
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
    z.push(`Autostart: ${app.isPackaged ? app.getLoginItemSettings().openAtLogin : 'nur installiert'} · Bildschirmaufnahme: ${bildschirmrecht()}`)
    z.push(`Datenbank konfiguriert: ${supabaseKonfiguriert()}`)
    if (sitzung) {
      const s = sitzung
      const e = s.erfassung.status()
      const alle = s.speicher.alle()
      const heute = s.speicher.imZeitraum(tagesanfang(jetzt), naechsterTagesanfang(jetzt))
      z.push(`Konto: ${s.userId.slice(0, 8)}…`)
      z.push(`Erfassung: ${e.zustand}${e.laufenderBlock ? ` · läuft seit ${e.laufenderBlock.start} (${e.laufenderBlock.programm ?? '-'})` : ''}${e.fokus ? ` · Fokus ${e.fokus.taetigkeit}` : ''}${e.weg ? ` · Weg ${e.weg.taetigkeit}` : ''}`)
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
  ipcMain.handle('system:autostartSetzen', (_ereignis, an: boolean): boolean => {
    if (!app.isPackaged) return false
    app.setLoginItemSettings({ openAtLogin: an, args: an ? ['--hidden'] : [] })
    return app.getLoginItemSettings().openAtLogin
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
    wegBeenden,
    beenden: () => {
      beendet = true
      app.quit()
    }
  })

  autostartEinrichten()
  fenster = fensterAnlegen()
  aktualisierungStarten(fenster)

  const status = await authStatus()
  if (status.angemeldet && status.userId) sitzungStarten(status.userId)
  statusVerteilen()

  // Ruhezustand und Sperren: laufenden Block sofort beenden, nach dem Aufwachen neu beginnen.
  powerMonitor.on('suspend', () => sitzung?.erfassung.unterbrechen())
  powerMonitor.on('lock-screen', () => sitzung?.erfassung.unterbrechen())
  powerMonitor.on('resume', () => sitzung?.erfassung.weiter())
  powerMonitor.on('unlock-screen', () => sitzung?.erfassung.weiter())
  powerMonitor.on('shutdown', () => {
    beendet = true
    sitzung?.speicher.speichern()
  })

  app.on('activate', fensterZeigen)
  app.on('second-instance', fensterZeigen)
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
  sitzungBeenden()
})
