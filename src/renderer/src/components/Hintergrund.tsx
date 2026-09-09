import { useMemo, type ReactElement } from 'react'

/*
 * Der lebendige Hintergrund hinter allen Screens, passend zum Thema Zeit:
 *   1. ein feines Raster wie auf einem Instrument, zur Mitte hin sichtbar, nach außen verblassend
 *   2. zwei große Zifferblatt-Ringe mit Skalenstrichen, die sich ganz langsam drehen
 *   3. aufsteigende Lichtpunkte in Grün, Orange und Weiß
 * Alles nur Transformationen und Deckkraft, damit es die Grafikkarte übernimmt.
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

export function Hintergrund(): ReactElement {
  const partikel = useMemo<Partikel[]>(() => {
    const z = zufall(7)
    return Array.from({ length: 28 }, (_, i) => ({
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
        <circle cx="480" cy="480" r="440" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="1.2" strokeDasharray="2 12" />
        <circle cx="480" cy="480" r="400" fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="1" />
        <circle cx="480" cy="480" r="440" fill="none" stroke="#FE5303" strokeOpacity="0.35" strokeWidth="3" strokeDasharray="70 2695" strokeLinecap="round" />
      </svg>

      {/* Zifferblatt unten links, dreht gegenläufig */}
      <svg className="hintergrund-ring-2 absolute" style={{ bottom: -300, left: -260, width: 640, height: 640 }} viewBox="0 0 640 640">
        <circle cx="320" cy="320" r="290" fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="1" strokeDasharray="1 9" />
        <circle cx="320" cy="320" r="290" fill="none" stroke="#00C076" strokeOpacity="0.35" strokeWidth="3" strokeDasharray="50 1772" strokeLinecap="round" />
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
