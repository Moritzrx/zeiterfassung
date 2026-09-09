import { useCallback, useEffect, useState, type ReactElement } from 'react'
import {
  LIGA_FARBEN,
  LIGA_START_TROPHAEEN,
  deltaText,
  liga,
  ligaDelta,
  ligaFortschritt,
  naechsteLiga,
  neutralStunden,
  urlaubstageInWoche
} from '@shared/liga'
import type { LigaStand, Urlaub } from '@shared/typen'
import { berlinDatum, wochenanfang } from '@shared/zeit'
import { fehlerText, kurzDatum, stundenText, zahlText } from '../format'
import { hinweisZeigen } from './Hinweis'
import { Karte } from './Karte'
import { LigaAbzeichen } from './LigaAbzeichen'
import { LigaUebersicht } from './LigaUebersicht'

interface Props {
  /** produktive Sekunden der laufenden Woche, für die Vorschau */
  produktivSekunden: number
  gesamtziel: number
}

const SCHLUESSEL = 'liga.zuletzt.'

/** Die eigene Liga auf dem Wochen-Screen: Abzeichen, Trophäen, Fortschritt zur nächsten Liga, Vorschau der Woche. */
export function LigaKarte({ produktivSekunden, gesamtziel }: Props): ReactElement {
  const [eigene, setEigene] = useState<LigaStand | null>(null)
  const [urlaube, setUrlaube] = useState<Urlaub[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const [uebersichtOffen, setUebersichtOffen] = useState(false)

  const laden = useCallback(async () => {
    if (!window.api) return
    try {
      const [stand, eigeneUrlaube] = await Promise.all([
        window.api.liga.stand(),
        window.api.urlaub.eigene().catch(() => [] as Urlaub[])
      ])
      setUrlaube(eigeneUrlaube)
      const ich = stand.find((s) => s.istIch) ?? null
      setEigene(ich)
      setFehler(null)
      // Auf- oder Abstieg seit dem letzten Blick kurz melden.
      if (ich) {
        try {
          const schluessel = SCHLUESSEL + ich.userId
          const vorher = localStorage.getItem(schluessel)
          const jetzt = liga(ich.trophaeen)
          if (vorher !== null && Number(vorher) !== jetzt.index) {
            hinweisZeigen(Number(vorher) < jetzt.index ? `Aufstieg in die ${jetzt.name}!` : `Abstieg in die ${jetzt.name}.`)
          }
          localStorage.setItem(schluessel, String(jetzt.index))
        } catch {
          /* localStorage nicht verfügbar */
        }
      }
    } catch (e) {
      setFehler(fehlerText(e))
    }
  }, [])

  useEffect(() => {
    void laden()
    const timer = setInterval(() => void laden(), 5 * 60_000)
    return () => clearInterval(timer)
  }, [laden])

  const trophaeen = eigene?.trophaeen ?? LIGA_START_TROPHAEEN
  const l = liga(trophaeen)
  const naechste = naechsteLiga(trophaeen)
  const fortschritt = ligaFortschritt(trophaeen)
  const farbe = LIGA_FARBEN[l.stufe]
  // Urlaubstage dieser Woche senken die Erwartung anteilig.
  const urlaubstage = urlaubstageInWoche(berlinDatum(wochenanfang(new Date())), urlaube)
  const neutral = neutralStunden(gesamtziel, urlaubstage)
  const vorschau = ligaDelta(produktivSekunden, gesamtziel, urlaubstage)
  // Bis zum neutralen Punkt fehlende Stunden, damit ein Minus am Wochenanfang nicht entmutigt.
  const bisNeutral = Math.max(0, neutral * 3600 - produktivSekunden)

  return (
    <Karte>
      <div className="flex items-center gap-5">
        <LigaAbzeichen liga={l} groesse={72} />
        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-wide text-mute uppercase">Liga</p>
          <p className="mt-0.5 text-xl">{l.name}</p>
          <p className="text-sm text-mute">
            {zahlText(trophaeen, 0)} Trophäen
            {naechste && <span className="text-dim"> · noch {zahlText(naechste.ab - trophaeen, 0)} bis {naechste.name}</span>}
          </p>
          <div className="mt-3 h-1.5 w-full rounded-full bg-panel-2">
            <div
              className="h-full rounded-full transition-[width] duration-700 [transition-timing-function:var(--ease-federnd)]"
              style={{ width: `${fortschritt * 100}%`, backgroundColor: farbe, boxShadow: `0 0 10px ${farbe}80` }}
            />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-mute">Diese Woche bisher</p>
          <p className={`text-2xl font-light ${vorschau > 0 ? 'text-produktiv' : vorschau < 0 ? 'text-unproduktiv' : 'text-mute'}`}>
            {deltaText(vorschau)}
          </p>
          <p className="text-xs text-dim">
            {urlaubstage >= 5
              ? 'ganze Woche Urlaub, kostet nichts'
              : vorschau < 0
                ? `noch ${stundenText(bisNeutral)} h bis ±0`
                : 'zählt nach Sonntag'}
          </p>
          {urlaubstage > 0 && urlaubstage < 5 && (
            <p className="text-xs text-dim">
              {urlaubstage} {urlaubstage === 1 ? 'Urlaubstag' : 'Urlaubstage'}, Erwartung {stundenText(neutral * 3600)} h
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-dim">
        <span>
          {fehler
            ? fehler
            : eigene?.letzteWoche && eigene.letztesDelta !== null
              ? `Woche ab ${kurzDatum(eigene.letzteWoche)}: ${deltaText(eigene.letztesDelta)} · ${eigene.wochen} ${
                  eigene.wochen === 1 ? 'Woche' : 'Wochen'
                } gezählt`
              : 'Noch keine Woche gezählt. Die erste zählt nach dem kommenden Sonntag.'}
        </span>
        <button
          type="button"
          onClick={() => setUebersichtOffen(true)}
          className="shrink-0 rounded-chip px-3 py-1.5 text-xs text-mute transition-colors hover:bg-panel-2 hover:text-ink"
        >
          Alle Ligen
        </button>
      </div>

      {uebersichtOffen && <LigaUebersicht trophaeen={trophaeen} gesamtziel={gesamtziel} onSchliessen={() => setUebersichtOffen(false)} />}
    </Karte>
  )
}
