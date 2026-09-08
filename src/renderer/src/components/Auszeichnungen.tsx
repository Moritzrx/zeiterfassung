import type { ReactElement } from 'react'
import { AUSZEICHNUNGEN, AUSZEICHNUNG_REIHENFOLGE } from '@shared/auszeichnungen'
import type { Auszeichnung } from '@shared/typen'
import { kurzDatum } from '../format'
import { AuszeichnungBild } from './AuszeichnungBild'
import { Karte } from './Karte'

/** Die Reihe der vier Auszeichnungen unten auf dem Wochen-Screen. */
export function Auszeichnungen({ liste }: { liste: Auszeichnung[] }): ReactElement {
  return (
    <Karte>
      <p className="text-xs tracking-wide text-mute uppercase">Auszeichnungen</p>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {AUSZEICHNUNG_REIHENFOLGE.map((typ) => {
          const a = liste.find((x) => x.typ === typ)
          const info = AUSZEICHNUNGEN[typ]
          return (
            <div key={typ} className={`flex flex-col items-center text-center ${a ? '' : 'opacity-60'}`} title={info.text}>
              <AuszeichnungBild typ={typ} erreicht={!!a} />
              <p className={`mt-2 text-sm ${a ? 'text-ink' : 'text-mute'}`}>{info.titel}</p>
              <p className="mt-0.5 text-xs text-dim">{a ? `Woche ab ${kurzDatum(a.wocheStart)}` : 'noch offen'}</p>
            </div>
          )
        })}
      </div>
    </Karte>
  )
}
