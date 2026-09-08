import type { ReactElement } from 'react'
import { Karte } from '../components/Karte'

/** Screen 1: Heute. Oben die produktiven Stunden des Tages, darunter der laufende Block und die Tagesliste. */
export function HeuteScreen(): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col items-center pt-8 pb-4">
        <p className="text-sm text-mute">Heute produktiv</p>
        <p className="mt-2 text-[64px] leading-none font-light">
          0,0<span className="ml-2 text-3xl text-mute">h</span>
        </p>
      </section>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Gerade</p>
        <p className="mt-2 text-sm text-dim">Keine Erfassung aktiv</p>
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Blöcke heute</p>
        <p className="mt-2 text-sm text-dim">
          Noch keine Blöcke. Die automatische Erfassung kommt in Schritt 3.
        </p>
      </Karte>
    </div>
  )
}
