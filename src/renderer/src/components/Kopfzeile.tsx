import type { ReactElement } from 'react'
import { Crosshair, DoorOpen, LogIn, Pause, Play, Square } from 'lucide-react'
import { useErfassung } from '../erfassung'
import { uhrzeit } from '../format'
import { TaetigkeitSymbol } from '../symbole'
import { tonSpielen } from '../toene'
import { fokusDialogOeffnen } from './FokusDialog'
import { hinweisZeigen } from './Hinweis'
import { wegDialogOeffnen } from './WegDialog'

const istMac = window.electron?.process?.platform === 'darwin'

const KNOPF =
  'flex items-center gap-2 rounded-chip px-3 py-1.5 text-sm transition-colors [-webkit-app-region:no-drag] disabled:text-dim disabled:hover:bg-transparent'

/** Schmale Leiste ganz oben: Status der Erfassung links, "Ich bin weg", Fokus und Pause rechts. Auf jedem Screen sichtbar. */
export function Kopfzeile(): ReactElement {
  const status = useErfassung()
  const pausiert = status.zustand === 'pausiert'
  const weg = status.weg
  const ohneFokus = status.zustand === 'ohne-fokus'
  const aktiv = status.zustand === 'laeuft' || status.zustand === 'inaktiv' || status.zustand === 'abwesend' || status.zustand === 'weg' || ohneFokus
  const fokus = status.fokus

  async function fokusBeenden(): Promise<void> {
    if (!window.api || !fokus) return
    await window.api.fokus.beenden()
    tonSpielen('schliessen')
    hinweisZeigen(
      status.nurFokus
        ? `Fokus „${fokus.taetigkeit}“ beendet. Bis zum nächsten Fokus zählt keine Zeit.`
        : `Fokus „${fokus.taetigkeit}“ beendet. Ab jetzt gelten wieder die Regeln.`
    )
  }

  async function wegBeenden(): Promise<void> {
    if (!window.api || !weg) return
    await window.api.weg.beenden()
    tonSpielen('erfolg')
    if (status.nurFokus) {
      // Im Fokus-Modus zählt ab jetzt nichts mehr, bis ein Fokus läuft: gleich den Dialog anbieten.
      hinweisZeigen(`Willkommen zurück. „${weg.taetigkeit}“ ist gebucht. Jetzt einen Fokus starten.`)
      fokusDialogOeffnen()
    } else {
      hinweisZeigen(`Willkommen zurück. „${weg.taetigkeit}“ ist als produktive Zeit gebucht.`)
    }
  }

  let punkt = 'bg-dim'
  let text = 'Erfassung nicht aktiv'
  if (status.zustand === 'weg' && weg) {
    punkt = 'bg-produktiv'
    text = `Weg: ${weg.taetigkeit} seit ${uhrzeit(weg.seit)}, zählt als produktiv`
  } else if (ohneFokus) {
    punkt = 'bg-dim'
    text = 'Kein Fokus, Zeit zählt nicht'
  } else if (status.zustand === 'laeuft') {
    punkt = 'bg-produktiv'
    text = fokus ? 'Fokus läuft' : 'Erfassung läuft'
  } else if (status.zustand === 'inaktiv') {
    punkt = 'bg-unproduktiv'
    text = status.inaktivSeit ? `Nicht am Rechner seit ${uhrzeit(status.inaktivSeit)}, zählt als unproduktiv` : 'Nicht am Rechner'
  } else if (status.zustand === 'abwesend') {
    punkt = 'bg-abwesend'
    text = status.inaktivSeit ? `Abwesend seit ${uhrzeit(status.inaktivSeit)}, zählt nicht` : 'Abwesend, zählt nicht'
  } else if (pausiert) {
    punkt = 'bg-unproduktiv'
    text = status.pausiertSeit ? `Erfassung pausiert seit ${uhrzeit(status.pausiertSeit)}` : 'Erfassung pausiert'
  }

  async function umschalten(): Promise<void> {
    if (!window.api) return
    if (pausiert) await window.api.erfassung.fortsetzen()
    else await window.api.erfassung.pause()
  }

  return (
    <header
      className={`flex h-12 shrink-0 items-center justify-between pr-4 transition-colors ${istMac ? 'pl-24' : 'pl-6'} ${
        pausiert ? 'bg-panel-2' : ''
      } [-webkit-app-region:drag]`}
    >
      <div className={`flex items-center gap-2 text-sm ${pausiert ? 'text-ink' : 'text-mute'}`}>
        <span className={`inline-block h-2 w-2 rounded-full ${punkt}`} />
        <span>{text}</span>
        {status.syncFehler && (
          <span className="ml-3 text-xs text-dim" title={status.syncFehler}>
            Datenbank nicht erreichbar, {status.unsynchronisiert} Blöcke warten
          </span>
        )}
        {fokus && (
          <span
            className="ml-3 flex items-center gap-1.5 rounded-chip bg-produktiv/15 px-2.5 py-1 text-xs text-produktiv"
            title="Alles, was du gerade tust, zählt als produktiv mit dieser Tätigkeit"
          >
            <Crosshair size={13} strokeWidth={2} />
            Fokus: <TaetigkeitSymbol name={fokus.taetigkeit} groesse={13} /> {fokus.taetigkeit} · seit {uhrzeit(fokus.seit)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {weg ? (
          <button type="button" onClick={() => void wegBeenden()} className={`${KNOPF} bg-produktiv/15 text-produktiv hover:bg-produktiv/25`} title="Rückkehr melden (sonst beendet die erste Eingabe die Abwesenheit)">
            <LogIn size={16} strokeWidth={1.75} />
            Zurück
          </button>
        ) : (
          <button
            type="button"
            disabled={!aktiv && !pausiert}
            onClick={wegDialogOeffnen}
            className={`${KNOPF} text-ink hover:bg-panel-2`}
            title="Ich bin weg: Termin, Dreh oder Telefonat als produktive Zeit buchen, bis du zurück bist"
          >
            <DoorOpen size={16} strokeWidth={1.75} />
            Ich bin weg
          </button>
        )}
        {fokus ? (
          <button type="button" onClick={() => void fokusBeenden()} className={`${KNOPF} text-ink hover:bg-panel-2`} title="Fokus beenden">
            <Square size={14} strokeWidth={2} />
            Fokus beenden
          </button>
        ) : (
          <button
            type="button"
            disabled={(!aktiv && !pausiert) || !!weg}
            onClick={fokusDialogOeffnen}
            className={`${KNOPF} ${ohneFokus ? 'knopf-primaer' : 'text-ink hover:bg-panel-2'}`}
            title={ohneFokus ? 'Kein Fokus: Erst mit einem Fokus zählt deine Zeit (Strg+F)' : 'Fokus: eine Tätigkeit für alles, was du jetzt tust (Strg+F)'}
          >
            <Crosshair size={16} strokeWidth={1.75} />
            Fokus
          </button>
        )}
        <button
          type="button"
          disabled={(!aktiv && !pausiert) || !!weg}
          onClick={umschalten}
          className={`${KNOPF} ${pausiert ? 'bg-ink text-ground' : 'text-ink hover:bg-panel-2'}`}
        >
          {pausiert ? <Play size={16} strokeWidth={1.75} /> : <Pause size={16} strokeWidth={1.75} />}
          {pausiert ? 'Fortsetzen' : 'Pause'}
        </button>
      </div>
    </header>
  )
}
