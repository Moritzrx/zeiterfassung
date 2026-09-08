import { app, BrowserWindow, ipcMain, powerMonitor, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { Block, ErfassungsStatus } from '@shared/typen'
import { datumZuTagesanfang, naechsterTagesanfang, tagesanfang, wochenanfang } from '@shared/zeit'
import { authIpcRegistrieren, authStatus } from './auth'
import { Erfassung } from './erfassung'
import { Speicher } from './speicher'
import { Sync } from './sync'
import { TrayLeiste } from './tray'

const APP_ID = 'com.wessamedia.zeit'
const HINTERGRUND = '#0B0B0C'
const SEKUNDEN_PRO_LEVEL = 5 * 3600

interface Sitzung {
  userId: string
  speicher: Speicher
  erfassung: Erfassung
  sync: Sync
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

function sitzungStarten(userId: string): void {
  if (sitzung?.userId === userId) return
  sitzungBeenden()
  const speicher = new Speicher(userId)
  speicher.aufraeumen()
  const erfassung = new Erfassung(speicher, userId)
  const sync = new Sync(speicher, userId)
  sitzung = { userId, speicher, erfassung, sync }
  erfassung.on('status', statusVerteilen)
  erfassung.on('bloecke', bloeckeGeaendert)
  erfassung.start()
  sync.start()
  statusVerteilen()
}

function sitzungBeenden(): void {
  if (!sitzung) return
  const alt = sitzung
  sitzung = null
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
