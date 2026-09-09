import { memo, type ReactElement } from 'react'
import { AUSZEICHNUNGEN, AUSZEICHNUNG_GRUPPEN, AUSZEICHNUNG_REIHENFOLGE } from '@shared/auszeichnungen'
import type { Auszeichnung, AuszeichnungTyp } from '@shared/typen'
import { kurzDatum } from '../format'
import { AuszeichnungBild } from './AuszeichnungBild'
import { Karte } from './Karte'

/** Alle Medaillen unten auf dem Wochen-Screen, nach Gruppen; erreichte leuchten, offene sind grau. */
function AuszeichnungenInnen({ liste }: { liste: Auszeichnung[] }): ReactElement {
  const erreicht = new Map(liste.map((a) => [a.typ, a] as const))
  return (
    <Karte>
      <p className="text-xs tracking-wide text-mute uppercase">Auszeichnungen</p>
      <p className="mt-1 text-xs text-dim">
        {erreicht.size} von {AUSZEICHNUNG_REIHENFOLGE.length} freigeschaltet. Einmal verdient, bleiben sie für immer. Mit der Maus über eine
        Medaille fahren zeigt, was dafür nötig ist.
      </p>
      {AUSZEICHNUNG_GRUPPEN.map((g) => {
        const typen = AUSZEICHNUNG_REIHENFOLGE.filter((t) => AUSZEICHNUNGEN[t].gruppe === g.id)
        const geschafft = typen.filter((t) => erreicht.has(t)).length
        return (
          <div key={g.id} className="mt-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm">
                {g.titel} <span className="text-xs text-dim">{g.hinweis}</span>
              </p>
              <p className="text-xs text-dim">
                {geschafft}/{typen.length}
              </p>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6 md:grid-cols-8">
              {typen.map((typ: AuszeichnungTyp) => {
                const a = erreicht.get(typ)
                const info = AUSZEICHNUNGEN[typ]
                return (
                  <div key={typ} className="flex flex-col items-center text-center" title={info.text}>
                    <AuszeichnungBild typ={typ} erreicht={!!a} groesse={62} />
                    <p className={`mt-1.5 text-xs leading-tight ${a ? 'text-ink' : 'text-mute'}`}>{info.titel}</p>
                    <p className="mt-0.5 text-[11px] text-dim">{a ? kurzDatum(a.wocheStart) : 'offen'}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </Karte>
  )
}

/** Gemerkt: rendert nur neu, wenn sich die Eingaben ändern; die Statusmeldung alle 5 s rendert sonst jedes Diagramm mit. */
export const Auszeichnungen = memo(AuszeichnungenInnen)
