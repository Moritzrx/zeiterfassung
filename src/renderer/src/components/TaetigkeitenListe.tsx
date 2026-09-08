import type { ReactElement } from 'react'
import { stundenText } from '../format'
import { TaetigkeitSymbol } from '../symbole'

export interface TaetigkeitEintrag {
  name: string
  sekunden: number
  zielSekunden: number | null
}

interface Props {
  eintraege: TaetigkeitEintrag[]
}

/** Tätigkeiten absteigend nach Stunden, jede mit Balken; das Ziel als helle Markierung im Balken. */
export function TaetigkeitenListe({ eintraege }: Props): ReactElement {
  if (eintraege.length === 0) {
    return <p className="mt-2 text-sm text-dim">Noch keine produktive Zeit mit Tätigkeit in dieser Woche.</p>
  }
  const skala = Math.max(1, ...eintraege.map((e) => Math.max(e.sekunden, e.zielSekunden ?? 0)))

  return (
    <div className="mt-2 flex flex-col gap-4">
      {eintraege.map((e) => {
        const erreicht = e.zielSekunden !== null && e.sekunden >= e.zielSekunden
        const breite = Math.min(100, (e.sekunden / skala) * 100)
        return (
          <div key={e.name}>
            <div className="flex items-center justify-between gap-4">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <TaetigkeitSymbol name={e.name} groesse={16} />
                <span className="truncate">{e.name}</span>
              </span>
              <span className={`shrink-0 text-sm ${erreicht ? 'text-produktiv' : 'text-mute'}`}>
                {e.zielSekunden !== null
                  ? `${stundenText(e.sekunden)} von ${stundenText(e.zielSekunden)} h`
                  : `${stundenText(e.sekunden)} h`}
              </span>
            </div>
            <div className="relative mt-2 h-1.5 w-full rounded-full bg-panel-2">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${erreicht ? 'bg-produktiv' : 'bg-ink'}`}
                style={{ width: `${breite}%` }}
              />
              {e.zielSekunden !== null && (
                <div
                  className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-mute"
                  style={{ left: `calc(${Math.min(100, (e.zielSekunden / skala) * 100)}% - 1px)` }}
                  title={`Ziel ${stundenText(e.zielSekunden)} h`}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
