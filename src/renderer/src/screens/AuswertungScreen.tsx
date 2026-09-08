import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { gleitenderSchnitt, hochrechnungBerechnen } from '@shared/auswertung'
import { STANDARD_GESAMTZIEL, zielRang } from '@shared/rang'
import { produktivJeTagAusSummen, verteilungAusSummen, wochenRangAusSummen } from '@shared/summen'
import type { Block, Profil, Tagessumme, Ziel } from '@shared/typen'
import { berlinDatum, datumVerschieben, wochenanfang } from '@shared/zeit'
import { HochrechnungKarte } from '../components/HochrechnungKarte'
import { Karte } from '../components/Karte'
import { MonatsVerlauf, type Monatswert } from '../components/MonatsVerlauf'
import { TrendBalken, type Trendwert } from '../components/TrendBalken'
import { VerteilungsRing } from '../components/VerteilungsRing'
import { datumText, kurzDatum, stundenText } from '../format'

const ZEITRAEUME = [
  { tage: 7, label: '7 Tage' },
  { tage: 30, label: '30 Tage' },
  { tage: 84, label: '12 Wochen' },
  { tage: 182, label: '6 Monate' },
  { tage: 365, label: '12 Monate' }
] as const

const SCHNITT_FENSTER = 7
const LOKALE_WOCHEN = 13
const SPEICHER_SCHLUESSEL = 'auswertung.zeitraum'

function gespeicherterZeitraum(): number {
  try {
    const wert = Number(localStorage.getItem(SPEICHER_SCHLUESSEL))
    return ZEITRAEUME.some((z) => z.tage === wert) ? wert : 30
  } catch {
    return 30
  }
}

