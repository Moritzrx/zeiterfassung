import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Bewertung, Block } from '@shared/typen'
import {
  berlinDatum,
  datumVerschieben,
  datumZuTagesanfang,
  naechsterTagesanfang,
  wochenanfang
} from '@shared/zeit'
import { AnimierteZahl } from '../components/AnimierteZahl'
import { BlockDialog } from '../components/BlockDialog'
import { BlockZeile } from '../components/BlockZeile'
import { hinweisZeigen } from '../components/Hinweis'
import { Karte } from '../components/Karte'
import { Mehrfachleiste } from '../components/Mehrfachleiste'
import { TagesRing, type RingAnteile } from '../components/TagesRing'
import { UngeklaertPostfach } from '../components/UngeklaertPostfach'
import { useErfassung, useSekundentakt } from '../erfassung'
import { datumText, laufzeitText, stundenText } from '../format'
import { useTaetigkeiten } from '../taetigkeiten'

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

/** Screen 1: Heute. Tages-Ring, laufender Block, Ungeklärt-Postfach, Tagesliste mit Bearbeiten und Mehrfachauswahl. */
export function HeuteScreen(): ReactElement {
  const status = useErfassung()
  const jetzt = useSekundentakt()
  const taetigkeiten = useTaetigkeiten()
  const heute = berlinDatum(new Date(jetzt))
  const [datum, setDatum] = useState(heute)
  const [bloecke, setBloecke] = useState<Block[]>([])
  const [ungeklaert, setUngeklaert] = useState(0)
  const [stand, setStand] = useState(0)
  const [bearbeiten, setBearbeiten] = useState<Block | null>(null)
  const [durchgehen, setDurchgehen] = useState<{ liste: Block[]; index: number } | null>(null)
  const [auswahl, setAuswahl] = useState<Set<string> | null>(null)
  const istHeute = datum === heute

  const laden = useCallback(async () => {
    if (!window.api) return
    const [liste, offen] = await Promise.all([window.api.bloecke.tag(datum), window.api.bloecke.ungeklaert()])
    setBloecke(liste)
    setUngeklaert(offen)
    setStand((s) => s + 1)
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

  let geradeText = 'Keine Erfassung aktiv'
  if (status.zustand === 'inaktiv') geradeText = 'Inaktiv, keine Eingabe seit mehr als 3 Minuten'
  else if (status.zustand === 'abwesend') geradeText = 'Abwesend'
  else if (status.zustand === 'pausiert') geradeText = 'Pausiert'
  else if (status.zustand === 'laeuft' && !laufend) geradeText = 'Kein Fenster im Vordergrund'

  function zeileKlick(block: Block): void {
    if (auswahl) {
      const neu = new Set(auswahl)
      if (neu.has(block.id)) neu.delete(block.id)
      else neu.add(block.id)
      setAuswahl(neu)
    } else {
      setBearbeiten(block)
    }
  }

  async function mehrere(aenderung: { taetigkeit?: string; bewertung?: Bewertung; loeschen?: boolean }): Promise<void> {
    if (!window.api || !auswahl || auswahl.size === 0) return
    const n = await window.api.bloecke.mehrereAendern([...auswahl], aenderung)
    hinweisZeigen(aenderung.loeschen ? `${n} Blöcke gelöscht.` : `${n} Blöcke geändert.`)
    setAuswahl(new Set())
  }

  async function alleMitProgramm(): Promise<void> {
    if (!window.api || !auswahl) return
    const erster = liste.find((b) => auswahl.has(b.id))
    if (!erster?.programm) return
    const von = wochenanfang(new Date(jetzt)).toISOString()
    const alle = await window.api.bloecke.zeitraum(von, new Date(jetzt).toISOString())
    const neu = new Set(auswahl)
    for (const b of alle) {
      if (b.quelle === 'auto' && b.programm === erster.programm && b.bewertung !== 'inaktiv' && b.id !== laufend?.id) {
        neu.add(b.id)
      }
    }
    setAuswahl(neu)
    hinweisZeigen(`${neu.size} Blöcke mit „${erster.programm}“ ausgewählt, auch an anderen Tagen dieser Woche.`)
  }

  function weiterDurchgehen(): void {
    setDurchgehen((d) => {
      if (!d) return null
      if (d.index + 1 >= d.liste.length) {
        hinweisZeigen('Alles durchgegangen.')
        return null
      }
      return { ...d, index: d.index + 1 }
    })
  }

  const auswahlProgramm = auswahl ? (liste.find((b) => auswahl.has(b.id))?.programm ?? null) : null
  const dialogBlock = durchgehen ? durchgehen.liste[durchgehen.index] : bearbeiten

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
        <button type="button" onClick={() => setDatum(heute)} className="text-sm text-mute transition-colors hover:text-ink" title="Zu heute">
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
                <p className="truncate text-lg">
                  {laufend.programm ?? 'Unbekanntes Programm'}
                  {laufend.taetigkeit && <span className="ml-2 text-sm text-mute">· {laufend.taetigkeit}</span>}
                </p>
                {laufend.fenstertitel && <p className="truncate text-sm text-mute">{laufend.fenstertitel}</p>}
              </div>
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  laufend.bewertung === 'produktiv'
                    ? 'bg-produktiv'
                    : laufend.bewertung === 'unproduktiv'
                      ? 'bg-unproduktiv'
                      : 'border border-ungeklaert'
                }`}
              />
              <p className="text-2xl font-light">{laufzeitText(laufzeit)}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-dim">{geradeText}</p>
          )}
        </Karte>
      )}

      <UngeklaertPostfach
        anzahl={ungeklaert}
        stand={stand}
        onOeffnen={setBearbeiten}
        onDurchgehen={(l) => {
          if (l.length) setDurchgehen({ liste: l, index: 0 })
        }}
      />

      <Karte>
        <div className="flex items-center justify-between">
          <p className="text-xs tracking-wide text-mute uppercase">
            {istHeute ? 'Blöcke heute' : `Blöcke am ${datumText(datum)}`}
          </p>
          {liste.length > 0 && (
            <button
              type="button"
              onClick={() => setAuswahl(auswahl ? null : new Set())}
              className="text-xs text-mute transition-colors hover:text-ink"
            >
              {auswahl ? 'Auswahl beenden' : 'Auswählen'}
            </button>
          )}
        </div>
        {liste.length === 0 ? (
          <p className="mt-2 text-sm text-dim">Keine Blöcke an diesem Tag.</p>
        ) : (
          <div className="mt-1 divide-y divide-panel-2">
            {liste.map((b) => (
              <BlockZeile
                key={b.id}
                block={b}
                laeuft={b.id === laufend?.id}
                onClick={() => zeileKlick(b)}
                auswahlModus={auswahl !== null}
                ausgewaehlt={auswahl?.has(b.id) ?? false}
              />
            ))}
          </div>
        )}
        {auswahl && <div className="h-16" />}
      </Karte>

      {auswahl && (
        <Mehrfachleiste
          anzahl={auswahl.size}
          programm={auswahlProgramm}
          taetigkeiten={taetigkeiten}
          onTaetigkeit={(name) => void mehrere({ taetigkeit: name })}
          onBewertung={(bewertung) => void mehrere({ bewertung })}
          onLoeschen={() => void mehrere({ loeschen: true })}
          onAlleMitProgramm={() => void alleMitProgramm()}
          onFertig={() => setAuswahl(null)}
        />
      )}

      {dialogBlock && (
        <BlockDialog
          key={dialogBlock.id}
          block={dialogBlock}
          taetigkeiten={taetigkeiten}
          fortschritt={durchgehen ? { nummer: durchgehen.index + 1, gesamt: durchgehen.liste.length } : undefined}
          onSchliessen={() => {
            setBearbeiten(null)
            setDurchgehen(null)
          }}
          onGespeichert={() => {
            void laden()
            if (durchgehen) weiterDurchgehen()
            else setBearbeiten(null)
          }}
          onUeberspringen={durchgehen ? weiterDurchgehen : undefined}
        />
      )}
    </div>
  )
}
