import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { Block } from '@shared/typen'
import { berlinDatum } from '@shared/zeit'
import { BlockZeile } from '../components/BlockZeile'
import { Karte } from '../components/Karte'
import { useErfassung, useSekundentakt } from '../erfassung'
import { laufzeitText, stundenText } from '../format'

/** Screen 1: Heute. Oben die produktiven Stunden des Tages, darunter der laufende Block und die Tagesliste. */
export function HeuteScreen(): ReactElement {
  const status = useErfassung()
  const jetzt = useSekundentakt()
  const [bloecke, setBloecke] = useState<Block[]>([])

  const laden = useCallback(async () => {
    if (!window.api) return
    setBloecke(await window.api.bloecke.tag(berlinDatum(new Date())))
  }, [])

  useEffect(() => {
    void laden()
    if (!window.api) return
    const abmelden = window.api.bloecke.onAenderung(() => void laden())
    const timer = setInterval(() => void laden(), 30_000)
    return () => {
      abmelden()
      clearInterval(timer)
    }
  }, [laden])

  const laufend = status.laufenderBlock
  const laufzeit = laufend ? (jetzt - Date.parse(laufend.start)) / 1000 : 0
  const liste = [...bloecke].sort((a, b) => b.start.localeCompare(a.start))
  const laufendeId = liste.find((b) => laufend && b.start === laufend.start)?.id

  let geradeText = 'Keine Erfassung aktiv'
  if (status.zustand === 'inaktiv') geradeText = 'Inaktiv, keine Eingabe seit mehr als 3 Minuten'
  else if (status.zustand === 'abwesend') geradeText = 'Abwesend'
  else if (status.zustand === 'pausiert') geradeText = 'Pausiert'
  else if (status.zustand === 'laeuft' && !laufend) geradeText = 'Kein Fenster im Vordergrund'

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col items-center pt-8 pb-4">
        <p className="text-sm text-mute">Heute produktiv</p>
        <p className="mt-2 text-[64px] leading-none font-light">
          {stundenText(status.heuteProduktivSekunden)}
          <span className="ml-2 text-3xl text-mute">h</span>
        </p>
      </section>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Gerade</p>
        {laufend ? (
          <div className="mt-2 flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg">{laufend.programm ?? 'Unbekanntes Programm'}</p>
              {laufend.fenstertitel && <p className="truncate text-sm text-mute">{laufend.fenstertitel}</p>}
            </div>
            <p className="text-2xl font-light">{laufzeitText(laufzeit)}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-dim">{geradeText}</p>
        )}
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Blöcke heute</p>
        {liste.length === 0 ? (
          <p className="mt-2 text-sm text-dim">Noch keine Blöcke heute.</p>
        ) : (
          <div className="mt-1 divide-y divide-panel-2">
            {liste.map((b) => (
              <BlockZeile key={b.id} block={b} laeuft={b.id === laufendeId} />
            ))}
          </div>
        )}
      </Karte>
    </div>
  )
}
