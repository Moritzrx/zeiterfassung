import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import { Portal } from './Portal'
import { AUSZEICHNUNGEN, wochenstatistik, type Wochenstatistik } from '@shared/auszeichnungen'
import { deltaText, liga as ligaVon, type Liga } from '@shared/liga'
import { STANDARD_GESAMTZIEL, STUFEN_FARBEN, rang, rangName, rangStufe, zielRang } from '@shared/rang'
import type { Auszeichnung } from '@shared/typen'
import { berlinDatum, datumVerschieben, datumZuTagesanfang, wochenanfang } from '@shared/zeit'
import { kurzDatum, stundenText, zahlText } from '../format'
import { useNutzer } from '../nutzer'
import { tonSpielen } from '../toene'
import { AuszeichnungBild } from './AuszeichnungBild'
import { RangAbzeichen } from './RangAbzeichen'

const RAUS_MS = 350
const SCHLUESSEL = 'rueckblick.gezeigt.'
const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

interface Rueckblick {
  start: string
  stat: Wochenstatistik
  rang: number
  ziel: number
  gesamtziel: number
  neue: Auszeichnung[]
  liga: { delta: number; wirksam: number; trophaeen: number; liga: Liga } | null
  team: { platz: number; anzahl: number } | null
}

/** ISO-Kalenderwoche eines Montags "JJJJ-MM-TT". */
function kalenderwoche(montag: string): number {
  const [j, m, t] = montag.split('-').map(Number)
  const d = new Date(Date.UTC(j, m - 1, t))
  // Donnerstag derselben Woche bestimmt das Jahr der Kalenderwoche
  d.setUTCDate(d.getUTCDate() + 3)
  const jahresanfang = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - jahresanfang.getTime()) / 86_400_000 + 1) / 7)
}

/** Fester Zufall für die Funken. */
function funken(saat: number): Array<{ dx: number; dy: number; groesse: number; dauer: number; verzoegerung: number }> {
  let s = saat * 7919 + 29
  const z = (): number => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  return Array.from({ length: 36 }, () => {
    const winkel = z() * Math.PI * 2
    const weite = 200 + z() * 420
    return { dx: Math.cos(winkel) * weite, dy: Math.sin(winkel) * weite * 0.8, groesse: 3 + z() * 4, dauer: 1 + z() * 0.8, verzoegerung: 0.1 + z() * 0.4 }
  })
}

/**
 * Der Wochenrückblick als Vollbild, wie ein Saisonende: erscheint einmal je abgeschlossener Woche
 * (ab Montag, sobald das Fenster sichtbar ist), mit Rang-Wappen, Stunden, bestem Tag, Trophäen,
 * Platz im Team und den Auszeichnungen der Woche, alles gestaffelt eingeblendet. Merkt sich in
 * localStorage, welche Woche schon gezeigt wurde. In der Entwicklungsversion: rueckblickTest().
 */
