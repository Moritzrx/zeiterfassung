import { useEffect, useMemo, useRef, type ReactElement } from 'react'

/*
 * Der lebendige Hintergrund hinter allen Screens, passend zum Thema Zeit:
 *   1. ein feines Raster wie auf einem Instrument, zur Mitte hin sichtbar, nach außen verblassend
 *   2. zwei große Zifferblatt-Ringe mit Skalenstrichen, die sich ganz langsam drehen
 *   3. geschwungene Lichtbahnen, auf denen ein Funke von unten links nach oben rechts zischt und zurück
 *   4. aufsteigende Lichtpunkte in Grün, Orange und Weiß
 * Alles läuft ausschließlich auf dem Compositor (nur transform und opacity), damit der Hauptthread
 * frei bleibt und die Screen-Wechsel flüssig laufen. Die Funken sind deshalb keine SVG-Strichanimation
 * (die zwingt jedes Bild zum Neuzeichnen), sondern je Bahn eine Kette aus kurzen leuchtenden Gliedern, die
 * per Web-Animations-API entlang der abgetasteten Bahn bewegt werden; jedes Glied läuft dem vorigen um ein
 * Stück Bahnlänge hinterher, dadurch biegt sich die Kette mit der Kurve wie ein Strichstück im SVG.
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

/**
 * Die Lichtbahnen im Raster 1000 × 600, alle von unten links nach oben rechts geschwungen.
 * Farben wie in der App: das Grün des Tages-Rings, das Orange der Ränge, das Lila aus dem Team (Wunsch des Auftraggebers).
 */
export const BAHNEN: Array<{ d: string; farbe: string; dauer: number; verzoegerung: number }> = [
  { d: 'M-60 560 C 180 520, 260 300, 480 330 S 820 300, 1060 60', farbe: '#FE5303', dauer: 7, verzoegerung: 0 },
  { d: 'M-60 660 C 240 640, 320 380, 560 420 S 900 340, 1060 160', farbe: '#00C076', dauer: 9, verzoegerung: -4 },
  { d: 'M-60 420 C 160 460, 300 180, 520 220 S 860 120, 1060 -40', farbe: '#A78BFA', dauer: 11, verzoegerung: -7 }
]

const RASTER_BREITE = 1000
const RASTER_HOEHE = 600
/** Glieder je Funke und ihr Abstand entlang der Bahn (Rasterlängen). */
const GLIEDER = 10
const GLIED_ABSTAND = 13
const SCHRITTE = 80

interface Bahnpfad {
  pfad: SVGPathElement
  laenge: number
}

/** Legt je Bahn einen unsichtbaren SVG-Pfad an, über den sich Punkte entlang der Bahn abfragen lassen. */
function bahnpfadeAnlegen(): { pfade: Bahnpfad[]; entfernen: () => void } {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  svg.setAttribute('aria-hidden', 'true')
  const pfade = BAHNEN.map((b) => {
    const pfad = document.createElementNS(ns, 'path')
    pfad.setAttribute('d', b.d)
    svg.appendChild(pfad)
    return pfad
  })
  document.body.appendChild(svg)
  return { pfade: pfade.map((pfad) => ({ pfad, laenge: pfad.getTotalLength() })), entfernen: () => svg.remove() }
}

