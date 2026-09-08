import type { ReactElement } from 'react'
import { CalendarDays, ChartColumn, Clock, Plus, Settings, Users, type LucideIcon } from 'lucide-react'

export type ScreenId = 'heute' | 'woche' | 'auswertung' | 'team' | 'eintragen' | 'einstellungen'

const EINTRAEGE: { id: ScreenId; label: string; Icon: LucideIcon }[] = [
  { id: 'heute', label: 'Heute', Icon: Clock },
  { id: 'woche', label: 'Woche', Icon: CalendarDays },
  { id: 'auswertung', label: 'Auswertung', Icon: ChartColumn },
  { id: 'team', label: 'Team', Icon: Users },
  { id: 'eintragen', label: 'Eintragen', Icon: Plus },
  { id: 'einstellungen', label: 'Einstellungen', Icon: Settings }
]

interface Props {
  aktiv: ScreenId
  onWechsel: (id: ScreenId) => void
}

/** Die Navigationsleiste unten mit sechs Symbolen. */
export function Navigation({ aktiv, onWechsel }: Props): ReactElement {
  return (
    <nav className="flex h-16 shrink-0 items-stretch justify-center gap-1 bg-ground px-2">
      {EINTRAEGE.map(({ id, label, Icon }) => {
        const istAktiv = id === aktiv
        return (
          <button
            key={id}
            type="button"
            onClick={() => onWechsel(id)}
            className={`flex w-24 flex-col items-center justify-center gap-1 rounded-chip text-[11px] transition-colors ${
              istAktiv ? 'text-ink' : 'text-mute hover:text-ink'
            }`}
          >
            <Icon size={20} strokeWidth={istAktiv ? 2 : 1.5} />
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
