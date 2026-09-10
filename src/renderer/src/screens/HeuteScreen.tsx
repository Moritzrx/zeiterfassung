import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { ChevronLeft, ChevronRight, Crosshair } from 'lucide-react'
import type { Bewertung, Block } from '@shared/typen'
import {
  berlinDatum,
  datumVerschieben,
  datumZuTagesanfang,
  naechsterTagesanfang,
  wochenanfang
} from '@shared/zeit'
import { anzeigeName, fensterInfo } from '@shared/fenster'
import { AnimierteZahl } from '../components/AnimierteZahl'
import { BlockDialog } from '../components/BlockDialog'
import { BlockZeile } from '../components/BlockZeile'
import { fokusDialogOeffnen } from '../components/FokusDialog'
import { wortmarkeLage } from '../components/wortmarke'
import { useHintergrundArt } from '../hintergrundart'
import { hinweisZeigen } from '../components/Hinweis'
import { tonSpielen } from '../toene'
import { Karte } from '../components/Karte'
import { Mehrfachleiste } from '../components/Mehrfachleiste'
import { TagesRing, type RingAnteile } from '../components/TagesRing'
import { UngeklaertPostfach } from '../components/UngeklaertPostfach'
import { useErfassung, useSekundentakt, useTakt } from '../erfassung'
import { datumText, laufzeitText, stundenText, uhrzeit } from '../format'
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

/** Eine Zeile der Tagesliste: ein Block oder mehrere zusammenhängende Abschnitte desselben Programms. */
interface Zeile {
  /** Kennung des ersten Blocks, dient als Schlüssel */
  id: string
  /** Was die Zeile zeigt: bei mehreren Abschnitten der längste mit der Zeitspanne der ganzen Gruppe */
  block: Block
  bloecke: Block[]
  sekunden: number
}

/** Bis zu dieser Lücke gelten zwei Blöcke desselben Programms als zusammenhängend. */
const ZEILEN_LUECKE_MS = 2 * 60_000

function blockSekunden(b: Block): number {
  return (Date.parse(b.ende) - Date.parse(b.start)) / 1000
}

/**
 * Fasst direkt aufeinanderfolgende automatische Blöcke mit gleichem Programm (bei Browsern gleicher
 * Seite), gleicher Bewertung und gleicher Tätigkeit zu einer Zeile zusammen ("5 Abschnitte"), damit die
 * Liste nicht in Vier-Minuten-Stücke zerfällt (Wunsch vom 10. September 2026). Der laufende Block bleibt
 * für sich. Erwartet die Blöcke in zeitlicher Reihenfolge.
 */
function zeilenBilden(sortiert: Block[], laufendId: string | null): Zeile[] {
  const zeilen: Zeile[] = []
  for (const b of sortiert) {
    const letzte = zeilen[zeilen.length - 1]
    const vorher = letzte?.bloecke[letzte.bloecke.length - 1]
    const passt =
      !!letzte &&
      !!vorher &&
      b.id !== laufendId &&
      vorher.id !== laufendId &&
      b.quelle === 'auto' &&
      vorher.quelle === 'auto' &&
      b.bewertung !== 'inaktiv' &&
      b.programm === vorher.programm &&
      b.bewertung === vorher.bewertung &&
      b.taetigkeit === vorher.taetigkeit &&
      fensterInfo(b.programm, b.fenstertitel).seite === fensterInfo(vorher.programm, vorher.fenstertitel).seite &&
      Date.parse(b.start) - Date.parse(vorher.ende) <= ZEILEN_LUECKE_MS
    if (passt && letzte) {
      letzte.bloecke.push(b)
      letzte.sekunden += blockSekunden(b)
    } else {
      zeilen.push({ id: b.id, block: b, bloecke: [b], sekunden: blockSekunden(b) })
    }
  }
  for (const z of zeilen) {
    if (z.bloecke.length < 2) continue
    const laengster = z.bloecke.reduce((a, b) => (blockSekunden(b) > blockSekunden(a) ? b : a))
    z.block = {
      ...laengster,
      id: z.id,
      start: z.bloecke[0].start,
      ende: z.bloecke[z.bloecke.length - 1].ende,
      manuellGeprueft: z.bloecke.every((b) => b.manuellGeprueft)
    }
  }
  return zeilen
}

