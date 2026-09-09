import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { deltaText, liga } from '@shared/liga'
import type { LigaStand } from '@shared/typen'
import { fehlerText, zahlText } from '../format'
import { Karte } from './Karte'
import { LigaAbzeichen } from './LigaAbzeichen'

/** Die Liga-Rangliste des Teams: wer steht mit wie vielen Trophäen in welcher Liga. */
export function LigaRangliste(): ReactElement {
  const [stand, setStand] = useState<LigaStand[]>([])
  const [fehler, setFehler] = useState<string | null>(null)

  const laden = useCallback(async () => {
    if (!window.api) return
    try {
      setStand(await window.api.liga.stand())
      setFehler(null)
    } catch (e) {
      setFehler(fehlerText(e))
    }
  }, [])

  useEffect(() => {
    void laden()
    const timer = setInterval(() => void laden(), 5 * 60_000)
    return () => clearInterval(timer)
  }, [laden])

  const sortiert = [...stand].sort((a, b) => b.trophaeen - a.trophaeen || a.name.localeCompare(b.name))

  return (
    <Karte>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs tracking-wide text-mute uppercase">Liga</p>
        <p className="text-xs text-dim">Trophäen aus allen abgeschlossenen Wochen</p>
      </div>
      {fehler && <p className="mt-3 text-sm text-mute">{fehler}</p>}
      <div className="mt-3 flex flex-col gap-1">
        {sortiert.map((s, i) => {
          const l = liga(s.trophaeen)
          return (
            <div
              key={s.userId}
              className={`flex items-center gap-4 rounded-chip px-3 py-2.5 ${s.istIch ? 'bg-panel-2' : ''}`}
            >
              <span className="w-5 text-sm text-mute">{i + 1}.</span>
              <LigaAbzeichen liga={l} groesse={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {s.name}
                  {s.istIch && <span className="text-mute"> · du</span>}
                  {s.imUrlaub && <span className="ml-2 rounded-chip bg-panel-2 px-1.5 py-0.5 text-xs text-mute">im Urlaub</span>}
                </p>
                <p className="text-xs text-mute">{l.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">{zahlText(s.trophaeen, 0)}</p>
                <p
                  className={`text-xs ${
                    s.letztesDelta === null ? 'text-dim' : s.letztesDelta > 0 ? 'text-produktiv' : s.letztesDelta < 0 ? 'text-unproduktiv' : 'text-mute'
                  }`}
                >
                  {s.letztesDelta === null ? 'noch keine Woche' : `letzte Woche ${deltaText(s.letztesDelta)}`}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </Karte>
  )
}
