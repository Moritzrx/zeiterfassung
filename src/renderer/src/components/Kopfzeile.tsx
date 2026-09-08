import type { ReactElement } from 'react'
import { Pause } from 'lucide-react'

const istMac = window.electron?.process?.platform === 'darwin'

/** Schmale Leiste ganz oben: Status der Erfassung links, Pause-Knopf rechts. Auf jedem Screen sichtbar. */
export function Kopfzeile(): ReactElement {
  return (
    <header
      className={`flex h-12 shrink-0 items-center justify-between pr-4 ${istMac ? 'pl-24' : 'pl-6'} [-webkit-app-region:drag]`}
    >
      <div className="flex items-center gap-2 text-sm text-mute">
        <span className="inline-block h-2 w-2 rounded-full bg-dim" />
        <span>Erfassung noch nicht eingerichtet</span>
      </div>
      <button
        type="button"
        disabled
        title="Kommt in Schritt 3"
        className="flex items-center gap-2 rounded-chip px-3 py-1.5 text-sm text-dim [-webkit-app-region:no-drag]"
      >
        <Pause size={16} strokeWidth={1.75} />
        Pause
      </button>
    </header>
  )
}
