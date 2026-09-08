import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  gleitenderSchnitt,
  hochrechnungBerechnen,
  produktivJeTag,
  verteilung,
  wochenLevel
} from '@shared/auswertung'
import { STANDARD_GESAMTZIEL, zielLevel } from '@shared/level'
import type { Block, Profil, Ziel } from '@shared/typen'
import { berlinDatum, datumVerschieben, datumZuTagesanfang } from '@shared/zeit'
import { HochrechnungKarte } from '../components/HochrechnungKarte'
import { Karte } from '../components/Karte'
import { MonatsVerlauf, type Monatswert } from '../components/MonatsVerlauf'
import { TrendBalken, type Trendwert } from '../components/TrendBalken'
import { VerteilungsRing } from '../components/VerteilungsRing'
import { datumText, kurzDatum, stundenText } from '../format'

const WOCHEN_ZURUECK = 13
const MONAT_TAGE = 30
const SCHNITT_FENSTER = 7

/** Screen 3: Auswertung. Monatsverlauf, Trend, Verteilung und die Hochrechnungen aus dem Tagesschnitt. */
export function AuswertungScreen(): ReactElement {
  const [bloecke, setBloecke] = useState<Block[]>([])
  const [ziele, setZiele] = useState<Ziel[]>([])
  const [profil, setProfil] = useState<Profil | null>(null)
  const [jetzt, setJetzt] = useState(() => Date.now())

  const laden = useCallback(async () => {
    if (!window.api) return
    const bis = new Date()
    const von = new Date(bis.getTime() - WOCHEN_ZURUECK * 7 * 86_400_000)
    const [liste, eigeneZiele, eigenesProfil] = await Promise.all([
      window.api.bloecke.zeitraum(von.toISOString(), bis.toISOString()),
      window.api.ziele.eigene(),
      window.api.profil.eigenes()
    ])
    setBloecke(liste)
    setZiele(eigeneZiele)
    setProfil(eigenesProfil)
    setJetzt(Date.now())
  }, [])

  useEffect(() => {
    void laden()
    if (!window.api) return
    const abmelden = window.api.bloecke.onAenderung(() => void laden())
    const timer = setInterval(() => void laden(), 60_000)
    return () => {
      abmelden()
      clearInterval(timer)
    }
  }, [laden])

  const heute = berlinDatum(new Date(jetzt))
  const gesamtziel = ziele.find((z) => z.taetigkeit === null)?.stundenProWoche ?? STANDARD_GESAMTZIEL
  const ziel = zielLevel(gesamtziel)
  const urlaubswochen = profil?.urlaubswochen ?? 6

  const monat = useMemo<Monatswert[]>(() => {
    const tage = produktivJeTag(bloecke, heute, MONAT_TAGE + SCHNITT_FENSTER - 1)
    const schnitt = gleitenderSchnitt(
      tage.map((t) => t.sekunden),
      SCHNITT_FENSTER
    )
    return tage.slice(SCHNITT_FENSTER - 1).map((t, i) => ({
      label: kurzDatum(t.datum).replace(/\.\s.*$/, '.'),
      titel: datumText(t.datum),
      produktiv: t.sekunden / 3600,
      schnitt: schnitt[i + SCHNITT_FENSTER - 1] / 3600
    }))
  }, [bloecke, heute])

  const trend = useMemo<Trendwert[]>(
    () =>
      wochenLevel(bloecke, new Date(jetzt), 12).map((w) => ({
        label: `KW ${w.kw}`,
        titel: `KW ${w.kw} · ${kurzDatum(w.start)} bis ${kurzDatum(datumVerschieben(w.start, 6))}`,
        text: `${stundenText(w.sekunden)} h`,
        level: w.level,
        leer: w.leer
      })),
    [bloecke, jetzt]
  )

  const anteile = useMemo(
    () => verteilung(bloecke, datumZuTagesanfang(datumVerschieben(heute, -(MONAT_TAGE - 1))), new Date(jetzt)),
    [bloecke, heute, jetzt]
  )

  const hochrechnung = useMemo(() => hochrechnungBerechnen(bloecke, heute, urlaubswochen), [bloecke, heute, urlaubswochen])

  return (
    <div className="flex flex-col gap-4 pt-6">
      <h1 className="text-2xl font-light">Auswertung</h1>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Produktive Stunden je Tag, letzte 30 Tage</p>
        <div className="mt-3">
          <MonatsVerlauf werte={monat} />
        </div>
        <p className="mt-2 text-xs text-dim">Grüne Fläche: je Tag. Graue Linie: Schnitt der letzten 7 Kalendertage, Wochenende eingerechnet.</p>
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Level je Woche, letzte 12 Wochen</p>
        <div className="mt-3">
          <TrendBalken werte={trend} zielLevel={ziel} />
        </div>
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Verteilung der Tätigkeiten, letzte 30 Tage</p>
        <VerteilungsRing werte={anteile} />
      </Karte>

      <h2 className="mt-2 text-lg font-light">Hochrechnung</h2>
      <HochrechnungKarte
        name={null}
        werte={hochrechnung.gesamt}
        erfassteTage={hochrechnung.erfassteTage}
        ausreichend={hochrechnung.ausreichend}
        gross
      />
      {hochrechnung.ausreichend &&
        hochrechnung.jeTaetigkeit.map((t) => (
          <HochrechnungKarte
            key={t.name}
            name={t.name}
            werte={t}
            erfassteTage={hochrechnung.erfassteTage}
            ausreichend={hochrechnung.ausreichend}
          />
        ))}
      <p className="text-xs text-dim">
        Alle Hochrechnungen kommen aus derselben Basiszahl: produktive Stunden je erfasstem Tag, mal 5 Tage die Woche, mal
        4,333 Wochen im Monat, mal {52 - urlaubswochen} Arbeitswochen im Jahr bei {urlaubswochen} Urlaubswochen.
      </p>
    </div>
  )
}