/** Screen 3: Auswertung. Zeitraum wählbar; Verlauf, Trend und Verteilung folgen ihm, die Hochrechnung bleibt bei 28 Tagen. */
export function AuswertungScreen(): ReactElement {
  const [tage, setTage] = useState<number>(gespeicherterZeitraum)
  const [summen, setSummen] = useState<Tagessumme[]>([])
  const [summenFehler, setSummenFehler] = useState<string | null>(null)
  const [bloecke, setBloecke] = useState<Block[]>([])
  const [ziele, setZiele] = useState<Ziel[]>([])
  const [profil, setProfil] = useState<Profil | null>(null)
  const [jetzt, setJetzt] = useState(() => Date.now())

  const heute = berlinDatum(new Date(jetzt))
  // Der Trend zeigt mindestens 12 Wochen, bei langen Zeiträumen entsprechend mehr.
  const wochen = Math.min(52, Math.max(12, Math.round(tage / 7)))
  // Verlauf braucht 6 Tage Vorlauf für den Schnitt, der Trend ganze Wochen vor der laufenden.
  const verlaufAb = datumVerschieben(heute, -(tage + SCHNITT_FENSTER - 2))
  const trendAb = datumVerschieben(berlinDatum(wochenanfang(new Date(jetzt))), -wochen * 7)
  const vonDatum = verlaufAb < trendAb ? verlaufAb : trendAb

  const laden = useCallback(async () => {
    if (!window.api) return
    const bis = new Date()
    const lokalVon = new Date(bis.getTime() - LOKALE_WOCHEN * 7 * 86_400_000)
    const [liste, eigeneZiele, eigenesProfil] = await Promise.all([
      window.api.bloecke.zeitraum(lokalVon.toISOString(), bis.toISOString()),
      window.api.ziele.eigene(),
      window.api.profil.eigenes()
    ])
    setBloecke(liste)
    setZiele(eigeneZiele)
    setProfil(eigenesProfil)
    setJetzt(Date.now())
    try {
      setSummen(await window.api.bloecke.tagesSummen(vonDatum, berlinDatum(bis)))
      setSummenFehler(null)
    } catch (e) {
      setSummen([])
      setSummenFehler(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(e))
    }
  }, [vonDatum])

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

  function zeitraumWaehlen(neu: number): void {
    setTage(neu)
    try {
      localStorage.setItem(SPEICHER_SCHLUESSEL, String(neu))
    } catch {
      // Merken ist optional
    }
  }

  const gesamtziel = ziele.find((z) => z.taetigkeit === null)?.stundenProWoche ?? STANDARD_GESAMTZIEL
  const ziel = zielRang(gesamtziel)
  const urlaubswochen = profil?.urlaubswochen ?? 6
  const verlaufVon = datumVerschieben(heute, -(tage - 1))

  const verlauf = useMemo<Monatswert[]>(() => {
    const mitVorlauf = produktivJeTagAusSummen(summen, datumVerschieben(verlaufVon, -(SCHNITT_FENSTER - 1)), heute)
    const schnitt = gleitenderSchnitt(
      mitVorlauf.map((t) => t.sekunden),
      SCHNITT_FENSTER
    )
    return mitVorlauf.slice(SCHNITT_FENSTER - 1).map((t, i) => ({
      label: kurzDatum(t.datum).replace(/\.\s.*$/, '.'),
      titel: datumText(t.datum),
      produktiv: t.sekunden / 3600,
      schnitt: schnitt[i + SCHNITT_FENSTER - 1] / 3600
    }))
  }, [summen, verlaufVon, heute])

  const trend = useMemo<Trendwert[]>(
    () =>
      wochenRangAusSummen(summen, new Date(jetzt), wochen).map((w) => ({
        label: `KW ${w.kw}`,
        titel: `KW ${w.kw} · ${kurzDatum(w.start)} bis ${kurzDatum(datumVerschieben(w.start, 6))}`,
        text: `${stundenText(w.sekunden)} h`,
        rang: w.rang,
        leer: w.leer
      })),
    [summen, jetzt, wochen]
  )

  const anteile = useMemo(
    () => verteilungAusSummen(summen.filter((s) => s.datum >= verlaufVon && s.datum <= heute)),
    [summen, verlaufVon, heute]
  )

  const hochrechnung = useMemo(() => hochrechnungBerechnen(bloecke, heute, urlaubswochen), [bloecke, heute, urlaubswochen])
  const zeitraumLabel = ZEITRAEUME.find((z) => z.tage === tage)?.label ?? `${tage} Tage`

  return (
    <div className="flex flex-col gap-4 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-light">Auswertung</h1>
        <div className="flex gap-1 rounded-chip bg-panel p-1">
          {ZEITRAEUME.map((z) => (
            <button
              key={z.tage}
              type="button"
              onClick={() => zeitraumWaehlen(z.tage)}
              className={`rounded-chip px-3 py-1.5 text-sm transition-colors ${
                tage === z.tage ? 'bg-panel-2 text-ink' : 'text-mute hover:text-ink'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      {summenFehler && <p className="rounded-card bg-panel p-4 text-sm text-mute">{summenFehler}</p>}

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Produktive Stunden je Tag, letzte {zeitraumLabel}</p>
        <div className="mt-3">
          <MonatsVerlauf werte={verlauf} />
        </div>
        <p className="mt-2 text-xs text-dim">Grüne Fläche: je Tag. Graue Linie: Schnitt der letzten 7 Kalendertage, Wochenende eingerechnet.</p>
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Rang je Woche, letzte {wochen} Wochen</p>
        <div className="mt-3">
          <TrendBalken werte={trend} zielRang={ziel} />
        </div>
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Verteilung der Tätigkeiten, letzte {zeitraumLabel}</p>
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
        Die Hochrechnung bleibt unabhängig vom gewählten Zeitraum immer bei den letzten 28 Tagen, damit alle Zahlen
        aus derselben Basis kommen: produktive Stunden je erfasstem Tag, mal 5 Tage die Woche, mal 4,333 Wochen im
        Monat, mal {52 - urlaubswochen} Arbeitswochen im Jahr bei {urlaubswochen} Urlaubswochen.
      </p>
    </div>
  )
}
