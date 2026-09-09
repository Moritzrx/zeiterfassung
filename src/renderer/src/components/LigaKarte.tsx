import { useCallback, useEffect, useState, type ReactElement } from 'react'
import {
  LIGA_FARBEN,
  LIGA_MAX_DELTA,
  LIGA_MIN_DELTA,
  LIGA_START_TROPHAEEN,
  deltaText,
  liga,
  ligaFortschritt,
  naechsteLiga,
  wirksamesDelta,
  wochenPrognose
} from '@shared/liga'
import type { LigaStand, Urlaub } from '@shared/typen'
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
  // Hochrechnung der laufenden Woche: bisheriger Schnitt je Arbeitstag auf den Rest übertragen.
  const p = wochenPrognose(produktivSekunden, gesamtziel, urlaube)
  const ganzeWocheUrlaub = p.urlaubstage >= 5
  // Unter 0 fällt niemand: die große Zahl zeigt, was am Stand wirklich passiert; der Regelsatz nennt den rohen Wert.
  const wirksam = wirksamesDelta(trophaeen, p.delta)
  const abgefangen = wirksam !== p.delta
  const farbeDelta = wirksam > 0 ? 'text-produktiv' : wirksam < 0 ? 'text-unproduktiv' : 'text-mute'
  const neutralText = `${stundenText(p.neutral * 3600)} h`
  let titelRechts: string
  let zahlRechts: string | null
  let kurz: string
  let regel: string
  if (ganzeWocheUrlaub) {
    titelRechts = 'Diese Woche'
    zahlRechts = deltaText(wirksam)
    kurz = 'ganze Woche Urlaub'
    regel = 'Eine ganze Urlaubswoche kostet nichts. Wer trotzdem arbeitet, bekommt Trophäen dazu, 10 je Stunde.'
  } else if (p.art === 'zu-frueh') {
    titelRechts = 'Diese Woche'
    zahlRechts = null
    kurz = 'Hochrechnung ab Montagmittag'
    regel = `Trophäen gibt es ab ${neutralText} produktiv in der Woche (dein Ziel minus 10), 10 je Stunde darüber. Jede Stunde darunter kostet 10.`
  } else {
    if (p.art === 'stand') {
      titelRechts = 'Diese Woche'
      kurz = `${stundenText(produktivSekunden)} h produktiv, zählt nach Sonntag`
    } else {
      titelRechts = 'Voraussichtlich diese Woche'
      kurz = `bisher ${stundenText(produktivSekunden)} h, hochgerechnet etwa ${stundenText(p.sekunden)} h`
    }
    zahlRechts = deltaText(wirksam)
    if (abgefangen) {
      regel = `Das wären ${deltaText(p.delta)}, aber unter 0 Trophäen fällt niemand. Trophäen gibt es ab ${neutralText} produktiv in der Woche, 10 je Stunde darüber.`
    } else if (p.delta < 0) {
      regel = `Trophäen gibt es erst ab ${neutralText} produktiv in der Woche (dein Ziel minus 10). Jede Stunde darunter kostet 10, höchstens ${LIGA_MIN_DELTA} pro Woche.`
    } else {
      regel = `Jede Stunde über ${neutralText} produktiv bringt 10 Trophäen, höchstens +${LIGA_MAX_DELTA} pro Woche. Unter ${neutralText} kostet die Woche welche.`
    }
  }
  const letzteWocheText =
    eigene?.letzteWoche && eigene.letztesDelta !== null
      ? `Woche ab ${kurzDatum(eigene.letzteWoche)}: ${deltaText(eigene.letztesDelta)}${
          eigene.letztesWirksam !== null && eigene.letztesWirksam !== eigene.letztesDelta
            ? `, am Stand ${deltaText(eigene.letztesWirksam)} (unter 0 fällt niemand)`
            : ''
        } · ${eigene.wochen} ${eigene.wochen === 1 ? 'Woche' : 'Wochen'} gezählt`
      : 'Noch keine Woche gezählt. Die erste zählt nach dem kommenden Sonntag.'

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
        <div className="max-w-[240px] shrink-0 text-right">
          <p className="text-xs text-mute">{titelRechts}</p>
          {zahlRechts === null ? (
            <p className="text-2xl font-light text-dim">–</p>
          ) : (
            <p className={`text-2xl font-light ${farbeDelta}`}>
              {zahlRechts} <span className="text-sm text-mute">Trophäen</span>
            </p>
          )}
          <p className="text-xs text-dim">{kurz}</p>
          {p.urlaubstage > 0 && !ganzeWocheUrlaub && (
            <p className="text-xs text-dim">
              {p.urlaubstage} {p.urlaubstage === 1 ? 'Urlaubstag' : 'Urlaubstage'} diese Woche
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-dim">{regel}</p>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-dim">
        <span>{fehler ?? letzteWocheText}</span>
        <button
          type="button"
          onClick={() => setUebersichtOffen(true)}
          className="shrink-0 rounded-chip px-3 py-1.5 text-xs text-mute transition-colors hover:bg-panel-2 hover:text-ink"
        >
          So funktioniert die Liga
        </button>
      </div>

      {uebersichtOffen && <LigaUebersicht trophaeen={trophaeen} gesamtziel={gesamtziel} onSchliessen={() => setUebersichtOffen(false)} />}
    </Karte>
  )
}
