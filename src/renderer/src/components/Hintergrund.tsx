import { useMemo, type ReactElement } from 'react'

/*
 * Der lebendige Hintergrund hinter allen Screens, passend zum Thema Zeit:
 *   1. ein feines Raster wie auf einem Instrument, zur Mitte hin sichtbar, nach außen verblassend
 *   2. zwei große Zifferblatt-Ringe mit Skalenstrichen, die sich ganz langsam drehen
 *   3. geschwungene Lichtbahnen, auf denen ein Funke von unten links nach oben rechts zischt und zurück
 *   4. aufsteigende Lichtpunkte in Grün, Orange und Weiß
 * Alles nur Transformationen, Deckkraft und Strichversatz, damit es flüssig bleibt.
 * Die weichen Lichtflecken und das Korn liegen weiterhin in styles.css (body::before/after).
 */

interface Partikel {
  links: number
  groesse: number
  dauer: number
  verzoegerung: number
  farbe: string
  drift: number
}

/** Fester Zufall, damit die Punkte bei jedem Aufbau gleich verteilt sind. */
function zufall(saat: number): () => number {
  let s = saat
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const FARBEN = ['rgba(0, 192, 118, 0.75)', 'rgba(254, 83, 3, 0.6)', 'rgba(255, 255, 255, 0.4)', 'rgba(0, 192, 118, 0.5)']

const RASTER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cpath d='M56 0H0V56' fill='none' stroke='white' stroke-opacity='0.16' stroke-width='1'/%3E%3Ccircle cx='0' cy='0' r='1' fill='white' fill-opacity='0.35'/%3E%3C/svg%3E\")"

/** Die Lichtbahnen im Raster 1000 × 600, alle von unten links nach oben rechts geschwungen. */
const BAHNEN: Array<{ d: string; farbe: string; dauer: number; verzoegerung: number }> = [
  { d: 'M-60 560 C 180 520, 260 300, 480 330 S 820 300, 1060 60', farbe: '#FE5303', dauer: 7, verzoegerung: 0 },
  { d: 'M-60 660 C 240 640, 320 380, 560 420 S 900 340, 1060 160', farbe: '#00C076', dauer: 9, verzoegerung: -4 },
  { d: 'M-60 420 C 160 460, 300 180, 520 220 S 860 120, 1060 -40', farbe: '#7DD3FC', dauer: 11, verzoegerung: -7 }
]

export function Hintergrund(): ReactElement {
  const partikel = useMemo<Partikel[]>(() => {
    const z = zufall(7)
    return Array.from({ length: 44 }, (_, i) => ({
      links: z() * 100,
      groesse: 2 + z() * 3,
      dauer: 22 + z() * 26,
      verzoegerung: -z() * 40,
      farbe: FARBEN[i % FARBEN.length],
      drift: (z() - 0.5) * 120
    }))
  }, [])

  return (
    <div aria-hidden="true" className="hintergrund pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: -1 }}>
      {/* Raster */}
      <div className="hintergrund-raster absolute inset-0" style={{ backgroundImage: RASTER }} />

      {/* Zifferblatt oben rechts */}
      <svg className="hintergrund-ring absolute" style={{ top: -380, right: -300, width: 960, height: 960 }} viewBox="0 0 960 960">
        <circle cx="480" cy="480" r="440" fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="1.2" strokeDasharray="2 12" />
        <circle cx="480" cy="480" r="400" fill="none" stroke="white" strokeOpacity="0.04" strokeWidth="1" />
      </svg>

      {/* Zifferblatt unten links, dreht gegenläufig */}
      <svg className="hintergrund-ring-2 absolute" style={{ bottom: -300, left: -260, width: 640, height: 640 }} viewBox="0 0 640 640">
        <circle cx="320" cy="320" r="290" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="1" strokeDasharray="1 9" />
      </svg>

      {/* Lichtbahnen mit zischenden Funken */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 600" preserveAspectRatio="none">
        {BAHNEN.map((b, i) => (
          <g key={i} style={{ ['--dauer' as string]: `${b.dauer}s`, ['--verzoegerung' as string]: `${b.verzoegerung}s` }}>
            <path d={b.d} fill="none" stroke={b.farbe} strokeOpacity="0.07" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <path className="hintergrund-bahn" d={b.d} fill="none" stroke={b.farbe} strokeOpacity="0.5" strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 8px ${b.farbe})` }} />
            <path className="hintergrund-bahn" d={b.d} fill="none" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>

      {/* Lichtpunkte */}
      {partikel.map((p, i) => (
        <span
          key={i}
          className="hintergrund-punkt absolute rounded-full"
          style={{
            left: `${p.links}%`,
            width: p.groesse,
            height: p.groesse,
            backgroundColor: p.farbe,
            boxShadow: `0 0 ${p.groesse * 3}px ${p.farbe}`,
            animationDuration: `${p.dauer}s`,
            animationDelay: `${p.verzoegerung}s`,
            ['--drift' as string]: `${p.drift}px`
          }}
        />
      ))}
    </div>
  )
}
