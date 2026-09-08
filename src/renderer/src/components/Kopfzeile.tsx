import type { ReactElement } from 'react'
import { Pause, Play } from 'lucide-react'
import { useErfassung } from '../erfassung'
import { uhrzeit } from '../format'

const istMac = window.electron?.process?.platform === 'darwin'

/** Schmale Leiste ganz oben: Status der Erfassung links, Pause-Knopf rechts. Auf jedem Screen sichtbar. */
export function Kopfzeile(): ReactElement {
  const status = useErfassung()
  const pausiert = status.zustand === 'pausiert'
  const aktiv = status.zustand === 'laeuft' || status.zustand === 'inaktiv' || status.zustand === 'abwesend'

  let punkt = 'bg-dim'
  let text = 'Erfassung nicht aktiv'
  if (status.zustand === 'laeuft') {
    punkt = 'bg-produktiv'
    text = 'Erfassung läuft'
  } else if (status.zustand === 'inaktiv') {
    punkt = 'bg-ungeklaert'
    text = status.inaktivSeit ? `Inaktiv seit ${uhrzeit(status.inaktivSeit)}` : 'Inaktiv'
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
      </div>
      <button
        type="button"
        disabled={!aktiv && !pausiert}
        onClick={umschalten}
        className={`flex items-center gap-2 rounded-chip px-3 py-1.5 text-sm transition-colors [-webkit-app-region:no-drag] ${
          pausiert ? 'bg-ink text-ground' : 'text-ink hover:bg-panel-2 disabled:text-dim disabled:hover:bg-transparent'
        }`}
      >
        {pausiert ? <Play size={16} strokeWidth={1.75} /> : <Pause size={16} strokeWidth={1.75} />}
        {pausiert ? 'Fortsetzen' : 'Pause'}
      </button>
    </header>
  )
}
