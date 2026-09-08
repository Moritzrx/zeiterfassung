import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Block } from '@shared/typen'
import { berlinDatum, datumVerschieben, datumZuTagesanfang, naechsterTagesanfang } from '@shared/zeit'
import { AnimierteZahl } from '../components/AnimierteZahl'
import { BlockZeile } from '../components/BlockZeile'
import { Karte } from '../components/Karte'
import { TagesRing, type RingAnteile } from '../components/TagesRing'
import { useErfassung, useSekundentakt } from '../erfassung'
import { datumText, laufzeitText, stundenText } from '../format'

/** Sekunden je Bewertung innerhalb eines Tages, am Rand anteilig. */
function anteileBerechnen(bloecke: Block[], datum: string): RingAnteile {
  const von = datumZuTagesanfang(datum).getTime()
  const bis = naechsterTagesanfang(new Date(von)).getTime()
  const summe: RingAnteile = { produktiv: 0, unproduktiv: 0, inaktiv: 0, ungeklaert: 0 }
  for (const b of bloecke) {
    const s = Math.max(Date.parse(b.start), von)
    const e = Math.min(Date.parse(b.ende), bis)
    if (e > s) summe[b.bewertung] += (e - s) / 1000
  }
  return summe
}

/** Screen 1: Heute. Tages-Ring mit produktiven Stunden, laufender Block, Ungeklärt-Hinweis, Tagesliste. */
export function HeuteScreen(): ReactElement {
  const status = useErfassung()
  const jetzt = useSekundentakt()
  const heute = berlinDatum(new Date(jetzt))
  const [datum, setDatum] = useState(heute)
  const [bloecke, setBloecke] = useState<Block[]>([])
  const [ungeklaert, setUngeklaert] = useState(0)
  const istHeute = datum === heute

  const laden = useCallback(async () => {
    if (!window.api) return
    const [liste, offen] = await Promise.all([window.api.bloecke.tag(datum), window.api.bloecke.ungeklaert()])
    setBloecke(liste)
    setUngeklaert(offen)
  }, [datum])

  useEffect(() => {
    void laden()
    if (!window.api) return
    const abmelden = window.api.bloecke.onAenderung(() => void laden())
    const timer = setInterval(() => void laden(), 10_000)
    return () => {
      abmelden()
      clearInterval(timer)
    }
  }, [laden])

  const anteile = useMemo(() => anteileBerechnen(bloecke, datum), [bloecke, datum])
  const produktiv = istHeute ? status.heuteProduktivSekunden : anteile.produktiv
  const laufend = istHeute ? status.laufenderBlock : null
  const laufzeit = laufend ? (jetzt - Date.parse(laufend.start)) / 1000 : 0
  const liste = useMemo(() => {
    const sortiert = [...bloecke].sort((a, b) => a.start.localeCompare(b.start))
    return istHeute ? sortiert.reverse() : sortiert
  }, [bloecke, istHeute])
  const laufendeId = laufend ? liste.find((b) => b.start === laufend.start)?.id : undefined

  let geradeText = 'Keine Erfassung aktiv'
  if (status.zustand === 'inaktiv') geradeText = 'Inaktiv, keine Eingabe seit mehr als 3 Minuten'
  else if (status.zustand === 'abwesend') geradeText = 'Abwesend'
  else if (status.zustand === 'pausiert') geradeText = 'Pausiert'
  else if (status.zustand === 'laeuft' && !laufend) geradeText = 'Kein Fenster im Vordergrund'

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setDatum((d) => datumVerschieben(d, -1))}
          className="rounded-chip p-2 text-mute transition-colors hover:bg-panel hover:text-ink"
          title="Vorheriger Tag"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => setDatum(heute)}
          className="text-sm text-mute transition-colors hover:text-ink"
          title="Zu heute"
        >
          {istHeute ? 'Heute' : datumText(datum)}
        </button>
        <button
          type="button"
          onClick={() => setDatum((d) => datumVerschieben(d, 1))}
          disabled={istHeute}
          className="rounded-chip p-2 text-mute transition-colors hover:bg-panel hover:text-ink disabled:opacity-0"
          title="Nächster Tag"
        >
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </section>

      <section className="flex flex-col items-center pb-2">
        <TagesRing anteile={anteile}>
          <p className="text-[56px] leading-none font-light">
            <AnimierteZahl wert={produktiv} format={stundenText} />
            <span className="ml-1 text-2xl text-mute">h</span>
          </p>
          <p className="mt-2 text-sm text-mute">produktiv</p>
        </TagesRing>
      </section>

      {istHeute && (
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
      )}

      {ungeklaert > 0 && (
        <Karte className="flex items-center justify-between">
          <div>
            <p className="text-sm">
              {ungeklaert} {ungeklaert === 1 ? 'Block' : 'Blöcke'} noch nicht eingeordnet
            </p>
            <p className="text-xs text-dim">Zuordnen per Klick kommt in Schritt 5.</p>
          </div>
          <span className="inline-block h-2 w-2 rounded-full border border-ungeklaert" />
        </Karte>
      )}

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">
          {istHeute ? 'Blöcke heute' : `Blöcke am ${datumText(datum)}`}
        </p>
        {liste.length === 0 ? (
          <p className="mt-2 text-sm text-dim">Keine Blöcke an diesem Tag.</p>
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
