import type { ReactElement } from 'react'
import { Crosshair, Pause, Play, Square } from 'lucide-react'
import { useErfassung } from '../erfassung'
import { uhrzeit } from '../format'
import { TaetigkeitSymbol } from '../symbole'
import { tonSpielen } from '../toene'
import { fokusDialogOeffnen } from './FokusDialog'
import { hinweisZeigen } from './Hinweis'

const istMac = window.electron?.process?.platform === 'darwin'

const KNOPF =
  'flex items-center gap-2 rounded-chip px-3 py-1.5 text-sm transition-colors [-webkit-app-region:no-drag] disabled:text-dim disabled:hover:bg-transparent'

/** Schmale Leiste ganz oben: Status der Erfassung links, Fokus und Pause rechts. Auf jedem Screen sichtbar. */
export function Kopfzeile(): ReactElement {
  const status = useErfassung()
  const pausiert = status.zustand === 'pausiert'
  const aktiv = status.zustand === 'laeuft' || status.zustand === 'inaktiv' || status.zustand === 'abwesend'
  const fokus = status.fokus

  async function fokusBeenden(): Promise<void> {
    if (!window.api || !fokus) return
    await window.api.fokus.beenden()
    tonSpielen('schliessen')
    hinweisZeigen(`Fokus „${fokus.taetigkeit}“ beendet. Ab jetzt gelten wieder die Regeln.`)
  }

  let punkt = 'bg-dim'
  let text = 'Erfassung nicht aktiv'
  if (status.zustand === 'laeuft') {
    punkt = 'bg-produktiv'
    text = 'Erfassung läuft'
  } else if (status.zustand === 'inaktiv') {
    punkt = 'bg-ungeklaert'
    text = status.inaktivSeit ? `Nicht am Rechner seit ${uhrzeit(status.inaktivSeit)}, zählt als unproduktiv` : 'Nicht am Rechner'
  } else if (status.zustand === 'abwesend') {
    punkt = 'bg-ungeklaert'
    text = 'Abwesend, Erfassung ruht'
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
        {fokus ? (
          <button type="button" onClick={() => void fokusBeenden()} className={`${KNOPF} text-ink hover:bg-panel-2`} title="Fokus beenden">
            <Square size={14} strokeWidth={2} />
            Fokus beenden
          </button>
        ) : (
          <button
            type="button"
            disabled={!aktiv && !pausiert}
            onClick={fokusDialogOeffnen}
            className={`${KNOPF} text-ink hover:bg-panel-2`}
            title="Fokus: eine Tätigkeit für alles, was du jetzt tust (Strg+F)"
          >
            <Crosshair size={16} strokeWidth={1.75} />
            Fokus
          </button>
        )}
        <button
          type="button"
          disabled={!aktiv && !pausiert}
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
