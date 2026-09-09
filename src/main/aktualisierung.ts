import { app, ipcMain, shell, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '@shared/typen'

/*
 * Automatische Updates über die GitHub-Veröffentlichungen ("Releases") des Repositorys.
 *   Windows: electron-updater lädt den neuen Installer im Hintergrund (latest.yml + .exe + .blockmap
 *            aus der Veröffentlichung) und installiert ihn beim nächsten Neustart der App.
 *   Mac:     ohne Apple-Signatur kann sich die App nicht selbst ersetzen. Deshalb nur prüfen
 *            (GitHub-API "releases/latest") und auf Wunsch die Download-Seite öffnen.
 * Geprüft wird 30 s nach dem Start und danach alle 4 Stunden, außerdem auf Knopfdruck in den
 * Einstellungen. In der Entwicklungsversion passiert nichts.
 */

export const REPO_BESITZER = 'Moritzrx'
export const REPO_NAME = 'zeiterfassung'
const RELEASE_SEITE = `https://github.com/${REPO_BESITZER}/${REPO_NAME}/releases/latest`
const RELEASE_API = `https://api.github.com/repos/${REPO_BESITZER}/${REPO_NAME}/releases/latest`
const ERSTE_PRUEFUNG_MS = 30_000
const PRUEF_ABSTAND_MS = 4 * 60 * 60_000

const istMac = process.platform === 'darwin'

let fenster: BrowserWindow | null = null
let status: UpdateStatus = {
  aktuelleVersion: app.getVersion(),
  zustand: app.isPackaged ? 'unbekannt' : 'entwicklung',
  neueVersion: null,
  prozent: null,
  fehler: null,
  zuletztGeprueft: null,
  selbstInstallierend: !istMac
}

function melden(aenderung: Partial<UpdateStatus>): void {
  status = { ...status, ...aenderung }
  if (fenster && !fenster.isDestroyed()) fenster.webContents.send('update:status', status)
}

/** Kurzer, verständlicher Text statt des seitenlangen Fehlers von electron-updater (mit allen Kopfzeilen). */
function fehlerText(e: unknown): string {
  const roh = e instanceof Error ? e.message : String(e)
  if (/404/.test(roh)) return 'Auf GitHub gibt es noch keine Veröffentlichung für die App'
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::|fetch failed|EAI_AGAIN/i.test(roh)) return 'Keine Verbindung zu GitHub'
  const erste = roh.split('\n')[0].trim()
  return erste.length > 120 ? erste.slice(0, 117) + '…' : erste
}

/** "1.2.10" > "1.2.9": Versionsnummern zahlenweise vergleichen. */
function neuer(a: string, b: string): boolean {
  const x = a.replace(/^v/, '').split('.').map(Number)
  const y = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

/** Mac: nur nachsehen, ob es eine neuere Veröffentlichung gibt. */
async function macPruefen(): Promise<void> {
  melden({ zustand: 'prueft', fehler: null })
  try {
    const antwort = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
    if (!antwort.ok) throw new Error(`GitHub antwortet mit ${antwort.status}`)
    const daten = (await antwort.json()) as { tag_name?: string }
    const version = (daten.tag_name ?? '').replace(/^v/, '')
    const jetzt = new Date().toISOString()
    if (version && neuer(version, status.aktuelleVersion)) melden({ zustand: 'verfuegbar', neueVersion: version, zuletztGeprueft: jetzt })
    else melden({ zustand: 'aktuell', neueVersion: null, zuletztGeprueft: jetzt })
  } catch (e) {
    melden({ zustand: 'fehler', fehler: fehlerText(e), zuletztGeprueft: new Date().toISOString() })
  }
}

async function pruefen(): Promise<void> {
  if (!app.isPackaged) return
  if (istMac) return macPruefen()
  if (status.zustand === 'laedt' || status.zustand === 'bereit') return
  melden({ zustand: 'prueft', fehler: null })
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    melden({ zustand: 'fehler', fehler: fehlerText(e), zuletztGeprueft: new Date().toISOString() })
  }
}

function installieren(): void {
  if (istMac || !status.selbstInstallierend) {
    void shell.openExternal(RELEASE_SEITE)
    return
  }
  if (status.zustand === 'bereit') autoUpdater.quitAndInstall(false, true)
}

/** Einmal beim Start aufrufen; registriert die IPC-Kanäle und startet die regelmäßige Prüfung. */
export function aktualisierungStarten(hauptfenster: BrowserWindow): void {
  fenster = hauptfenster
  ipcMain.handle('update:status', (): UpdateStatus => status)
  ipcMain.handle('update:pruefen', async (): Promise<UpdateStatus> => {
    await pruefen()
    return status
  })
  ipcMain.handle('update:installieren', (): void => installieren())

  if (!app.isPackaged) return

  if (!istMac) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.on('checking-for-update', () => melden({ zustand: 'prueft', fehler: null }))
    autoUpdater.on('update-available', (info) => melden({ zustand: 'laedt', neueVersion: info.version, prozent: 0, zuletztGeprueft: new Date().toISOString() }))
    autoUpdater.on('update-not-available', () => melden({ zustand: 'aktuell', neueVersion: null, zuletztGeprueft: new Date().toISOString() }))
    autoUpdater.on('download-progress', (p) => melden({ zustand: 'laedt', prozent: Math.round(p.percent) }))
    autoUpdater.on('update-downloaded', (info) => melden({ zustand: 'bereit', neueVersion: info.version, prozent: 100 }))
    autoUpdater.on('error', (e) => melden({ zustand: 'fehler', fehler: fehlerText(e), zuletztGeprueft: new Date().toISOString() }))
  }

  setTimeout(() => void pruefen(), ERSTE_PRUEFUNG_MS)
  setInterval(() => void pruefen(), PRUEF_ABSTAND_MS)
}
