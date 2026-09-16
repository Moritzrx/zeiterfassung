import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { Portal } from './Portal'
import { STUFEN_FARBEN, rangName, rangStufe } from '@shared/rang'
import { LIGA_FARBEN, liga as ligaVon, type Liga } from '@shared/liga'
import { AUSZEICHNUNGEN, AUSZEICHNUNG_REIHENFOLGE } from '@shared/auszeichnungen'
import type { AuszeichnungTyp } from '@shared/typen'
import { useErfassung } from '../erfassung'
import { zahlText } from '../format'
import { tonSpielen } from '../toene'
import { AuszeichnungBild } from './AuszeichnungBild'
import { LigaAbzeichen } from './LigaAbzeichen'
import { RangAbzeichen } from './RangAbzeichen'

const DAUER_MS = 5200
/** Medaillen bleiben länger stehen, weil man die Bedingung lesen soll. */
const DAUER_AUSZEICHNUNG_MS = 8000
const RAUS_MS = 350

/** Was gefeiert wird: ein Wochenrang, eine neue Liga oder eine neue Auszeichnung (Medaille). */
type Feier = { art: 'rang'; rang: number } | { art: 'liga'; liga: Liga; trophaeen: number } | { art: 'auszeichnung'; typ: AuszeichnungTyp }

/** Von der Liga-Karte ausgelöst, wenn der Trophäenstand eine neue Liga erreicht hat. */
export function ligaAufstiegZeigen(trophaeen: number): void {
  window.dispatchEvent(new CustomEvent('liga-aufstieg', { detail: trophaeen }))
}

/**
 * Neue Auszeichnungen groß feiern (16. September 2026, Auftraggeber: "wenn ich sehe, Sprint freigeschaltet, sehe ich
 * gar nicht, was die kann"): jede Medaille erscheint nacheinander mit Bild, Namen und ihrer Bedingung.
 */
export function auszeichnungenFeiern(typen: AuszeichnungTyp[]): void {
  window.dispatchEvent(new CustomEvent('auszeichnung-neu', { detail: typen }))
}

/** Die Lichtbahnen, wie im Hintergrund von unten links nach oben rechts (Raster 1000 × 600). */
const BAHNEN = [
  'M-60 560 C 180 520, 260 300, 480 330 S 820 300, 1060 60',
  'M-60 660 C 240 640, 320 380, 560 420 S 900 340, 1060 160',
  'M-60 420 C 160 460, 300 180, 520 220 S 860 120, 1060 -40'
]

interface Funke {
  dx: number
  dy: number
  groesse: number
  dauer: number
  verzoegerung: number
  weiss: boolean
}

/** Fester Zufall je Saat, damit die Funken bei jedem Aufbau gleich fliegen. */
function funken(saat: number): Funke[] {
  let s = saat * 7919 + 13
  const z = (): number => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  return Array.from({ length: 42 }, () => {
    const winkel = z() * Math.PI * 2
    const weite = 170 + z() * 380
    return {
      dx: Math.cos(winkel) * weite,
      dy: Math.sin(winkel) * weite * 0.85,
      groesse: 3 + z() * 5,
      dauer: 0.9 + z() * 0.7,
      verzoegerung: 0.12 + z() * 0.3,
      weiss: z() < 0.3
    }
  })
}

/**
 * Die große Einblendung beim Aufstieg (Wochenrang oder Liga): Lichtschein und Strahlenkranz in der
 * Stufenfarbe, Druckwellen und Funken vom Wappen weg, Lichtbahnen wie im Hintergrund, dazu Klang.
 * Der Rang-Aufstieg kommt aus dem Erfassungsstatus (nur bei sichtbarem Fenster, pro Woche je Rang einmal),
 * der Liga-Aufstieg als Ereignis von der Liga-Karte. Bleibt ein paar Sekunden oder bis zum Klick.
 */
