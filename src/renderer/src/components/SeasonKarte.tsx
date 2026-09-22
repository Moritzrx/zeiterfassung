import { useState, type ReactElement } from 'react'
import { Sparkles } from 'lucide-react'
import { PUNKTE_JE_LEVEL, SEASON_LEVEL_MAX, levelSchwelle, naechsteBelohnung } from '@shared/spiel'
import { datumZuTagesanfang } from '@shared/zeit'
import { Karte } from './Karte'
import { SeasonDialog } from './SeasonDialog'
import { useSeason } from '../spiel'

/** Season Pass auf der Woche (22. September 2026): Level, Punkte, nächste Belohnung und der Stand im Team. */
export function SeasonKarte(): ReactElement | null {
  const { stand, fehler, neuLaden } = useSeason()
  const [offen, setOffen] = useState(false)

  if (fehler) {
    return (
      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Season Pass</p>
        <p className="mt-2 text-sm text-mute">{fehler}</p>
      </Karte>
    )
  }
  if (!stand) return null

  const von = levelSchwelle(stand.level)
  const anteil = stand.level >= SEASON_LEVEL_MAX ? 1 : Math.min(1, (stand.punkte - von) / PUNKTE_JE_LEVEL)
  const naechste = naechsteBelohnung(stand.level)
  const wochenRest = Math.max(0, Math.ceil((datumZuTagesanfang(stand.season.ende).getTime() - Date.now()) / (7 * 86_400_000)))

  return (
    <Karte>
      {offen && <SeasonDialog stand={stand} onSchliessen={() => setOffen(false)} onGeaendert={() => void neuLaden()} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs tracking-wide text-mute uppercase">
          Season {stand.season.nummer} · noch {wochenRest} {wochenRest === 1 ? 'Woche' : 'Wochen'}
        </p>
        <button type="button" onClick={() => setOffen(true)} className="knopf-primaer flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-sm">
          <Sparkles size={14} strokeWidth={2} />
          Belohnungen
        </button>
      </div>
      <div className="mt-3 flex items-end gap-4">
        <p className="text-4xl leading-none font-light">
          Lv {stand.level}
          <span className="ml-2 text-base text-mute">{stand.punkte} Punkte</span>
        </p>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-orange transition-[width] duration-500" style={{ width: `${anteil * 100}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-dim">
        {stand.level >= SEASON_LEVEL_MAX
          ? 'Höchstes Level erreicht.'
          : `Noch ${levelSchwelle(stand.level + 1) - stand.punkte} Punkte bis Level ${stand.level + 1}.`}
        {naechste && ` Nächste Belohnung auf Level ${naechste.level}: ${naechste.name}.`}
      </p>
      {stand.team.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {stand.team.map((p) => (
            <span key={p.userId} className={p.istIch ? 'text-produktiv' : 'text-mute'}>
              {p.name} Lv {p.level}
            </span>
          ))}
        </div>
      )}
    </Karte>
  )
}
