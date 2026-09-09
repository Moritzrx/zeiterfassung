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

const BREITE = 96 // w-24
const ABSTAND = 4 // gap-1

/** Die Navigationsleiste unten mit sechs Symbolen. Die Markierung gleitet zum aktiven Eintrag. */
export function Navigation({ aktiv, onWechsel }: Props): ReactElement {
  const index = EINTRAEGE.findIndex((e) => e.id === aktiv)
  return (
    <nav className="flex h-16 shrink-0 items-stretch justify-center bg-ground/70 px-2 backdrop-blur-xl">
      <div className="relative flex items-stretch gap-1 py-2">
        <div
          aria-hidden="true"
          className="absolute inset-y-2 left-0 rounded-chip bg-panel-2 transition-transform duration-300 [transition-timing-function:var(--ease-federnd)]"
          style={{ width: BREITE, transform: `translateX(${index * (BREITE + ABSTAND)}px)` }}
        />
        {EINTRAEGE.map(({ id, label, Icon }) => {
          const istAktiv = id === aktiv
          return (
            <button
              key={id}
              type="button"
              onClick={() => onWechsel(id)}
              className={`relative flex w-24 flex-col items-center justify-center gap-1 rounded-chip text-[11px] transition-colors ${
                istAktiv ? 'text-ink' : 'text-mute hover:text-ink'
              }`}
            >
              <Icon
                size={20}
                strokeWidth={istAktiv ? 2 : 1.5}
                className={`transition-transform duration-300 [transition-timing-function:var(--ease-federnd)] ${
                  istAktiv ? 'scale-110' : ''
                }`}
              />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