export function RangAufstieg(): ReactElement | null {
  const status = useErfassung()
  const [gezeigt, setGezeigt] = useState<Feier | null>(null)
  const [raus, setRaus] = useState(false)
  // Zuletzt gefeierter Rang, damit bis zur nächsten Statusmeldung nichts doppelt erscheint.
  const gefeiert = useRef(0)

  const schliessen = useCallback((f: Feier): void => {
    setRaus((schon) => {
      if (schon) return schon
      window.setTimeout(() => {
        if (f.art === 'rang') {
          gefeiert.current = Math.max(gefeiert.current, f.rang)
          if (window.api) void window.api.rang.gefeiert(f.rang)
        }
        setGezeigt(null)
        setRaus(false)
      }, RAUS_MS)
      return true
    })
  }, [])

  // Rang: einblenden, sobald ein neuer Rang gemeldet wird und das Fenster sichtbar ist.
  useEffect(() => {
    const neuer = status.neuerRang
    if (neuer === null || neuer <= gefeiert.current || gezeigt !== null) return
    const starten = (): void => {
      if (!document.hidden) setGezeigt({ art: 'rang', rang: neuer })
    }
    starten()
    document.addEventListener('visibilitychange', starten)
    return () => document.removeEventListener('visibilitychange', starten)
  }, [status.neuerRang, gezeigt])

  // Liga: Ereignis von der Liga-Karte.
  useEffect(() => {
    const handler = (e: Event): void => {
      const trophaeen = (e as CustomEvent<number>).detail
      setGezeigt((alt) => alt ?? { art: 'liga', liga: ligaVon(trophaeen), trophaeen })
    }
    window.addEventListener('liga-aufstieg', handler)
    return () => window.removeEventListener('liga-aufstieg', handler)
  }, [])

  // Auszeichnungen: kommen als Liste, werden nacheinander gezeigt, und erst, wenn das Fenster sichtbar ist.
  const warteschlange = useRef<AuszeichnungTyp[]>([])
  const [wartend, setWartend] = useState(0)
  useEffect(() => {
    const handler = (e: Event): void => {
      const typen = (e as CustomEvent<AuszeichnungTyp[]>).detail
      for (const t of typen) if (AUSZEICHNUNGEN[t] && !warteschlange.current.includes(t)) warteschlange.current.push(t)
      setWartend(warteschlange.current.length)
    }
    window.addEventListener('auszeichnung-neu', handler)
    return () => window.removeEventListener('auszeichnung-neu', handler)
  }, [])
  useEffect(() => {
    if (gezeigt !== null || warteschlange.current.length === 0) return
    const naechste = (): void => {
      if (document.hidden || warteschlange.current.length === 0) return
      const typ = warteschlange.current.shift()
      setWartend(warteschlange.current.length)
      if (typ) setGezeigt({ art: 'auszeichnung', typ })
    }
    naechste()
    document.addEventListener('visibilitychange', naechste)
    return () => document.removeEventListener('visibilitychange', naechste)
  }, [gezeigt, wartend])

  // In der Entwicklungsversion aus der Konsole auslösbar: rangAufstiegTest(7), ligaAufstiegTest(1400), auszeichnungTest('sprint')
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { rangAufstiegTest: (r: number) => void; ligaAufstiegTest: (t: number) => void; auszeichnungTest: (typ: AuszeichnungTyp) => void }
    w.rangAufstiegTest = (r) => setGezeigt({ art: 'rang', rang: r })
    w.ligaAufstiegTest = (t) => setGezeigt({ art: 'liga', liga: ligaVon(t), trophaeen: t })
    w.auszeichnungTest = (typ) => auszeichnungenFeiern([typ])
  }, [])

  // Klang beim Erscheinen, nach ein paar Sekunden von selbst schließen.
  useEffect(() => {
    if (gezeigt === null) return
    tonSpielen(gezeigt.art === 'auszeichnung' ? 'auszeichnung' : 'aufstieg')
    const timer = window.setTimeout(() => schliessen(gezeigt), gezeigt.art === 'auszeichnung' ? DAUER_AUSZEICHNUNG_MS : DAUER_MS)
    return () => window.clearTimeout(timer)
  }, [gezeigt, schliessen])

  const alleFunken = useMemo(
    () =>
      gezeigt === null
        ? []
        : funken(gezeigt.art === 'rang' ? gezeigt.rang : gezeigt.art === 'liga' ? 100 + gezeigt.liga.index : 200 + AUSZEICHNUNG_REIHENFOLGE.indexOf(gezeigt.typ)),
    [gezeigt]
  )

  if (gezeigt === null) return null

  const farbe = gezeigt.art === 'rang' ? STUFEN_FARBEN[rangStufe(gezeigt.rang)] : gezeigt.art === 'liga' ? LIGA_FARBEN[gezeigt.liga.stufe] : AUSZEICHNUNGEN[gezeigt.typ].farbe
  const ueberschrift = gezeigt.art === 'rang' ? 'Aufstieg' : gezeigt.art === 'liga' ? 'Liga-Aufstieg' : 'Auszeichnung freigeschaltet'
  const gross = gezeigt.art === 'rang' ? `Rang ${gezeigt.rang}` : gezeigt.art === 'liga' ? gezeigt.liga.name : AUSZEICHNUNGEN[gezeigt.typ].titel
  const klein = gezeigt.art === 'rang' ? rangName(gezeigt.rang) : gezeigt.art === 'liga' ? `${zahlText(gezeigt.trophaeen, 0)} Trophäen` : AUSZEICHNUNGEN[gezeigt.typ].text
  const nochWartend = gezeigt.art === 'auszeichnung' ? warteschlange.current.length : 0
  const stil = {
    background: `radial-gradient(ellipse 55% 45% at 50% 44%, ${farbe}33, transparent 70%), rgba(6, 6, 8, 0.94)`,
    '--farbe': farbe,
    '--farbe-strahlen': `${farbe}26`
  } as CSSProperties

  return (
    <Portal>
      <div
        className={`aufstieg-schleier fixed inset-0 z-50 flex items-center justify-center overflow-hidden ${raus ? 'aufstieg-raus' : ''}`}
        style={stil}
        onClick={() => schliessen(gezeigt)}
        role="dialog"
        aria-label={`${ueberschrift}: ${gross}`}
      >
        {/* Lichtbahnen, die einmal durchs Bild zischen */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
          {BAHNEN.map((d, i) => (
            <g key={i} style={{ ['--verzoegerung' as string]: `${0.05 + i * 0.16}s` }}>
              <path className="aufstieg-bahn" d={d} fill="none" stroke={farbe} strokeOpacity="0.2" strokeWidth="16" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path className="aufstieg-bahn" d={d} fill="none" stroke={farbe} strokeOpacity="0.75" strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path className="aufstieg-bahn" d={d} fill="none" stroke="#FFFFFF" strokeOpacity="0.95" strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
        </svg>

        {/* Strahlenkranz, Druckwellen und Funken, alle um die Wappenmitte */}
        <div className="pointer-events-none absolute" style={{ left: '50%', top: '44%', width: 0, height: 0 }} aria-hidden="true">
          <div className="aufstieg-strahlen absolute rounded-full" style={{ width: 1500, height: 1500, left: -750, top: -750 }} />
          <div className="aufstieg-welle absolute" style={{ width: 240, height: 240, left: -120, top: -120, animationDelay: '0.2s' }} />
          <div className="aufstieg-welle absolute" style={{ width: 240, height: 240, left: -120, top: -120, animationDelay: '0.5s', borderColor: 'rgba(255,255,255,0.7)' }} />
          {alleFunken.map((f, i) => (
            <span
              key={i}
              className="aufstieg-funke absolute rounded-full"
              style={{
                width: f.groesse,
                height: f.groesse,
                left: -f.groesse / 2,
                top: -f.groesse / 2,
                backgroundColor: f.weiss ? '#FFFFFF' : farbe,
                boxShadow: `0 0 ${f.groesse * 2.5}px ${f.weiss ? '#FFFFFF' : farbe}`,
                ['--dx' as string]: `${f.dx}px`,
                ['--dy' as string]: `${f.dy}px`,
                ['--dauer' as string]: `${f.dauer}s`,
                ['--verzoegerung' as string]: `${f.verzoegerung}s`
              }}
            />
          ))}
        </div>

        {/* Wappen und Text */}
        <div className="relative flex flex-col items-center text-center" style={{ marginTop: '-6vh' }}>
          <div className="relative">
            <div
              className="aufstieg-schein pointer-events-none absolute rounded-full"
              style={{ inset: -70, background: `radial-gradient(circle, ${farbe}80, ${farbe}22 45%, transparent 68%)` }}
            />
            <div className="aufstieg-wappen relative">
              {gezeigt.art === 'rang' ? (
                <RangAbzeichen rang={gezeigt.rang} groesse={230} />
              ) : gezeigt.art === 'liga' ? (
                <LigaAbzeichen liga={gezeigt.liga} groesse={230} />
              ) : (
                <AuszeichnungBild typ={gezeigt.typ} erreicht groesse={230} />
              )}
            </div>
          </div>
          <p className="aufstieg-text mt-8 text-sm tracking-[0.45em] uppercase" style={{ color: farbe, textShadow: `0 0 18px ${farbe}`, animationDelay: '0.5s' }}>
            {ueberschrift}
          </p>
          <p
            className={`aufstieg-text mt-2 leading-none font-light ${gezeigt.art === 'auszeichnung' ? 'text-[56px]' : 'text-[76px]'}`}
            style={{ animationDelay: '0.62s', textShadow: '0 0 30px rgba(255,255,255,0.25)' }}
          >
            {gross}
          </p>
          <p className={`aufstieg-text mt-3 text-mute ${gezeigt.art === 'auszeichnung' ? 'max-w-[520px] px-6 text-lg leading-snug' : 'text-xl'}`} style={{ animationDelay: '0.76s' }}>
            {klein}
          </p>
          <p className="aufstieg-text mt-10 text-xs text-dim" style={{ animationDelay: '1.8s' }}>
            {nochWartend > 0 ? `Klicken für die nächste (noch ${nochWartend})` : 'Klicken zum Schließen'}
          </p>
        </div>
      </div>
    </Portal>
  )
}
