import { app, BrowserWindow, ipcMain, powerMonitor, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type {
  Block,
  BlockAenderung,
  ErfassungsStatus,
  NeueRegel,
  NeuerEintrag,
  Profil as ProfilDaten,
  Regel,
  SymbolInfo,
  Ziel
} from '@shared/typen'
import { regelnAnwenden } from '@shared/regeln'
import { datumZuTagesanfang, naechsterTagesanfang, tagesanfang, wochenanfang } from '@shared/zeit'
import { authIpcRegistrieren, authStatus } from './auth'
import { blockAendern, eintragAnlegen } from './bearbeiten'
import { alleNeuBewerten } from './bewertung'
import { Erfassung } from './erfassung'
import { Profil } from './profil'
import { istSystemUeberlagerung } from './programme'
import { Regelwerk } from './regelwerk'
import { Speicher } from './speicher'
import { Sync } from './sync'
import { Taetigkeiten } from './taetigkeiten'
import { TrayLeiste } from './tray'
import { Ziele } from './ziele'

const APP_ID = 'com.wessamedia.zeit'
const HINTERGRUND = '#0B0B0C'
const SEKUNDEN_PRO_LEVEL = 5 * 3600
const REGELN_TAKT_MS = 5 * 60_000

interface Sitzung {
  userId: string
  speicher: Speicher
  erfassung: Erfassung
  sync: Sync
  regelwerk: Regelwerk
  taetigkeiten: Taetigkeiten
  ziele: Ziele
  profil: Profil
  regelTimer: NodeJS.Timeout
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
      heuteProduktivSekunden: 0,
      wocheProduktivSekunden: 0,
      level: 0,
      unsynchronisiert: 0,
      letzterSync: null,
      syncFehler: null
    }
  }
  const jetzt = new Date()
  const { speicher, erfassung, sync } = sitzung
  const heute = speicher.produktiveSekunden(tagesanfang(jetzt), naechsterTagesanfang(jetzt))
  const woche = speicher.produktiveSekunden(wochenanfang(jetzt), jetzt)
  const e = erfassung.status()
  return {
    zustand: e.zustand,
    laufenderBlock: e.laufenderBlock,
    inaktivSeit: e.inaktivSeit,
    pausiertSeit: e.pausiertSeit,
    heuteProduktivSekunden: heute,
    wocheProduktivSekunden: woche,
    level: Math.floor(woche / SEKUNDEN_PRO_LEVEL),
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
    level: status.level,
    pausiert: status.zustand === 'pausiert'
  })
}

function bloeckeGeaendert(): void {
  if (fenster && !fenster.isDestroyed()) fenster.webContents.send('bloecke:aenderung')
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
  const ziele = new Ziele(userId)
  const profil = new Profil(userId)
  taetigkeiten.ausBloecken(speicher.alle())
  const erfassung = new Erfassung(speicher, userId, (programm, titel) =>
    regelnAnwenden(programm, titel, regelwerk.liste(), userId)
  )
  const fehlbloecke = speicher.fehlbloeckeAusblenden(istSystemUeberlagerung)
  if (fehlbloecke) console.log(`Speicher: ${fehlbloecke} Blöcke von Systemfenstern ausgeblendet`)
  const sync = new Sync(speicher, userId, () => {
    // Aus der Datenbank geholte Blöcke nach den aktuellen Regeln bewerten.
    speicher.fehlbloeckeAusblenden(istSystemUeberlagerung)
    taetigkeiten.ausBloecken(speicher.alle())
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
    ziele,
    profil,
    regelTimer: setInterval(() => void regelnAktualisieren(s), REGELN_TAKT_MS)
  }
  sitzung = s
  profilAnwenden(s)
  erfassung.on('status', statusVerteilen)
  erfassung.on('bloecke', bloeckeGeaendert)
  erfassung.start()
  sync.start()
  void regelnAktualisieren(s)
  void taetigkeiten.laden()
  statusVerteilen()
}

function sitzungBeenden(): void {
  if (!sitzung) return
  const alt = sitzung
  sitzung = null
  clearInterval(alt.regelTimer)
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
  ipcMain.handle('bloecke:manuellAnlegen', (_ereignis, eintrag: NeuerEintrag): Block => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    const block = eintragAnlegen(sitzung.speicher, sitzung.taetigkeiten, sitzung.userId, eintrag)
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
    const block = blockAendern(sitzung.speicher, sitzung.taetigkeiten, id, aenderung)
    bloeckeGeaendert()
    statusVerteilen()
    return block
  })
  ipcMain.handle('bloecke:mehrereAendern', (_ereignis, ids: string[], aenderung: BlockAenderung): number => {
    if (!sitzung) return 0
    let n = 0
    for (const id of ids) {
      if (sitzung.erfassung.laufendeId() === id) continue
      if (blockAendern(sitzung.speicher, sitzung.taetigkeiten, id, aenderung)) n++
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

  ipcMain.handle('taetigkeiten:liste', (): string[] => sitzung?.taetigkeiten.liste() ?? [])

  ipcMain.handle('taetigkeiten:symbole', (): Record<string, SymbolInfo> => sitzung?.taetigkeiten.symbole() ?? {})
  ipcMain.handle('taetigkeiten:symbolSetzen', async (_ereignis, name: string, symbol: SymbolInfo): Promise<void> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    await sitzung.taetigkeiten.symbolSetzen(name, symbol)
    bloeckeGeaendert()
  })

  ipcMain.handle('ziele:eigene', (): Ziel[] => sitzung?.ziele.eigene() ?? [])
  ipcMain.handle('ziele:alle', (): Ziel[] => sitzung?.ziele.alle() ?? [])

  ipcMain.handle('profil:eigenes', (): ProfilDaten | null => sitzung?.profil.daten ?? null)
  ipcMain.handle('profil:aendern', async (_ereignis, aenderung: Partial<ProfilDaten>): Promise<ProfilDaten> => {
    if (!sitzung) throw new Error('Nicht angemeldet.')
    const neu = await sitzung.profil.aendern(aenderung)
    profilAnwenden(sitzung)
    return neu
  })
}

/** In der fertigen App startet sie mit dem Rechner, versteckt im Symbol. */
function autostartEinrichten(): void {
  if (!app.isPackaged) return
  if (!app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] })
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
    beenden: () => {
      beendet = true
      app.quit()
    }
  })

  autostartEinrichten()
  fenster = fensterAnlegen()

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