/** Screen 1: Heute. Tages-Ring, laufender Block, Ungeklärt-Postfach, Tagesliste mit Bearbeiten und Mehrfachauswahl. */
export function HeuteScreen(): ReactElement {
  const status = useErfassung()
  // Nur alle 30 s, damit nicht der ganze Screen samt Liste jede Sekunde neu rendert; der laufende Zähler tickt für sich.
  const jetzt = useTakt(30_000)
  const taetigkeiten = useTaetigkeiten()
  const heute = berlinDatum(new Date(jetzt))
  const [datum, setDatum] = useState(heute)
  const [bloecke, setBloecke] = useState<Block[]>([])
  const [ungeklaert, setUngeklaert] = useState(0)
  const [stand, setStand] = useState(0)
  const [bearbeiten, setBearbeiten] = useState<Block | null>(null)
  const [gruppe, setGruppe] = useState<{ bloecke: Block[]; muster: string | null } | null>(null)
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
  const laufendName = anzeigeName(laufend?.programm, laufend?.fenstertitel)
  const liste = useMemo(() => [...bloecke].sort((a, b) => a.start.localeCompare(b.start)), [bloecke])
  const laufendId = laufend?.id ?? null
  const zeilen = useMemo(() => {
    const z = zeilenBilden(liste, laufendId)
    return istHeute ? z.reverse() : z
  }, [liste, laufendId, istHeute])

  let geradeText = 'Keine Erfassung aktiv'
  if (status.zustand === 'inaktiv') geradeText = 'Inaktiv, keine Eingabe seit mehr als 3 Minuten'
  else if (status.zustand === 'abwesend') geradeText = 'Abwesend'
  else if (status.zustand === 'pausiert') geradeText = 'Pausiert'
  else if (status.zustand === 'laeuft' && status.eigenesFenster) geradeText = 'Du bist gerade in wessamedia Zeit. Diese Zeit zählt nicht als Arbeit.'
  else if (status.zustand === 'laeuft' && !laufend) geradeText = 'Kein Fenster im Vordergrund'

  function zeileKlick(zeile: Zeile): void {
    if (auswahl) {
      // Funktionale Änderung, damit auch zwei schnelle Klicks hintereinander beide zählen.
      setAuswahl((alt) => {
        const neu = new Set(alt)
        const alleDrin = zeile.bloecke.every((b) => neu.has(b.id))
        for (const b of zeile.bloecke) {
          if (alleDrin) neu.delete(b.id)
          else neu.add(b.id)
        }
        return neu
      })
    } else if (zeile.bloecke.length > 1) {
      setGruppe({ bloecke: zeile.bloecke, muster: null })
    } else {
      setBearbeiten(zeile.bloecke[0])
    }
  }

  // Stabile Klick-Funktionen je Zeilen-Kennung, damit die gemerkten Zeilen (memo) nicht bei jedem Rendern
  // neu entstehen; sie greifen immer auf die aktuellen Zeilen und die aktuelle zeileKlick zu.
  const zeileKlickAktuell = useRef(zeileKlick)
  zeileKlickAktuell.current = zeileKlick
  const zeilenAktuell = useRef(zeilen)
  zeilenAktuell.current = zeilen
  const klickFuer = useMemo(() => {
    const handler = new Map<string, () => void>()
    return (id: string): (() => void) => {
      let h = handler.get(id)
      if (!h) {
        h = () => {
          const z = zeilenAktuell.current.find((x) => x.id === id)
          if (z) zeileKlickAktuell.current(z)
        }
        handler.set(id, h)
      }
      return h
    }
  }, [])

  async function mehrere(aenderung: { taetigkeit?: string; bewertung?: Bewertung; loeschen?: boolean }): Promise<void> {
    if (!window.api || !auswahl || auswahl.size === 0) return
    const n = await window.api.bloecke.mehrereAendern([...auswahl], aenderung)
    tonSpielen('erfolg')
    hinweisZeigen(aenderung.loeschen ? `${n} Blöcke gelöscht.` : `${n} Blöcke geändert.`)
    setAuswahl(new Set())
  }

  async function alleMitProgramm(): Promise<void> {
    if (!window.api || !auswahl) return
    const erster = liste.find((b) => auswahl.has(b.id))
    if (!erster?.programm) return
    const von = wochenanfang(new Date()).toISOString()
    const alle = await window.api.bloecke.zeitraum(von, new Date().toISOString())
    const neu = new Set(auswahl)
    for (const b of alle) {
      if (b.quelle === 'auto' && b.programm === erster.programm && b.bewertung !== 'inaktiv' && b.id !== laufend?.id) {
        neu.add(b.id)
      }
    }
    setAuswahl(neu)
    hinweisZeigen(`${neu.size} Blöcke mit „${erster.programm}“ ausgewählt, auch an anderen Tagen dieser Woche.`)
  }

  /** Alle Arbeitsblöcke zwischen dem frühesten und dem spätesten ausgewählten dazunehmen (für eine ganze Arbeitsphase). */
  function alleDazwischen(): void {
    if (!auswahl || auswahl.size < 2) return
    const gewaehlt = liste.filter((b) => auswahl.has(b.id))
    const von = gewaehlt[0].start
    const bis = gewaehlt[gewaehlt.length - 1].ende
    const neu = new Set(auswahl)
    for (const b of liste) {
      if (b.start >= von && b.ende <= bis && b.bewertung !== 'inaktiv' && b.id !== laufendId) neu.add(b.id)
    }
    setAuswahl(neu)
    hinweisZeigen(`${neu.size} Blöcke von ${uhrzeit(von)} bis ${uhrzeit(bis)} ausgewählt.`)
  }

  async function fokusBeenden(): Promise<void> {
    if (!window.api || !status.fokus) return
    await window.api.fokus.beenden()
    tonSpielen('schliessen')
    hinweisZeigen(`Fokus „${status.fokus.taetigkeit}“ beendet. Ab jetzt gelten wieder die Regeln.`)
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

  // Beim Logo-Hintergrund schwebt die Wortmarke fest in der Fenstermitte, die Karten hängen aber oben fest.
  // Damit in der Grundstellung keine Karte über der Schrift liegt (das Licht wäre dort gedämpft, oben
  // nicht: "nervt"), misst der Screen, wo der Bereich unter dem Ring beginnt, und schiebt ihn per Abstand
  // unter die Schrift. Bei jeder Fenstergröße und beim Umschalten des Hintergrunds neu.
  const unterRing = useRef<HTMLDivElement>(null)
  const [abstand, setAbstand] = useState(0)
  const hintergrund = useHintergrundArt()
  useLayoutEffect(() => {
    const el = unterRing.current
    if (!el) return
    const messen = (): void => {
      if (hintergrund !== 'logo') {
        setAbstand(0)
        return
      }
      const behaelter = el.closest('.screen-ebene')
      const gescrollt = behaelter instanceof HTMLElement ? behaelter.scrollTop : 0
      // Wo der Bereich ohne Abstand und ungescrollt beginnen würde.
      const start = el.getBoundingClientRect().top + gescrollt - Number.parseFloat(el.style.marginTop || '0')
      const { unten } = wortmarkeLage(window.innerWidth, window.innerHeight)
      setAbstand(Math.max(0, Math.round(unten + 14 - start)))
    }
    messen()
    window.addEventListener('resize', messen)
    return () => window.removeEventListener('resize', messen)
  }, [hintergrund])

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

      {/* Alles unter dem Ring rückt so weit nach unten, dass die fest schwebende Wortmarke in der Grundstellung frei bleibt. */}
      <div ref={unterRing} className="flex flex-col gap-4" style={{ marginTop: abstand }}>
      {istHeute && (
        <Karte>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs tracking-wide text-mute uppercase">Gerade</p>
            {status.fokus ? (
              <button type="button" onClick={() => void fokusBeenden()} className="rounded-chip bg-panel-2 px-3 py-1.5 text-xs text-ink hover:bg-inaktiv">
                Fokus beenden
              </button>
            ) : (
              status.zustand !== 'nicht-angemeldet' && (
                <button
                  type="button"
                  onClick={fokusDialogOeffnen}
                  className="knopf-primaer flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-xs"
                  title="Eine Tätigkeit für alles, was du jetzt tust, egal welches Programm"
                >
                  <Crosshair size={13} strokeWidth={2} />
                  Fokus starten
                </button>
              )
            )}
          </div>
          {status.fokus && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-produktiv">
              <Crosshair size={14} strokeWidth={2} />
              Fokus „{status.fokus.taetigkeit}“ seit {uhrzeit(status.fokus.seit)}: alles zählt als produktiv dazu, egal welches Programm.
            </p>
          )}
          {laufend ? (
            <div className="mt-2 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-lg">
                  <span className="truncate">{laufendName.haupt}</span>
                  {laufendName.neben && (
                    <span className="shrink-0 rounded-chip bg-panel-2 px-1.5 py-0.5 text-xs text-mute">{laufendName.neben}</span>
                  )}
                  {laufend.taetigkeit && <span className="shrink-0 text-sm text-mute">· {laufend.taetigkeit}</span>}
                </p>
                {laufendName.titel && <p className="truncate text-sm text-mute">{laufendName.titel}</p>}
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
              <Laufzeit start={laufend.start} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-dim">{geradeText}</p>
          )}
          {laufend && status.eigenesFenster && (
            <p className="mt-2 text-xs text-dim">
              Kurzer Blick in wessamedia Zeit: {laufendName.haupt} läuft noch bis zu 2 Minuten weiter, danach endet der Block beim Wechsel in die App.
            </p>
          )}
        </Karte>
      )}

      <UngeklaertPostfach
        anzahl={ungeklaert}
        stand={stand}
        onOeffnen={setBearbeiten}
        onGruppe={(bloecke, muster) => setGruppe({ bloecke, muster })}
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
            {zeilen.map((z) => (
              <BlockZeile
                key={z.id}
                block={z.block}
                laeuft={z.id === laufendId}
                onClick={klickFuer(z.id)}
                auswahlModus={auswahl !== null}
                ausgewaehlt={auswahl ? z.bloecke.every((b) => auswahl.has(b.id)) : false}
                abschnitte={z.bloecke.length}
                sekunden={z.sekunden}
              />
            ))}
          </div>
        )}
        {auswahl && <div className="h-16" />}
      </Karte>
      </div>

      {auswahl && (
        <Mehrfachleiste
          anzahl={auswahl.size}
          programm={auswahlProgramm}
          taetigkeiten={taetigkeiten}
          onTaetigkeit={(name) => void mehrere({ taetigkeit: name })}
          onBewertung={(bewertung) => void mehrere({ bewertung })}
          onLoeschen={() => void mehrere({ loeschen: true })}
          onAlleMitProgramm={() => void alleMitProgramm()}
          onAlleDazwischen={alleDazwischen}
          onFertig={() => setAuswahl(null)}
        />
      )}

      {gruppe && gruppe.bloecke.length > 0 && (
        <BlockDialog
          key={`gruppe-${gruppe.bloecke[0].id}`}
          block={gruppe.bloecke[0]}
          gruppe={gruppe.bloecke}
          gruppeMuster={gruppe.muster}
          taetigkeiten={taetigkeiten}
          onSchliessen={() => setGruppe(null)}
          onGespeichert={() => {
            void laden()
            setGruppe(null)
          }}
        />
      )}

      {dialogBlock && !gruppe && (
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

/** Der laufende Zähler des aktuellen Blocks; tickt für sich allein, damit nicht der ganze Screen jede Sekunde neu rendert. */
function Laufzeit({ start }: { start: string }): ReactElement {
  const jetzt = useSekundentakt()
  return <p className="text-2xl font-light">{laufzeitText((jetzt - Date.parse(start)) / 1000)}</p>
}
