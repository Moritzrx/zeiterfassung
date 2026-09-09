import { useEffect, type ReactElement } from 'react'
import { X } from 'lucide-react'
import {
  LIGA_FARBEN,
  LIGA_MAX_DELTA,
  LIGA_MIN_DELTA,
  LIGA_NEUTRAL_ABSTAND,
  LIGA_START_TROPHAEEN,
  LIGA_STUFEN_NAMEN,
  LIGEN,
  liga,
  type LigaStufe
} from '@shared/liga'
import { zahlText } from '../format'
import { LigaAbzeichen } from './LigaAbzeichen'

interface Props {
  trophaeen: number
  gesamtziel: number
  onSchliessen: () => void
}

const STUFEN: LigaStufe[] = ['bronze', 'silber', 'gold', 'kristall', 'meister', 'champion', 'titan', 'legende']

/** Alle Ligen auf einen Blick, mit den Trophäen, ab denen man sie hat, und der Regel dahinter. */
export function LigaUebersicht({ trophaeen, gesamtziel, onSchliessen }: Props): ReactElement {
  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  const aktuelle = liga(trophaeen)
  const neutral = gesamtziel - LIGA_NEUTRAL_ABSTAND

  return (
    <div className="animate-aufblenden fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" onClick={onSchliessen}>
      <div onClick={(e) => e.stopPropagation()} className="glas max-h-[calc(100vh-3rem)] w-full max-w-[720px] overflow-y-auto rounded-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl">Die Liga</h2>
            <p className="mt-1 text-sm text-mute">
              Anders als der Wochenrang bleibt die Liga über die Wochen erhalten. Jede abgeschlossene Woche bringt Trophäen
              dazu oder nimmt welche weg: 10 je Stunde über oder unter {zahlText(neutral, 0)} Stunden (dein Ziel minus{' '}
              {LIGA_NEUTRAL_ABSTAND}). Dein Ziel erreicht heißt +{(gesamtziel - neutral) * 10}, höchstens +{LIGA_MAX_DELTA} und
              höchstens {LIGA_MIN_DELTA} pro Woche. Wochen ohne einen einzigen Block zählen nicht. Hinterlegter Urlaub senkt
              die Erwartung anteilig, eine ganze Urlaubswoche kostet nichts. Jeder startet mit {LIGA_START_TROPHAEEN} Trophäen,
              die Liga läuft dauerhaft weiter und wird nie zurückgesetzt.
            </p>
          </div>
          <button type="button" onClick={onSchliessen} className="rounded-chip p-1 text-mute hover:text-ink" title="Schließen">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {STUFEN.map((stufe) => {
          const eigene = LIGEN.filter((l) => l.stufe === stufe)
          return (
            <div key={stufe} className="mt-6">
              <p className="text-xs tracking-wide uppercase" style={{ color: LIGA_FARBEN[stufe] }}>
                {LIGA_STUFEN_NAMEN[stufe]}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {eigene.map((l) => {
                  const erreicht = l.index <= aktuelle.index
                  const istAktuell = l.index === aktuelle.index
                  return (
                    <div
                      key={l.index}
                      className={`flex items-center gap-3 rounded-card p-3 ${istAktuell ? 'bg-panel-2' : erreicht ? 'bg-panel-2/40' : ''}`}
                    >
                      <div className={erreicht ? '' : 'opacity-40'}>
                        <LigaAbzeichen liga={l} groesse={44} />
                      </div>
                      <div className="min-w-0">
                        <p className={`truncate text-sm ${erreicht ? 'text-ink' : 'text-mute'}`}>{l.name}</p>
                        <p className="text-xs text-dim">ab {zahlText(l.ab, 0)} Trophäen</p>
                        {istAktuell && <p className="text-xs text-produktiv">deine Liga</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