export function Wochenrueckblick(): ReactElement | null {
  const { status } = useNutzer()
  const uid = status?.userId ?? null
  const [daten, setDaten] = useState<Rueckblick | null>(null)
  const [raus, setRaus] = useState(false)

  const laden = useCallback(async (erzwingen: boolean): Promise<void> => {
    if (!window.api || !uid) return
    const heute = new Date()
    const dieseWoche = berlinDatum(wochenanfang(heute))
    const letzte = datumVerschieben(dieseWoche, -7)
    const schluessel = SCHLUESSEL + uid
    let gezeigt: string | null = null
    try {
      gezeigt = localStorage.getItem(schluessel)
    } catch {
      /* localStorage nicht verfügbar */
    }
    if (!erzwingen && gezeigt === letzte) return

    const bloecke = await window.api.bloecke.zeitraum(datumZuTagesanfang(letzte).toISOString(), datumZuTagesanfang(dieseWoche).toISOString())
    const stat = wochenstatistik(bloecke, letzte)
    if (!erzwingen && stat.produktiv + stat.unproduktiv + stat.ungeklaert === 0) {
      // Woche ohne Erfassung (z. B. Urlaub, App aus): nichts zu zeigen, aber merken.
      try {
        localStorage.setItem(schluessel, letzte)
      } catch {
        /* localStorage nicht verfügbar */
      }
      return
    }
    const [ziele, auszeichnungen, stand, team] = await Promise.all([
      window.api.ziele.eigene().catch(() => []),
      window.api.auszeichnungen.liste().catch(() => []),
      window.api.liga.stand().catch(() => []),
      window.api.team.wochen(letzte, letzte).catch(() => [])
    ])
    const gesamtziel = ziele.find((z) => !z.taetigkeit)?.stundenProWoche ?? STANDARD_GESAMTZIEL
    const ich = stand.find((s) => s.istIch)
    const ligaDaten =
      ich && ich.letzteWoche === letzte && ich.letztesDelta !== null
        ? { delta: ich.letztesDelta, wirksam: ich.letztesWirksam ?? ich.letztesDelta, trophaeen: ich.trophaeen, liga: ligaVon(ich.trophaeen) }
        : null
    const wochenzeilen = team.filter((w) => w.wocheStart === letzte).sort((a, b) => b.produktiveSekunden - a.produktiveSekunden)
    const platz = wochenzeilen.findIndex((w) => w.userId === uid)
    setDaten({
      start: letzte,
      stat,
      rang: rang(stat.produktiv),
      ziel: zielRang(gesamtziel),
      gesamtziel,
      neue: auszeichnungen.filter((a) => a.wocheStart === letzte),
      liga: ligaDaten,
      team: platz >= 0 && wochenzeilen.length > 1 ? { platz: platz + 1, anzahl: wochenzeilen.length } : null
    })
  }, [uid])

  // Beim Start und danach alle 30 Minuten nachsehen, aber nur bei sichtbarem Fenster.
  useEffect(() => {
    if (!uid) return
    const versuch = (): void => {
      if (!document.hidden) void laden(false).catch(() => {})
    }
    versuch()
    const timer = window.setInterval(versuch, 30 * 60_000)
    document.addEventListener('visibilitychange', versuch)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', versuch)
    }
  }, [uid, laden])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { rueckblickTest: () => void; rueckblickDemo: () => void }
    w.rueckblickTest = () => void laden(true)
    // Vorschau mit erfundenen Zahlen, um das Aussehen zu zeigen.
    w.rueckblickDemo = () => {
      const start = '2026-09-07'
      const tage = [8.6, 9.4, 7.2, 8.1, 6.9, 3.5, 0].map((h) => h * 3600)
      const stat: Wochenstatistik = {
        start,
        produktiv: tage.reduce((a, b) => a + b, 0),
        unproduktiv: 1.4 * 3600,
        ungeklaert: 0,
        inaktiv: 3 * 3600,
        jeTaetigkeit: new Map(),
        tage,
        frueh: 0,
        spaet: 0,
        laengsteStrecke: 3.2 * 3600,
        leer: false,
        testdaten: false
      }
      setDaten({
        start,
        stat,
        rang: rang(stat.produktiv),
        ziel: zielRang(50),
        gesamtziel: 50,
        neue: [
          { typ: 'sprint', wocheStart: start, freigeschaltetAm: new Date().toISOString(), testdaten: false },
          { typ: 'fokus_woche', wocheStart: start, freigeschaltetAm: new Date().toISOString(), testdaten: false }
        ],
        liga: { delta: 37, wirksam: 37, trophaeen: 437, liga: ligaVon(437) },
        team: { platz: 1, anzahl: 3 }
      })
    }
  }, [laden])

  useEffect(() => {
    if (daten) tonSpielen('auszeichnung')
  }, [daten])

  const schliessen = useCallback((): void => {
    if (!daten) return
    setRaus((schon) => {
      if (schon) return schon
      try {
        if (uid) localStorage.setItem(SCHLUESSEL + uid, daten.start)
      } catch {
        /* localStorage nicht verfügbar */
      }
      window.setTimeout(() => {
        setDaten(null)
        setRaus(false)
      }, RAUS_MS)
      return true
    })
  }, [daten, uid])

  const alleFunken = useMemo(() => (daten ? funken(daten.rang + 40) : []), [daten])

  if (!daten) return null

  const { stat } = daten
  const farbe = daten.rang > 0 ? STUFEN_FARBEN[rangStufe(daten.rang)] : '#FE5303'
  const geschafft = daten.rang >= daten.ziel
  const besterTag = stat.tage.reduce((best, sek, i) => (sek > stat.tage[best] ? i : best), 0)
  const ende = datumVerschieben(daten.start, 6)
  const stil = {
    background: `radial-gradient(ellipse 60% 45% at 50% 30%, ${farbe}2E, transparent 70%), rgba(6, 6, 8, 0.95)`,
    '--farbe': farbe,
    '--farbe-strahlen': `${farbe}22`
  } as CSSProperties

  const kacheln: Array<{ titel: string; wert: string; zusatz: string; farbe?: string }> = [
    { titel: 'Produktiv', wert: `${stundenText(stat.produktiv)} h`, zusatz: `Ziel ${stundenText(daten.gesamtziel * 3600)} h`, farbe: '#00C076' },
    { titel: 'Unproduktiv', wert: `${stundenText(stat.unproduktiv)} h`, zusatz: stat.ungeklaert > 0 ? `${stundenText(stat.ungeklaert)} h ungeklärt` : 'alles eingeordnet', farbe: '#FF4D4D' },
    { titel: 'Bester Tag', wert: WOCHENTAGE[besterTag], zusatz: `${stundenText(stat.tage[besterTag])} h produktiv` }
  ]
  if (daten.liga) {
    kacheln.push({
      titel: 'Trophäen',
      wert: deltaText(daten.liga.wirksam),
      zusatz: `${zahlText(daten.liga.trophaeen, 0)} · ${daten.liga.liga.name}${daten.liga.wirksam !== daten.liga.delta ? ' (unter 0 fällt niemand)' : ''}`,
      farbe: daten.liga.wirksam > 0 ? '#00C076' : daten.liga.wirksam < 0 ? '#FF4D4D' : undefined
    })
  }
  if (daten.team) kacheln.push({ titel: 'Team', wert: `Platz ${daten.team.platz}`, zusatz: `von ${daten.team.anzahl} diese Woche`, farbe: daten.team.platz === 1 ? '#FFD166' : undefined })

  return (
    <Portal>
      <div
        className={`aufstieg-schleier fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto ${raus ? 'aufstieg-raus' : ''}`}
        style={stil}
        onClick={schliessen}
        role="dialog"
        aria-label="Wochenrückblick"
      >
        {/* Strahlenkranz und Funken hinter dem Wappen */}
        <div className="pointer-events-none absolute" style={{ left: '50%', top: '30%', width: 0, height: 0 }} aria-hidden="true">
          <div className="aufstieg-strahlen absolute rounded-full" style={{ width: 1400, height: 1400, left: -700, top: -700 }} />
          <div className="aufstieg-welle absolute" style={{ width: 220, height: 220, left: -110, top: -110, animationDelay: '0.25s' }} />
          {alleFunken.map((f, i) => (
            <span
              key={i}
              className="aufstieg-funke absolute rounded-full"
              style={{
                width: f.groesse,
                height: f.groesse,
                left: -f.groesse / 2,
                top: -f.groesse / 2,
                backgroundColor: farbe,
                boxShadow: `0 0 ${f.groesse * 2.5}px ${farbe}`,
                ['--dx' as string]: `${f.dx}px`,
                ['--dy' as string]: `${f.dy}px`,
                ['--dauer' as string]: `${f.dauer}s`,
                ['--verzoegerung' as string]: `${f.verzoegerung}s`
              }}
            />
          ))}
        </div>

        <div className="relative my-auto flex w-full max-w-[860px] flex-col items-center px-6 py-8 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="aufstieg-text text-sm tracking-[0.45em] uppercase" style={{ color: farbe, textShadow: `0 0 18px ${farbe}`, animationDelay: '0.1s' }}>
            Wochenrückblick
          </p>
          <p className="aufstieg-text mt-2 text-sm text-mute" style={{ animationDelay: '0.2s' }}>
            KW {kalenderwoche(daten.start)} · {kurzDatum(daten.start)} bis {kurzDatum(ende)}
          </p>

          <div className="relative mt-4">
            <div className="aufstieg-schein pointer-events-none absolute rounded-full" style={{ inset: -50, background: `radial-gradient(circle, ${farbe}70, ${farbe}18 45%, transparent 68%)` }} />
            <div className="aufstieg-wappen relative">
              <RangAbzeichen rang={daten.rang} groesse={150} />
            </div>
          </div>
          <p className="aufstieg-text mt-3 text-[40px] leading-none font-light" style={{ animationDelay: '0.55s' }}>
            Rang {daten.rang} <span className="text-2xl text-mute">{rangName(daten.rang)}</span>
          </p>
          <p className="aufstieg-text mt-2 text-sm" style={{ animationDelay: '0.7s', color: geschafft ? '#00C076' : '#8E8E93' }}>
            {geschafft ? 'Wochenziel geschafft' : `Ziel war Rang ${daten.ziel}`}
          </p>

          <div className="mt-5 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {kacheln.map((k, i) => (
              <div key={k.titel} className="aufstieg-text glas rounded-card px-4 py-2.5 text-left" style={{ animationDelay: `${0.85 + i * 0.16}s` }}>
                <p className="text-xs text-mute">{k.titel}</p>
                <p className="mt-0.5 text-2xl font-light" style={{ color: k.farbe, textShadow: k.farbe ? `0 0 14px ${k.farbe}66` : undefined }}>
                  {k.wert}
                </p>
                <p className="mt-0.5 text-xs text-dim">{k.zusatz}</p>
              </div>
            ))}
          </div>

          {daten.neue.length > 0 && (
            <div className="aufstieg-text mt-5 flex flex-wrap items-center justify-center gap-4" style={{ animationDelay: `${0.9 + kacheln.length * 0.16}s` }}>
              {daten.neue.map((a) => (
                <div key={a.typ} className="flex flex-col items-center gap-1">
                  <AuszeichnungBild typ={a.typ} erreicht groesse={64} />
                  <span className="text-xs text-mute">{AUSZEICHNUNGEN[a.typ].titel}</span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={schliessen}
            className="aufstieg-text mt-6 rounded-chip bg-ink px-5 py-2 text-sm text-ground transition-colors hover:bg-white"
            style={{ animationDelay: `${1.2 + kacheln.length * 0.16}s` }}
          >
            Auf in die neue Woche
          </button>
        </div>
      </div>
    </Portal>
  )
}
