import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { Portal } from './Portal'
import { STUFEN_FARBEN, rangName, rangStufe } from '@shared/rang'
import { useErfassung } from '../erfassung'
import { tonSpielen } from '../toene'
import { RangAbzeichen } from './RangAbzeichen'

const DAUER_MS = 5200
const RAUS_MS = 350

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

/** Fester Zufall je Rang, damit die Funken bei jedem Aufbau gleich fliegen. */
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
 * Die große Einblendung beim Rang-Aufstieg: Lichtschein und Strahlenkranz in der Stufenfarbe,
 * Druckwellen und Funken vom Wappen weg, Lichtbahnen wie im Hintergrund, dazu Klang.
 * Erscheint nur, wenn das Fenster sichtbar ist, bleibt ein paar Sekunden oder bis zum Klick,
 * und wird pro Woche für jeden Rang nur einmal gezeigt.
 */
export function RangAufstieg(): ReactElement | null {
  const status = useErfassung()
  const [gezeigt, setGezeigt] = useState<number | null>(null)
  const [raus, setRaus] = useState(false)
  // Zuletzt gefeierter Rang, damit bis zur nächsten Statusmeldung nichts doppelt erscheint.
  const gefeiert = useRef(0)

  const schliessen = useCallback((r: number): void => {
    setRaus((schon) => {
      if (schon) return schon
      window.setTimeout(() => {
        gefeiert.current = Math.max(gefeiert.current, r)
        if (window.api) void window.api.rang.gefeiert(r)
        setGezeigt(null)
        setRaus(false)
      }, RAUS_MS)
      return true
    })
  }, [])

  // Einblenden, sobald ein neuer Rang gemeldet wird und das Fenster sichtbar ist.
  useEffect(() => {
    const neuer = status.neuerRang
    if (neuer === null || neuer <= gefeiert.current || gezeigt !== null) return
    const starten = (): void => {
      if (!document.hidden) setGezeigt(neuer)
    }
    starten()
    document.addEventListener('visibilitychange', starten)
    return () => document.removeEventListener('visibilitychange', starten)
  }, [status.neuerRang, gezeigt])

  // In der Entwicklungsversion lässt sich die Einblendung aus der Konsole auslösen: rangAufstiegTest(7)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { rangAufstiegTest: (r: number) => void }).rangAufstiegTest = (r) => setGezeigt(r)
  }, [])

  // Klang beim Erscheinen, nach ein paar Sekunden von selbst schließen.
  useEffect(() => {
    if (gezeigt === null) return
    tonSpielen('aufstieg')
    const timer = window.setTimeout(() => schliessen(gezeigt), DAUER_MS)
    return () => window.clearTimeout(timer)
  }, [gezeigt, schliessen])

  const alleFunken = useMemo(() => (gezeigt === null ? [] : funken(gezeigt)), [gezeigt])

  if (gezeigt === null) return null

  const farbe = STUFEN_FARBEN[rangStufe(gezeigt)]
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
        aria-label={`Aufstieg auf Rang ${gezeigt}`}
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
              <RangAbzeichen rang={gezeigt} groesse={230} />
            </div>
          </div>
          <p className="aufstieg-text mt-8 text-sm tracking-[0.45em] uppercase" style={{ color: farbe, textShadow: `0 0 18px ${farbe}`, animationDelay: '0.5s' }}>
            Aufstieg
          </p>
          <p className="aufstieg-text mt-2 text-[76px] leading-none font-light" style={{ animationDelay: '0.62s', textShadow: '0 0 30px rgba(255,255,255,0.25)' }}>
            Rang {gezeigt}
          </p>
          <p className="aufstieg-text mt-3 text-xl text-mute" style={{ animationDelay: '0.76s' }}>
            {rangName(gezeigt)}
          </p>
          <p className="aufstieg-text mt-10 text-xs text-dim" style={{ animationDelay: '1.8s' }}>
            Klicken zum Schließen
          </p>
        </div>
      </div>
    </Portal>
  )
}
