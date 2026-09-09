import { memo, type ReactElement } from 'react'
import { AUSZEICHNUNGEN, AUSZEICHNUNG_REIHENFOLGE } from '@shared/auszeichnungen'
import type { Auszeichnung } from '@shared/typen'
import { kurzDatum } from '../format'
import { AuszeichnungBild } from './AuszeichnungBild'
import { Karte } from './Karte'

/** Die Reihe der vier Auszeichnungen unten auf dem Wochen-Screen. */
function AuszeichnungenInnen({ liste }: { liste: Auszeichnung[] }): ReactElement {
  return (
    <Karte>
      <p className="text-xs tracking-wide text-mute uppercase">Auszeichnungen</p>
      <p className="mt-1 text-xs text-dim">
        {liste.length} von {AUSZEICHNUNG_REIHENFOLGE.length} freigeschaltet. Mit der Maus über eine Medaille fahren zeigt, was dafür nötig ist.
      </p>
      <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-7">
        {AUSZEICHNUNG_REIHENFOLGE.map((typ) => {
          const a = liste.find((x) => x.typ === typ)
          const info = AUSZEICHNUNGEN[typ]
          return (
            <div key={typ} className="flex flex-col items-center text-center" title={info.text}>
              <AuszeichnungBild typ={typ} erreicht={!!a} groesse={66} />
              <p className={`mt-1.5 text-xs leading-tight ${a ? 'text-ink' : 'text-mute'}`}>{info.titel}</p>
              <p className="mt-0.5 text-[11px] text-dim">{a ? kurzDatum(a.wocheStart) : 'offen'}</p>
            </div>
          )
        })}
      </div>
    </Karte>
  )
}

/** Gemerkt: rendert nur neu, wenn sich die Eingaben ändern; die Statusmeldung alle 5 s rendert sonst jedes Diagramm mit. */
export const Auszeichnungen = memo(AuszeichnungenInnen)
