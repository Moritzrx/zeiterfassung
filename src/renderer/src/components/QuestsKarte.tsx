import { useState, type ReactElement } from 'react'
import { Check, Flame, Sparkles } from 'lucide-react'
import { STREAK_STUNDEN } from '@shared/spiel'
import { Karte } from './Karte'
import { SeasonDialog } from './SeasonDialog'
import { useSeason } from '../spiel'
import { stundenText } from '../format'

/**
 * Daily Quests auf "Heute" (22. September 2026, Team-Spiel): drei Aufgaben je Tag, fest gewürfelt, mit Fortschritt und
 * Punkten, dazu der Streak (Tage in Folge mit mindestens vier Stunden) und der Weg zum Season Pass.
 */
export function QuestsKarte(): ReactElement | null {
  const { stand, fehler, neuLaden } = useSeason()
  const [offen, setOffen] = useState(false)

  if (fehler) {
    return (
      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Daily Quests</p>
        <p className="mt-2 text-sm text-mute">{fehler}</p>
      </Karte>
    )
  }
  if (!stand) return null

  const streakAnteil = Math.min(1, stand.streak.heuteSekunden / (STREAK_STUNDEN * 3600))
  const geschafft = stand.quests.filter((q) => q.erfuellt).length

  return (
    <Karte>
      {offen && <SeasonDialog stand={stand} onSchliessen={() => setOffen(false)} onGeaendert={() => void neuLaden()} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs tracking-wide text-mute uppercase">
          Daily Quests · {geschafft} von {stand.quests.length}
        </p>
        <button
          type="button"
          onClick={() => setOffen(true)}
          className="flex items-center gap-1.5 rounded-chip bg-panel-2 px-2.5 py-1 text-xs text-ink transition-colors hover:bg-inaktiv"
          title="Season Pass mit Belohnungen"
        >
          <Sparkles size={13} strokeWidth={1.8} />
          Season {stand.season.nummer} · Level {stand.level} · {stand.punkte} P{stand.heutePunkte > 0 ? ` (heute +${stand.heutePunkte})` : ''}
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {stand.quests.map((q) => (
          <div key={q.id} className="flex items-center gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${q.erfuellt ? 'bg-produktiv text-ground' : 'bg-panel-2 text-dim'}`}>
              {q.erfuellt ? <Check size={16} strokeWidth={2.4} /> : <span className="text-xs tabular-nums">{Math.round(q.fortschritt * 100)}%</span>}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${q.erfuellt ? 'text-produktiv' : ''}`}>
                {q.titel} <span className="text-xs text-dim">· {q.punkte} P</span>
              </p>
              <p className="truncate text-xs text-mute" title={q.text}>
                {q.text}
              </p>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-panel-2">
                <div className={`h-full rounded-full transition-[width] duration-500 ${q.erfuellt ? 'bg-produktiv' : 'bg-ink/60'}`} style={{ width: `${Math.round(q.fortschritt * 100)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${stand.streak.heuteErreicht ? 'bg-orange text-ground' : 'bg-panel-2 text-orange'}`}>
          <Flame size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            Streak: {stand.streak.laenge} {stand.streak.laenge === 1 ? 'Tag' : 'Tage'} in Folge{' '}
            <span className="text-xs text-dim">· {STREAK_STUNDEN} Stunden am Tag, heute {stundenText(stand.streak.heuteSekunden)} h</span>
          </p>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-panel-2">
            <div className="h-full rounded-full bg-orange transition-[width] duration-500" style={{ width: `${streakAnteil * 100}%` }} />
          </div>
        </div>
      </div>
    </Karte>
  )
}
