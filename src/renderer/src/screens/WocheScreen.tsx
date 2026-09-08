import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Block, Ziel } from '@shared/typen'
import { taetigkeitSchluessel } from '@shared/regeln'
import {
  MAX_RANG,
  STANDARD_GESAMTZIEL,
  bisNaechsterRang,
  rang,
  rangName,
  rangSchwelle,
  tagesrichtwert,
  verbleibendeArbeitstage,
  zielRang
} from '@shared/rang'
import { berlinDatum, datumVerschieben, datumZuTagesanfang, kalenderwoche, wochenanfang } from '@shared/zeit'
import { AnimierteZahl } from '../components/AnimierteZahl'
import { BlockDialog } from '../components/BlockDialog'
import { hinweisZeigen } from '../components/Hinweis'
import { Karte } from '../components/Karte'
import { RangAbzeichen } from '../components/RangAbzeichen'
import { RangRing } from '../components/RangRing'
import { TaetigkeitenListe, type TaetigkeitEintrag } from '../components/TaetigkeitenListe'
import { WochenBalken, type TagesWerte } from '../components/WochenBalken'
import { useErfassung } from '../erfassung'
import { datumText, kurzDatum, stundenText } from '../format'
import { useTaetigkeiten } from '../taetigkeiten'

const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const AUFFAELLIG_MS = 2 * 3600_000

/** Sekunden eines Blocks innerhalb eines Zeitfensters. */
function anteil(block: Block, von: number, bis: number): number {
  const s = Math.max(Date.parse(block.start), von)
  const e = Math.min(Date.parse(block.ende), bis)
  return e > s ? (e - s) / 1000 : 0
}

