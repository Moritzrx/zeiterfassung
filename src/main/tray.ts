import { Menu, nativeImage, Tray } from 'electron'
import trayWinPfad from '../assets/tray/tray-win.png?asset'
import trayWinPausePfad from '../assets/tray/tray-win-paused.png?asset'
import trayWinFokusPfad from '../assets/tray/tray-win-fokus.png?asset'
import trayMacPfad from '../assets/tray/trayTemplate.png?asset'

export interface TrayAktionen {
  oeffnen: () => void
  pause: () => void
  fortsetzen: () => void
  fokusBeenden: () => void
  /** Fenster öffnen und den Fokus-Dialog zeigen */
  fokusStarten: () => void
  /** Rückkehr von "Ich bin weg" melden */
  wegBeenden: () => void
  beenden: () => void
}

export interface TrayStand {
  angemeldet: boolean
  heuteText: string
  rang: number
  pausiert: boolean
  /** Tätigkeit des laufenden Fokus, sonst null */
  fokus: string | null
  /** Tätigkeit der laufenden angekündigten Abwesenheit ("Ich bin weg"), sonst null */
  weg: string | null
  /** Nur im Fokus aufzeichnen, und gerade läuft keiner: es zählt keine Zeit */
  ohneFokus: boolean
  /** Gerade wird Zeit gezählt (Fokus bzw. Aufzeichnung läuft, oder "Ich bin weg"): Symbol grün */
  zaehlt: boolean
}

/**
 * Das Symbol in der Menüleiste (Mac) bzw. im Infobereich (Windows).
 * Zeigt die heutigen Stunden und den Rang, bietet Pause und Beenden.
 */
export class TrayLeiste {
  private readonly tray: Tray
  private readonly bild: Electron.NativeImage
  private readonly bildPause: Electron.NativeImage
  /** Grün, solange Zeit gezählt wird (Windows; auf dem Mac ist das Symbol einfarbig, dort sagt es der Titel). */
  private readonly bildFokus: Electron.NativeImage

  constructor(private readonly aktionen: TrayAktionen) {
    if (process.platform === 'darwin') {
      this.bild = nativeImage.createFromPath(trayMacPfad)
      this.bild.setTemplateImage(true)
      this.bildPause = this.bild
      this.bildFokus = this.bild
    } else {
      this.bild = nativeImage.createFromPath(trayWinPfad)
      this.bildPause = nativeImage.createFromPath(trayWinPausePfad)
      this.bildFokus = nativeImage.createFromPath(trayWinFokusPfad)
    }
    this.tray = new Tray(this.bild)
    this.tray.setToolTip('wessamedia Zeit')
    this.tray.on('click', () => this.aktionen.oeffnen())
    this.aktualisieren({ angemeldet: false, heuteText: '0,0 h', rang: 0, pausiert: false, fokus: null, weg: null, ohneFokus: false, zaehlt: false })
  }

  aktualisieren(stand: TrayStand): void {
    const zeile = stand.angemeldet ? `Heute ${stand.heuteText} · Rang ${stand.rang}` : 'Nicht angemeldet'
    const menue = Menu.buildFromTemplate([
      { label: zeile, enabled: false },
      ...(stand.fokus ? [{ label: `Fokus: ${stand.fokus}`, enabled: false }] : []),
      ...(stand.weg ? [{ label: `Weg: ${stand.weg}`, enabled: false }] : []),
      ...(stand.ohneFokus ? [{ label: 'Kein Fokus, Zeit zählt nicht', enabled: false }] : []),
      { type: 'separator' as const },
      ...(stand.ohneFokus ? [{ label: 'Fokus starten …', click: () => this.aktionen.fokusStarten() }] : []),
      stand.pausiert
        ? { label: 'Erfassung fortsetzen', click: () => this.aktionen.fortsetzen(), enabled: stand.angemeldet }
        : { label: 'Pause', click: () => this.aktionen.pause(), enabled: stand.angemeldet },
      ...(stand.fokus ? [{ label: 'Fokus beenden', click: () => this.aktionen.fokusBeenden() }] : []),
      ...(stand.weg ? [{ label: 'Zurück (Abwesenheit beenden)', click: () => this.aktionen.wegBeenden() }] : []),
      { label: 'Fenster öffnen', click: () => this.aktionen.oeffnen() },
      { type: 'separator' },
      { label: 'Beenden', click: () => this.aktionen.beenden() }
    ])
    this.tray.setContextMenu(menue)
    this.tray.setToolTip(stand.pausiert ? 'wessamedia Zeit · Erfassung pausiert' : stand.ohneFokus ? `wessamedia Zeit · Kein Fokus · ${zeile}` : `wessamedia Zeit · ${zeile}`)
    this.tray.setImage(stand.pausiert ? this.bildPause : stand.zaehlt ? this.bildFokus : this.bild)
    if (process.platform === 'darwin') {
      this.tray.setTitle(stand.angemeldet ? (stand.pausiert ? 'Pause' : stand.ohneFokus ? 'Kein Fokus' : stand.heuteText) : '')
    }
  }
}
