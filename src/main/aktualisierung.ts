import { app, ipcMain, shell, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { execFile, spawn } from 'child_process'
import { accessSync, constants, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'fs'
import { homedir } from 'os'
import { basename, dirname, join, resolve } from 'path'
import { promisify } from 'util'
import type { UpdateStatus } from '@shared/typen'

/*
 * Automatische Updates über die GitHub-Veröffentlichungen ("Releases") des Repositorys.
 *   Windows: electron-updater lädt den neuen Installer im Hintergrund (latest.yml + .exe + .blockmap
 *            aus der Veröffentlichung) und installiert ihn beim nächsten Neustart der App.
 *   Mac:     ohne Apple-Signatur darf electron-updater nichts tun. Seit 14. September 2026 (Auftraggeber:
 *            "Updates, ohne dass die Jungs jedes Mal neu herunterladen müssen") macht die App es selbst:
 *            neue Version über die GitHub-API finden, die .dmg im Hintergrund in den Temp-Ordner laden,
 *            auf Knopfdruck das Abbild einhängen (hdiutil), die App daneben in den Programme-Ordner
 *            kopieren (ditto), die alte Fassung in den Papierkorb legen, die neue an ihren Platz
 *            umbenennen und neu starten. Selbst geladene Dateien tragen kein Quarantäne-Merkmal, darum
 *            fragt Gatekeeper danach nicht erneut. Geht nur, wenn die App in einem beschreibbaren Ordner
 *            liegt (nicht vom dmg gestartet, nicht von macOS verschoben); sonst wie bisher Download-Seite.
 * Geprüft wird 30 s nach dem Start und danach alle 4 Stunden, außerdem auf Knopfdruck in den
 * Einstellungen. In der Entwicklungsversion passiert nichts.
 */

export const REPO_BESITZER = 'Moritzrx'
export const REPO_NAME = 'zeiterfassung'
const RELEASE_SEITE = `https://github.com/${REPO_BESITZER}/${REPO_NAME}/releases/latest`
const RELEASE_API = `https://api.github.com/repos/${REPO_BESITZER}/${REPO_NAME}/releases/latest`
const ERSTE_PRUEFUNG_MS = 30_000
/** Alle 30 Minuten (bis 22. September 2026 alle 4 Stunden), dazu beim Öffnen des Fensters, damit ein Update sofort auffällt. */
const PRUEF_ABSTAND_MS = 30 * 60_000
/** Beim Öffnen des Fensters nur prüfen, wenn die letzte Prüfung älter ist. */
const FENSTER_PRUEF_ABSTAND_MS = 10 * 60_000

const istMac = process.platform === 'darwin'
const ausfuehren = promisify(execFile)

let fenster: BrowserWindow | null = null
/** Beendet die App wirklich (auf dem Mac versteckt Cmd+Q nur das Fenster); kommt aus index.ts. */
let wirklichBeenden: () => void = () => app.quit()
let status: UpdateStatus = {
  aktuelleVersion: app.getVersion(),
  zustand: app.isPackaged ? 'unbekannt' : 'entwicklung',
  neueVersion: null,
  prozent: null,
  fehler: null,
  zuletztGeprueft: null,
  neuigkeiten: null,
  selbstInstallierend: !istMac
}

interface MacVeroeffentlichung {
  version: string
  dmgUrl: string
  groesse: number
  /** Beschreibung der Veröffentlichung (Änderungsliste), gekürzt */
  notizen: string | null
}

/**
 * Die Beschreibung einer Veröffentlichung als kurzen Klartext für die Update-Leiste (15. September 2026, "die Jungs
 * sollen sehen, was das Update beinhaltet"): electron-updater liefert sie unter Windows als HTML (GitHub-Atom-Feed),
 * die GitHub-API auf dem Mac als Markdown. Überschrift weg, Aufzählungszeichen vereinheitlicht, höchstens 8 Zeilen.
 */
export function notizenKuerzen(roh: unknown): string | null {
  let text: string
  if (typeof roh === 'string') text = roh
  else if (Array.isArray(roh)) text = roh.map((n) => (n && typeof n === 'object' && 'note' in n ? String((n as { note: unknown }).note ?? '') : '')).join('\n')
  else return null
  const zeilen = text
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((z) => z.replace(/^\s*(#+\s*|\*\s+|•\s*)/, (t) => (t.trim().startsWith('#') ? '' : '- ')).trim())
    .filter((z) => z && !/^##?\s*Version/i.test(z) && !/^Version \d/.test(z))
  if (zeilen.length === 0) return null
  return zeilen.slice(0, 8).join('\n').slice(0, 900)
}

/** Die zuletzt gefundene Mac-Veröffentlichung und der Pfad der fertig geladenen .dmg. */
let macNeu: MacVeroeffentlichung | null = null
let macDmg: string | null = null

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

/** Der .app-Ordner dieser App (…/wessamedia Zeit.app/Contents/MacOS/wessamedia Zeit → drei Stufen hoch). */
function macBundle(): string | null {
  const b = resolve(process.execPath, '..', '..', '..')
  return b.endsWith('.app') ? b : null
}

/**
 * Ob die App sich selbst ersetzen kann: ein echter .app-Ordner, nicht von macOS an einen Zufallsort verschoben
 * (App Translocation nach dem ersten Start aus dem Download-Ordner), nicht direkt vom eingehängten dmg gestartet,
 * und der Ordner darüber (meist Programme) ist beschreibbar.
 */
function macSelbstInstallierend(): boolean {
  const b = macBundle()
  if (!b || b.includes('/AppTranslocation/') || b.startsWith('/Volumes/')) return false
  try {
    accessSync(dirname(b), constants.W_OK)
    return true
  } catch {
    return false
  }
}

/** Mac: die neueste Veröffentlichung mit ihrer .dmg aus der GitHub-API holen. */
async function macVeroeffentlichung(): Promise<MacVeroeffentlichung | null> {
  const antwort = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
  if (!antwort.ok) throw new Error(`GitHub antwortet mit ${antwort.status}`)
  const daten = (await antwort.json()) as { tag_name?: string; body?: string | null; assets?: Array<{ name: string; size: number; browser_download_url: string }> }
  const version = (daten.tag_name ?? '').replace(/^v/, '')
  const dmg = (daten.assets ?? []).find((a) => /-Mac\.dmg$/i.test(a.name))
  if (!version || !dmg) return null
  return { version, dmgUrl: dmg.browser_download_url, groesse: dmg.size, notizen: notizenKuerzen(daten.body) }
}

/** Mac: die .dmg in den Temp-Ordner laden (mit Fortschritt); eine schon vollständige Datei wird wiederverwendet. */
async function macLaden(v: MacVeroeffentlichung): Promise<string> {
  const ordner = join(app.getPath('temp'), 'wessamedia-zeit-update')
  mkdirSync(ordner, { recursive: true })
  const ziel = join(ordner, `wessamedia-Zeit-${v.version}-Mac.dmg`)
  if (existsSync(ziel) && statSync(ziel).size === v.groesse) return ziel
  const antwort = await fetch(v.dmgUrl)
  if (!antwort.ok || !antwort.body) throw new Error(`Download antwortet mit ${antwort.status}`)
  const gesamt = Number(antwort.headers.get('content-length')) || v.groesse
  const teil = ziel + '.teil'
  const datei = createWriteStream(teil)
  let geladen = 0
  let zuletzt = -1
  for await (const stueck of antwort.body as unknown as AsyncIterable<Uint8Array>) {
    if (!datei.write(stueck)) await new Promise<void>((weiter) => datei.once('drain', () => weiter()))
    geladen += stueck.length
    const prozent = gesamt ? Math.min(99, Math.floor((geladen / gesamt) * 100)) : 0
    if (prozent !== zuletzt) {
      zuletzt = prozent
      melden({ zustand: 'laedt', prozent })
    }
  }
  await new Promise<void>((fertig, fehler) => {
    datei.on('finish', () => fertig())
    datei.on('error', fehler)
    datei.end()
  })
  if (v.groesse && statSync(teil).size !== v.groesse) throw new Error('Download unvollständig')
  renameSync(teil, ziel)
  return ziel
}

/** Mac: Abbild einhängen, App daneben kopieren, alte in den Papierkorb, neue an ihren Platz, neu starten. */
async function macInstallieren(dmg: string, version: string): Promise<void> {
  const bundle = macBundle()
  if (!bundle || !macSelbstInstallierend()) throw new Error('Die App kann sich an diesem Ort nicht selbst ersetzen')
  const eltern = dirname(bundle)
  const name = basename(bundle)
  const kurz = name.replace(/\.app$/, '')
  const einhaengepunkt = join(app.getPath('temp'), `wessamedia-zeit-dmg-${process.pid}`)
  const neu = join(eltern, `${kurz} ${version}.neu.app`)
  rmSync(neu, { recursive: true, force: true })
  mkdirSync(einhaengepunkt, { recursive: true })
  await ausfuehren('hdiutil', ['attach', '-nobrowse', '-readonly', '-noautoopen', '-quiet', '-mountpoint', einhaengepunkt, dmg])
  try {
    const quelle = join(einhaengepunkt, name)
    if (!existsSync(quelle)) throw new Error('Im Abbild fehlt die App')
    await ausfuehren('ditto', [quelle, neu])
  } finally {
    await ausfuehren('hdiutil', ['detach', einhaengepunkt, '-force']).catch(() => undefined)
  }
  // Sicherheitshalber jedes Quarantäne-Merkmal entfernen, sonst fragt Gatekeeper beim Start erneut.
  await ausfuehren('xattr', ['-cr', neu]).catch(() => undefined)
  rmSync(dmg, { force: true })
  // Neustart vormerken, solange die alte Programmdatei noch an ihrem Platz liegt: Electron startet dafür sofort einen
  // kleinen Helfer aus der laufenden App, der auf das Ende dieser Instanz wartet und dann die neue Programmdatei öffnet.
  app.relaunch({ execPath: join(bundle, 'Contents', 'MacOS', kurz), args: [] })
  // Alte Fassung in den Papierkorb (klappt das nicht, in den Temp-Ordner), neue an ihren Platz.
  let alt = join(homedir(), '.Trash', `${kurz} ${status.aktuelleVersion} alt.app`)
  try {
    rmSync(alt, { recursive: true, force: true })
    renameSync(bundle, alt)
  } catch {
    alt = join(app.getPath('temp'), `${kurz} ${status.aktuelleVersion} alt.app`)
    rmSync(alt, { recursive: true, force: true })
    renameSync(bundle, alt)
  }
  try {
    renameSync(neu, bundle)
  } catch (e) {
    renameSync(alt, bundle)
    throw e
  }
  // Zweiter Weg zur Sicherheit: Ein losgelöstes Shell-Skript wartet bis zu 20 s, bis diese Instanz weg ist
  // (Einzelinstanz-Sperre: eine zu früh gestartete zweite Instanz meldet sich nur bei der alten und beendet sich),
  // und öffnet dann die neue App. Läuft sie durch den Helfer schon, holt das nur das Fenster nach vorn.
  const skript = `i=0; while pgrep -x "${kurz}" >/dev/null 2>&1 && [ $i -lt 20 ]; do sleep 1; i=$((i+1)); done; sleep 2; open -a "${bundle}"`
  const kind = spawn('/bin/sh', ['-c', skript], { detached: true, stdio: 'ignore' })
  kind.unref()
  wirklichBeenden()
}

/** Mac: nachsehen, ob es eine neuere Veröffentlichung gibt, und sie gleich im Hintergrund laden. */
async function macPruefen(): Promise<void> {
  melden({ zustand: 'prueft', fehler: null })
  try {
    const v = await macVeroeffentlichung()
    const jetzt = new Date().toISOString()
    if (!v || !neuer(v.version, status.aktuelleVersion)) {
      melden({ zustand: 'aktuell', neueVersion: null, zuletztGeprueft: jetzt })
      return
    }
    macNeu = v
    const selbst = macSelbstInstallierend()
    melden({ zustand: 'verfuegbar', neueVersion: v.version, zuletztGeprueft: jetzt, selbstInstallierend: selbst, prozent: null, neuigkeiten: v.notizen })
    if (!selbst) return
    melden({ zustand: 'laedt', prozent: 0 })
    macDmg = await macLaden(v)
    melden({ zustand: 'bereit', prozent: 100 })
  } catch (e) {
    melden({ zustand: 'fehler', fehler: fehlerText(e), zuletztGeprueft: new Date().toISOString() })
  }
}

async function pruefen(): Promise<void> {
  if (!app.isPackaged) return
  if (status.zustand === 'laedt' || status.zustand === 'bereit' || status.zustand === 'installiert') return
  if (istMac) return macPruefen()
  melden({ zustand: 'prueft', fehler: null })
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    melden({ zustand: 'fehler', fehler: fehlerText(e), zuletztGeprueft: new Date().toISOString() })
  }
}

function installieren(): void {
  if (istMac) {
    if (status.zustand === 'bereit' && macDmg && macNeu) {
      const { version } = macNeu
      melden({ zustand: 'installiert' })
      macInstallieren(macDmg, version).catch((e) => {
        melden({ zustand: 'fehler', fehler: 'Selbst einspielen nicht möglich: ' + fehlerText(e) })
        void shell.openExternal(RELEASE_SEITE)
      })
      return
    }
    void shell.openExternal(RELEASE_SEITE)
    return
  }
  if (!status.selbstInstallierend) {
    void shell.openExternal(RELEASE_SEITE)
    return
  }
  // Still installieren (/S), damit kein Installer-Fenster erscheint; danach die App wieder starten.
  if (status.zustand === 'bereit') autoUpdater.quitAndInstall(true, true)
}

/** Einmal beim Start aufrufen; registriert die IPC-Kanäle und startet die regelmäßige Prüfung. */
export function aktualisierungStarten(hauptfenster: BrowserWindow, beenden: () => void): void {
  fenster = hauptfenster
  wirklichBeenden = beenden
  ipcMain.handle('update:status', (): UpdateStatus => status)
  ipcMain.handle('update:pruefen', async (): Promise<UpdateStatus> => {
    await pruefen()
    return status
  })
  ipcMain.handle('update:installieren', (): void => installieren())

  if (!app.isPackaged) return

  if (istMac) {
    melden({ selbstInstallierend: macSelbstInstallierend() })
  } else {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.on('checking-for-update', () => melden({ zustand: 'prueft', fehler: null }))
    autoUpdater.on('update-available', (info) =>
      melden({ zustand: 'laedt', neueVersion: info.version, prozent: 0, zuletztGeprueft: new Date().toISOString(), neuigkeiten: notizenKuerzen(info.releaseNotes) })
    )
    autoUpdater.on('update-not-available', () => melden({ zustand: 'aktuell', neueVersion: null, neuigkeiten: null, zuletztGeprueft: new Date().toISOString() }))
    autoUpdater.on('download-progress', (p) => melden({ zustand: 'laedt', prozent: Math.round(p.percent) }))
    autoUpdater.on('update-downloaded', (info) =>
      melden({ zustand: 'bereit', neueVersion: info.version, prozent: 100, neuigkeiten: notizenKuerzen(info.releaseNotes) ?? status.neuigkeiten })
    )
    autoUpdater.on('error', (e) => melden({ zustand: 'fehler', fehler: fehlerText(e), zuletztGeprueft: new Date().toISOString() }))
  }

  setTimeout(() => void pruefen(), ERSTE_PRUEFUNG_MS)
  setInterval(() => void pruefen(), PRUEF_ABSTAND_MS)
  // Wer die App öffnet, soll ein Update sofort sehen (22. September 2026): beim Zeigen und Fokussieren des Fensters
  // prüfen, wenn die letzte Prüfung länger als zehn Minuten her ist.
  const beiFenster = (): void => {
    const zuletzt = status.zuletztGeprueft ? Date.parse(status.zuletztGeprueft) : 0
    if (Date.now() - zuletzt < FENSTER_PRUEF_ABSTAND_MS) return
    void pruefen()
  }
  hauptfenster.on('show', beiFenster)
  hauptfenster.on('focus', beiFenster)
}