/** Screen 2: Woche. Rang-Ring, Wochenbalken, Tätigkeiten gegen ihre Ziele, Restlaufzeit, Woche durchgehen. */
export function WocheScreen(): ReactElement {
  const status = useErfassung()
  const taetigkeiten = useTaetigkeiten()
  const [jetzt, setJetzt] = useState(() => Date.now())
  const [wochenStart, setWochenStart] = useState(() => wochenanfang(new Date()))
  const [bloecke, setBloecke] = useState<Block[]>([])
  const [ziele, setZiele] = useState<Ziel[]>([])
  const [durchgehen, setDurchgehen] = useState<{ liste: Block[]; index: number } | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setJetzt(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const startDatum = berlinDatum(wochenStart)
  const endDatum = datumVerschieben(startDatum, 6)
  const wochenEnde = useMemo(() => datumZuTagesanfang(datumVerschieben(startDatum, 7)), [startDatum])
  const aktuelleWoche = wochenStart.getTime() === wochenanfang(new Date(jetzt)).getTime()

  const laden = useCallback(async () => {
    if (!window.api) return
    const [liste, eigeneZiele] = await Promise.all([
      window.api.bloecke.zeitraum(wochenStart.toISOString(), wochenEnde.toISOString()),
      window.api.ziele.eigene()
    ])
    setBloecke(liste)
    setZiele(eigeneZiele)
  }, [wochenStart, wochenEnde])

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

  // Tageswerte für die Balken
  const tage = useMemo<TagesWerte[]>(() => {
    return TAGE.map((label, i) => {
      const datum = datumVerschieben(startDatum, i)
      const von = datumZuTagesanfang(datum).getTime()
      const bis = datumZuTagesanfang(datumVerschieben(datum, 1)).getTime()
      const summe = { produktiv: 0, unproduktiv: 0, ungeklaert: 0, inaktiv: 0 }
      for (const b of bloecke) summe[b.bewertung] += anteil(b, von, bis)
      return {
        label,
        titel: datumText(datum),
        produktiv: summe.produktiv / 3600,
        unproduktiv: summe.unproduktiv / 3600,
        ungeklaert: summe.ungeklaert / 3600,
        inaktiv: summe.inaktiv / 3600
      }
    })
  }, [bloecke, startDatum])

  const berechnetProduktiv = useMemo(
    () => bloecke.filter((b) => b.bewertung === 'produktiv').reduce((s, b) => s + anteil(b, wochenStart.getTime(), wochenEnde.getTime()), 0),
    [bloecke, wochenStart, wochenEnde]
  )
  const produktiv = aktuelleWoche ? status.wocheProduktivSekunden : berechnetProduktiv

  const gesamtziel = ziele.find((z) => z.taetigkeit === null)?.stundenProWoche ?? STANDARD_GESAMTZIEL
  const ziel = zielRang(gesamtziel)
  const aktuellerRang = rang(produktiv)
  const geschafft = aktuellerRang >= ziel
  const bisNaechster = bisNaechsterRang(produktiv)

  // Tätigkeiten der Woche, absteigend nach Stunden, mit Ziel falls vorhanden
  const eintraege = useMemo<TaetigkeitEintrag[]>(() => {
    const summen = new Map<string, TaetigkeitEintrag>()
    for (const b of bloecke) {
      if (b.bewertung !== 'produktiv' || !b.taetigkeit) continue
      const s = taetigkeitSchluessel(b.taetigkeit)
      const e = summen.get(s) ?? { name: b.taetigkeit, sekunden: 0, zielSekunden: null }
      e.sekunden += anteil(b, wochenStart.getTime(), wochenEnde.getTime())
      summen.set(s, e)
    }
    for (const z of ziele) {
      if (!z.taetigkeit) continue
      const s = taetigkeitSchluessel(z.taetigkeit)
      const e = summen.get(s) ?? { name: z.taetigkeit, sekunden: 0, zielSekunden: null }
      e.zielSekunden = z.stundenProWoche * 3600
      summen.set(s, e)
    }
    return [...summen.values()].sort((a, b) => b.sekunden - a.sekunden)
  }, [bloecke, ziele, wochenStart, wochenEnde])

  // Rang-Zeile unter dem Ring
  let rangText: string
  if (aktuellerRang >= MAX_RANG) {
    rangText = `Rang ${MAX_RANG} · ${rangName(MAX_RANG)}. Höher geht es nicht.`
  } else if (geschafft) {
    rangText = `Rang ${aktuellerRang} · ${rangName(aktuellerRang)}, Woche geschafft. Noch ${stundenText(bisNaechster ?? 0)} h bis Rang ${
      aktuellerRang + 1
    } · ${rangName(aktuellerRang + 1)}.`
  } else {
    rangText = `Rang ${aktuellerRang} · ${rangName(aktuellerRang)}, noch ${stundenText(bisNaechster ?? 0)} h bis Rang ${
      aktuellerRang + 1
    } · ${rangName(aktuellerRang + 1)}.`
  }

  // Restlaufzeit, nur in der laufenden Woche
  let restlaufzeit: string | null = null
  if (aktuelleWoche && !geschafft) {
    const rest = rangSchwelle(ziel) - produktiv
    const tageUebrig = verbleibendeArbeitstage(new Date(jetzt))
    restlaufzeit =
      tageUebrig === 0
        ? `Wochenende. Noch ${stundenText(rest)} h bis Rang ${ziel}.`
        : `Noch ${stundenText(rest)} h bis Rang ${ziel}, bei ${tageUebrig} verbleibenden ${
            tageUebrig === 1 ? 'Tag' : 'Tagen'
          } sind das ${stundenText(rest / tageUebrig)} h pro Tag.`
  }

  // Auffällige Blöcke: ungeklärt, sehr lang, jeweils noch nicht von Hand geprüft
  const auffaellige = useMemo(
    () =>
      bloecke
        .filter(
          (b) =>
            b.quelle === 'auto' &&
            !b.manuellGeprueft &&
            b.id !== status.laufenderBlock?.id &&
            (b.bewertung === 'ungeklaert' || Date.parse(b.ende) - Date.parse(b.start) > AUFFAELLIG_MS)
        )
        .sort((a, b) => a.start.localeCompare(b.start)),
    [bloecke, status.laufenderBlock?.id]
  )

  function weiterDurchgehen(): void {
    setDurchgehen((d) => {
      if (!d) return null
      if (d.index + 1 >= d.liste.length) {
        hinweisZeigen('Woche durchgegangen, alles sauber.')
        return null
      }
      return { ...d, index: d.index + 1 }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setWochenStart((w) => datumZuTagesanfang(datumVerschieben(berlinDatum(w), -7)))}
          className="rounded-chip p-2 text-mute transition-colors hover:bg-panel hover:text-ink"
          title="Vorherige Woche"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => setWochenStart(wochenanfang(new Date()))}
          className="text-sm text-mute transition-colors hover:text-ink"
          title="Zur aktuellen Woche"
        >
          KW {kalenderwoche(wochenStart)} · {kurzDatum(startDatum)} bis {kurzDatum(endDatum)}
          {aktuelleWoche && ' · diese Woche'}
        </button>
        <button
          type="button"
          onClick={() => setWochenStart((w) => datumZuTagesanfang(datumVerschieben(berlinDatum(w), 7)))}
          disabled={aktuelleWoche}
          className="rounded-chip p-2 text-mute transition-colors hover:bg-panel hover:text-ink disabled:opacity-0"
          title="Nächste Woche"
        >
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </section>

      <section className="flex flex-col items-center">
        <RangRing produktivSekunden={produktiv} zielRang={ziel}>
          <RangAbzeichen rang={aktuellerRang} groesse={52} />
          <p className="mt-1 text-[48px] leading-none font-light">
            <AnimierteZahl wert={aktuellerRang} format={(n) => String(Math.round(n))} />
          </p>
          <p className="text-sm text-mute">{rangName(aktuellerRang)}</p>
          <p className="mt-2 text-sm text-mute">
            <AnimierteZahl wert={produktiv} format={stundenText} /> h produktiv
          </p>
        </RangRing>
        <p className={`mt-4 text-center text-sm ${geschafft ? 'text-produktiv' : 'text-mute'}`}>{rangText}</p>
        {restlaufzeit && <p className="mt-1 text-center text-sm text-dim">{restlaufzeit}</p>}
      </section>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Montag bis Sonntag</p>
        <div className="mt-3">
          <WochenBalken tage={tage} richtwert={tagesrichtwert(gesamtziel)} />
        </div>
      </Karte>

      <Karte>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs tracking-wide text-mute uppercase">Tätigkeiten der Woche</p>
          {auffaellige.length > 0 && (
            <button
              type="button"
              onClick={() => setDurchgehen({ liste: auffaellige, index: 0 })}
              className="rounded-chip bg-panel-2 px-3 py-1.5 text-sm text-ink transition-colors hover:bg-inaktiv"
            >
              Woche durchgehen ({auffaellige.length})
            </button>
          )}
        </div>
        <TaetigkeitenListe eintraege={eintraege} />
      </Karte>

      {durchgehen && (
        <BlockDialog
          key={durchgehen.liste[durchgehen.index].id}
          block={durchgehen.liste[durchgehen.index]}
          taetigkeiten={taetigkeiten}
          fortschritt={{ nummer: durchgehen.index + 1, gesamt: durchgehen.liste.length }}
          onSchliessen={() => setDurchgehen(null)}
          onGespeichert={() => {
            void laden()
            weiterDurchgehen()
          }}
          onUeberspringen={weiterDurchgehen}
        />
      )}
    </div>
  )
}
