import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

const APP_ID = 'com.wessamedia.zeit'
const HINTERGRUND = '#0B0B0C'

function fensterAnlegen(): BrowserWindow {
  const fenster = new BrowserWindow({
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

  fenster.on('ready-to-show', () => fenster.show())

  // Links öffnen im Browser des Systems, nie in einem neuen App-Fenster.
  fenster.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void fenster.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void fenster.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return fenster
}

void app.whenReady().then(() => {
  electronApp.setAppUserModelId(APP_ID)

  // F12 öffnet die Entwicklerwerkzeuge, aber nur in der Entwicklungsversion.
  app.on('browser-window-created', (_, fenster) => optimizer.watchWindowShortcuts(fenster))

  fensterAnlegen()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) fensterAnlegen()
  })
})

// Schritt 1: Schließen beendet die App noch. Ab Schritt 3 läuft sie im Hintergrund weiter.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