/** Startet die Funken-Animationen für die aktuelle Fenstergröße; liefert die Aufräumfunktion. */
function funkenStarten(behaelter: HTMLDivElement, glieder: Array<Array<HTMLDivElement | null>>, pfade: Bahnpfad[]): () => void {
  const breite = behaelter.clientWidth
  const hoehe = behaelter.clientHeight
  const animationen: Animation[] = []
  if (breite === 0 || hoehe === 0) return () => {}
  const sx = breite / RASTER_BREITE
  const sy = hoehe / RASTER_HOEHE
  pfade.forEach(({ pfad, laenge }, i) => {
    const b = BAHNEN[i]
    glieder[i]?.forEach((el, g) => {
      if (!el) return
      const keyframes: Keyframe[] = []
      for (let k = 0; k <= SCHRITTE; k++) {
        // Das Glied g läuft dem Kopf um g Abstände hinterher; am Bahnanfang stauen sich die Glieder kurz.
        const s = Math.max(0, (k / SCHRITTE) * laenge - g * GLIED_ABSTAND)
        const p = pfad.getPointAtLength(s)
        const q = pfad.getPointAtLength(Math.min(laenge, s + 2))
        const r = pfad.getPointAtLength(Math.max(0, s - 2))
        const winkel = Math.atan2((q.y - r.y) * sy, (q.x - r.x) * sx)
        keyframes.push({ transform: `translate3d(${(p.x * sx).toFixed(1)}px, ${(p.y * sy).toFixed(1)}px, 0) rotate(${winkel.toFixed(4)}rad)` })
      }
      animationen.push(
        el.animate(keyframes, {
          duration: b.dauer * 1000,
          delay: b.verzoegerung * 1000,
          iterations: Infinity,
          direction: 'alternate',
          easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
          fill: 'both'
        })
      )
    })
  })
  return () => animationen.forEach((a) => a.cancel())
}

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

  const behaelter = useRef<HTMLDivElement>(null)
  const glieder = useRef<Array<Array<HTMLDivElement | null>>>(BAHNEN.map(() => []))

  // Funken entlang der Bahnen bewegen; bei Größenänderung des Fensters neu berechnen.
  useEffect(() => {
    const el = behaelter.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const { pfade, entfernen } = bahnpfadeAnlegen()
    let aufraeumen = funkenStarten(el, glieder.current, pfade)
    const beobachter = new ResizeObserver(() => {
      aufraeumen()
      aufraeumen = funkenStarten(el, glieder.current, pfade)
    })
    beobachter.observe(el)
    return () => {
      beobachter.disconnect()
      aufraeumen()
      entfernen()
    }
  }, [])

  return (
    <div aria-hidden="true" className="hintergrund pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: -1 }}>
      {/* Raster */}
      <div className="hintergrund-raster absolute inset-0" style={{ backgroundImage: RASTER }} />

      {/*
        Zifferblätter: gedreht wird das umschließende div, nicht das SVG. Eine Drehung direkt am
        SVG-Element läuft in Chromium auf dem Hauptthread und erzwang bei jedem Bild ein Neuzeichnen.
      */}
      <div className="hintergrund-ring absolute" style={{ top: -380, right: -300, width: 960, height: 960 }}>
        <svg className="h-full w-full" viewBox="0 0 960 960">
          <circle cx="480" cy="480" r="440" fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="1.2" strokeDasharray="2 12" />
          <circle cx="480" cy="480" r="400" fill="none" stroke="white" strokeOpacity="0.04" strokeWidth="1" />
        </svg>
      </div>

      {/* Zifferblatt unten links, dreht gegenläufig */}
      <div className="hintergrund-ring-2 absolute" style={{ bottom: -300, left: -260, width: 640, height: 640 }}>
        <svg className="h-full w-full" viewBox="0 0 640 640">
          <circle cx="320" cy="320" r="290" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="1" strokeDasharray="1 9" />
        </svg>
      </div>

      {/* Lichtbahnen: die Bahn selbst kaum sichtbar und unbewegt, darauf je ein zischender Funke */}
      <div ref={behaelter} className="absolute inset-0">
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${RASTER_BREITE} ${RASTER_HOEHE}`} preserveAspectRatio="none">
          {BAHNEN.map((b, i) => (
            <path key={i} d={b.d} fill="none" stroke={b.farbe} strokeOpacity="0.07" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {BAHNEN.map((b, i) =>
          Array.from({ length: GLIEDER }, (_, g) => {
            // Leuchtkraft: in der Mitte der Kette am stärksten, zu beiden Enden schwächer; durchgehend in der
            // Bahnfarbe, bewusst ohne weißen Kern (der Auftraggeber will den Strich rein grün, orange, lila).
            const mitte = (GLIEDER - 1) / 2
            const staerke = 1 - (Math.abs(g - mitte) / mitte) * 0.85
            return (
              <div
                key={`${i}-${g}`}
                ref={(el) => {
                  glieder.current[i][g] = el
                }}
                className="hintergrund-funke absolute"
                style={{
                  left: -15,
                  top: -2.5,
                  width: 30,
                  height: 5,
                  borderRadius: 3,
                  background: b.farbe,
                  opacity: 0.3 + staerke * 0.7,
                  boxShadow: `0 0 ${(5 + staerke * 8).toFixed(0)}px ${b.farbe}, 0 0 ${(12 + staerke * 16).toFixed(0)}px ${b.farbe}99`
                }}
              />
            )
          })
        )}
      </div>

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
