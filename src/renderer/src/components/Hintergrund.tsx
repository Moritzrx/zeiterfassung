import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import { useHintergrundArt } from '../hintergrundart'
import { WORTMARKE } from './wortmarke'

/*
 * Der lebendige Hintergrund hinter allen Screens, in zwei Fassungen (Einstellungen → Darstellung):
 *
 * LOGO (Standard seit 10. September 2026, Wunsch des Auftraggebers): das Linienmuster des wessamedia-Logos
 * (dünne schräge Linien oben und unten) und die Wortmarke "wessamedia" als Wasserzeichen in der Mitte.
 * Orangene Lichtketten fahren die Umrisse der Buchstaben und einige Linien entlang. Die Wortmarke liegt als
 * eigene Ebene ÜBER den Karten (z-index 10, ohne Mausereignisse, unter Dialogen und Leisten), sonst wäre sie
 * hinter dem Milchglas der Karten unsichtbar; sie ist so blass, dass der Vordergrund lesbar bleibt.
 *
 * KLASSISCH: ein feines Instrumenten-Raster, zwei langsam drehende Zifferblatt-Ringe, geschwungene
 * Lichtbahnen in Grün, Orange und Lila und aufsteigende Lichtpunkte.
 *
 * Alles läuft ausschließlich auf dem Compositor (nur transform und opacity), damit der Hauptthread frei bleibt
 * und die Screen-Wechsel flüssig laufen. Die Lichtketten sind deshalb keine SVG-Strichanimation (die zwingt
 * jedes Bild zum Neuzeichnen), sondern je Bahn eine Kette aus kurzen leuchtenden Gliedern, die per
 * Web-Animations-API entlang der abgetasteten Bahn bewegt werden; jedes Glied läuft dem vorigen um ein Stück
 * Bahnlänge hinterher, dadurch biegt sich die Kette mit der Kurve. Die weichen Lichtflecken und das Korn
 * liegen in styles.css (body::before/after).
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

const ORANGE = '#FE5303'
const FARBEN = ['rgba(0, 192, 118, 0.75)', 'rgba(254, 83, 3, 0.6)', 'rgba(255, 255, 255, 0.4)', 'rgba(0, 192, 118, 0.5)']
const FARBEN_LOGO = ['rgba(254, 83, 3, 0.6)', 'rgba(255, 255, 255, 0.35)', 'rgba(254, 83, 3, 0.45)']

const RASTER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cpath d='M56 0H0V56' fill='none' stroke='white' stroke-opacity='0.16' stroke-width='1'/%3E%3Ccircle cx='0' cy='0' r='1' fill='white' fill-opacity='0.35'/%3E%3C/svg%3E\")"

/**
 * Die Lichtbahnen der klassischen Fassung im Raster 1000 × 600, alle von unten links nach oben rechts geschwungen.
 * Farben wie in der App: das Grün des Tages-Rings, das Orange der Ränge, das Lila aus dem Team (Wunsch des Auftraggebers).
 */
export const BAHNEN: Array<{ d: string; farbe: string; dauer: number; verzoegerung: number }> = [
  { d: 'M-60 560 C 180 520, 260 300, 480 330 S 820 300, 1060 60', farbe: ORANGE, dauer: 7, verzoegerung: 0 },
  { d: 'M-60 660 C 240 640, 320 380, 560 420 S 900 340, 1060 160', farbe: '#00C076', dauer: 9, verzoegerung: -4 },
  { d: 'M-60 420 C 160 460, 300 180, 520 220 S 860 120, 1060 -40', farbe: '#A78BFA', dauer: 11, verzoegerung: -7 }
]

/**
 * Das Linienmuster des Logos, frei nachempfunden (Raster 1000 × 600): oben und unten Gruppen dünner,
 * schräger Linien, die wie angeschnittene Buchstaben wirken. Jede Gruppe ist ein durchgehender Linienzug,
 * damit eine Lichtkette ihn abfahren kann; die Mitte bleibt frei für die Wortmarke.
 */
export const MUSTER: string[] = [
  'M-20 30 L110 185 L170 -10 L235 190',
  'M300 -10 L385 185 L455 -10',
  'M345 120 L500 110',
  'M560 190 L600 -10 L690 185',
  'M620 130 L720 40',
  'M790 -10 L860 185 L940 -10 L1020 150',
  'M-20 560 L80 415 L170 610',
  'M40 520 L150 505',
  'M270 610 L350 425 L410 610 L470 430',
  'M540 610 L600 410 L700 610',
  'M560 520 L680 540',
  'M800 610 L870 420 L960 610 L1020 470'
]

/** Welche Musterlinien eine Lichtkette bekommen, mit Tempo und Versatz. */
const MUSTER_KETTEN: Array<{ muster: number; dauer: number; verzoegerung: number }> = [
  { muster: 0, dauer: 9, verzoegerung: 0 },
  { muster: 1, dauer: 7, verzoegerung: -3 },
  { muster: 5, dauer: 10, verzoegerung: -6 },
  { muster: 8, dauer: 8, verzoegerung: -2 },
  { muster: 11, dauer: 9, verzoegerung: -5 }
]
/** Lichtketten auf dem Umriss der Wortmarke: drei gleich schnelle, gleichmäßig versetzt. */
const WORTMARKE_KETTEN = 3
const WORTMARKE_DAUER = 42

const RASTER_BREITE = 1000
const RASTER_HOEHE = 600
/** Glieder je Kette und ihr Abstand entlang der Bahn (Rasterlängen). */
const GLIEDER = 10
const GLIED_ABSTAND = 13

/** Eine Lichtkette: ein Pfad, seine Farbe, das Tempo und die Abbildung von Pfad- auf Bildschirmkoordinaten. */
interface Kette {
  pfad: SVGPathElement
  farbe: string
  dauer: number
  verzoegerung: number
  /** alternate = hin und zurück (offene Bahn), normal = immer weiter (geschlossener Umriss) */
  richtung: 'alternate' | 'normal'
  /** Abstand der Glieder in Pfadeinheiten */
  abstand: number
  /** Bildet einen Pfadpunkt auf Pixel im Behälter ab */
  abbilden: (x: number, y: number) => [number, number]
}

/** Legt unsichtbare SVG-Pfade an, über die sich Punkte entlang einer Bahn abfragen lassen. */
function pfadeAnlegen(ds: string[]): { pfade: SVGPathElement[]; entfernen: () => void } {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  svg.setAttribute('aria-hidden', 'true')
  const pfade = ds.map((d) => {
    const pfad = document.createElementNS(ns, 'path')
    pfad.setAttribute('d', d)
    svg.appendChild(pfad)
    return pfad
  })
  document.body.appendChild(svg)
  return { pfade, entfernen: () => svg.remove() }
}

/** Startet die Ketten-Animationen; liefert die Aufräumfunktion. */
function kettenStarten(ketten: Kette[], glieder: Array<Array<HTMLDivElement | null>>): () => void {
  const animationen: Animation[] = []
  ketten.forEach((k, i) => {
    const laenge = k.pfad.getTotalLength()
    if (!laenge) return
    // Offene Bahnen: 80 Schritte reichen; geschlossene Umrisse (Buchstaben) brauchen einen Schritt je 8 Einheiten.
    const schritte = k.richtung === 'alternate' ? 80 : Math.min(1200, Math.max(60, Math.round(laenge / 8)))
    glieder[i]?.forEach((el, g) => {
      if (!el) return
      const keyframes: Keyframe[] = []
      for (let s = 0; s <= schritte; s++) {
        // Das Glied g läuft dem Kopf um g Abstände hinterher: auf offenen Bahnen staut es sich am Anfang,
        // auf geschlossenen Umrissen kommt es von hinten herum, damit der Lauf nahtlos wiederholt.
        const roh = (s / schritte) * laenge - g * k.abstand
        const lage = k.richtung === 'alternate' ? Math.max(0, roh) : ((roh % laenge) + laenge) % laenge
        const p = k.pfad.getPointAtLength(lage)
        const q = k.pfad.getPointAtLength(Math.min(laenge, lage + 2))
        const r = k.pfad.getPointAtLength(Math.max(0, lage - 2))
        const [px, py] = k.abbilden(p.x, p.y)
        const [qx, qy] = k.abbilden(q.x, q.y)
        const [rx, ry] = k.abbilden(r.x, r.y)
        const winkel = Math.atan2(qy - ry, qx - rx)
        keyframes.push({ transform: `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) rotate(${winkel.toFixed(4)}rad)` })
      }
      animationen.push(
        el.animate(keyframes, {
          duration: k.dauer * 1000,
          delay: k.verzoegerung * 1000,
          iterations: Infinity,
          direction: k.richtung,
          easing: k.richtung === 'alternate' ? 'cubic-bezier(0.45, 0, 0.55, 1)' : 'linear',
          fill: 'both'
        })
      )
    })
  })
  return () => animationen.forEach((a) => a.cancel())
}

/** Die Glieder einer Kette: leuchtende Pillen, in der Mitte am hellsten, durchgehend in der Bahnfarbe (ohne weißen Kern). */
function Glieder({
  farbe,
  setzen,
  staerke = 1,
  laenge = 30,
  dicke = 5
}: {
  farbe: string
  setzen: (g: number, el: HTMLDivElement | null) => void
  staerke?: number
  /** Maße eines Glieds in Pixeln (auf den engen Buchstaben-Umrissen kleiner) */
  laenge?: number
  dicke?: number
}): ReactElement {
  return (
    <>
      {Array.from({ length: GLIEDER }, (_, g) => {
        const mitte = (GLIEDER - 1) / 2
        const kraft = (1 - (Math.abs(g - mitte) / mitte) * 0.85) * staerke
        return (
          <div
            key={g}
            ref={(el) => setzen(g, el)}
            className="hintergrund-funke absolute"
            style={{
              left: -laenge / 2,
              top: -dicke / 2,
              width: laenge,
              height: dicke,
              borderRadius: dicke,
              background: farbe,
              opacity: 0.3 + kraft * 0.7,
              boxShadow: `0 0 ${(4 + kraft * 7).toFixed(0)}px ${farbe}, 0 0 ${(10 + kraft * 14).toFixed(0)}px ${farbe}99`
            }}
          />
        )
      })}
    </>
  )
}

function Lichtpunkte({ partikel }: { partikel: Partikel[] }): ReactElement {
  return (
    <>
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
    </>
  )
}

function partikelErzeugen(anzahl: number, farben: string[], saat: number): Partikel[] {
  const z = zufall(saat)
  return Array.from({ length: anzahl }, (_, i) => ({
    links: z() * 100,
    groesse: 2 + z() * 3,
    dauer: 22 + z() * 26,
    verzoegerung: -z() * 40,
    farbe: farben[i % farben.length],
    drift: (z() - 0.5) * 120
  }))
}

function bewegungReduziert(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* ------------------------------------------------------------------------------------------------ */

/** Die klassische Fassung: Raster, Zifferblätter, geschwungene Lichtbahnen, Lichtpunkte. */
function HintergrundKlassisch(): ReactElement {
  const partikel = useMemo(() => partikelErzeugen(44, FARBEN, 7), [])
  const behaelter = useRef<HTMLDivElement>(null)
  const glieder = useRef<Array<Array<HTMLDivElement | null>>>(BAHNEN.map(() => []))

  // Funken entlang der Bahnen bewegen; bei Größenänderung des Fensters neu berechnen.
  useEffect(() => {
    const el = behaelter.current
    if (!el || bewegungReduziert()) return
    const { pfade, entfernen } = pfadeAnlegen(BAHNEN.map((b) => b.d))
    const starten = (): (() => void) => {
      const breite = el.clientWidth
      const hoehe = el.clientHeight
      if (!breite || !hoehe) return () => {}
      const sx = breite / RASTER_BREITE
      const sy = hoehe / RASTER_HOEHE
      const ketten: Kette[] = BAHNEN.map((b, i) => ({
        pfad: pfade[i],
        farbe: b.farbe,
        dauer: b.dauer,
        verzoegerung: b.verzoegerung,
        richtung: 'alternate',
        abstand: GLIED_ABSTAND,
        abbilden: (x, y) => [x * sx, y * sy]
      }))
      return kettenStarten(ketten, glieder.current)
    }
    let aufraeumen = starten()
    const beobachter = new ResizeObserver(() => {
      aufraeumen()
      aufraeumen = starten()
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
        {BAHNEN.map((b, i) => (
          <Glieder
            key={i}
            farbe={b.farbe}
            setzen={(g, el) => {
              glieder.current[i][g] = el
            }}
          />
        ))}
      </div>

      <Lichtpunkte partikel={partikel} />
    </div>
  )
}

/* ------------------------------------------------------------------------------------------------ */

/** Die Logo-Fassung: Linienmuster hinten, Wortmarke als Wasserzeichen vorn, orangene Lichtketten auf beidem. */
function HintergrundLogo(): ReactElement {
  const partikel = useMemo(() => partikelErzeugen(30, FARBEN_LOGO, 11), [])
  const hinten = useRef<HTMLDivElement>(null)
  const vorn = useRef<HTMLDivElement>(null)
  const wortmarkeSvg = useRef<SVGSVGElement>(null)
  const umriss = useRef<SVGPathElement>(null)
  const musterPfade = useRef<Array<SVGPathElement | null>>([])
  const musterGlieder = useRef<Array<Array<HTMLDivElement | null>>>(MUSTER_KETTEN.map(() => []))
  const wortGlieder = useRef<Array<Array<HTMLDivElement | null>>>(Array.from({ length: WORTMARKE_KETTEN }, () => []))

  // Der Umriss für die Lichtketten: nur die äußeren Konturen (die kleinen Innenflächen lassen wir aus).
  const umrissD = useMemo(() => WORTMARKE.pfade.filter((d) => d.length > 60).join(' '), [])
  const alleD = useMemo(() => WORTMARKE.pfade.join(' '), [])

  useEffect(() => {
    const h = hinten.current
    const v = vorn.current
    const svg = wortmarkeSvg.current
    const pfad = umriss.current
    if (!h || !v || !svg || !pfad || bewegungReduziert()) return
    const starten = (): (() => void) => {
      const breite = h.clientWidth
      const hoehe = h.clientHeight
      if (!breite || !hoehe) return () => {}
      const sx = breite / RASTER_BREITE
      const sy = hoehe / RASTER_HOEHE
      const musterKetten: Kette[] = []
      MUSTER_KETTEN.forEach((mk) => {
        const p = musterPfade.current[mk.muster]
        if (!p) return
        musterKetten.push({
          pfad: p,
          farbe: ORANGE,
          dauer: mk.dauer,
          verzoegerung: mk.verzoegerung,
          richtung: 'alternate',
          abstand: GLIED_ABSTAND,
          abbilden: (x, y) => [x * sx, y * sy]
        })
      })
      // Die Wortmarke behält ihr Seitenverhältnis: Lage und Maßstab aus dem gezeichneten SVG.
      const kasten = svg.getBoundingClientRect()
      const massstab = kasten.width / WORTMARKE.breite
      const wortKetten: Kette[] = Array.from({ length: WORTMARKE_KETTEN }, (_, i) => ({
        pfad,
        farbe: ORANGE,
        dauer: WORTMARKE_DAUER,
        verzoegerung: (-WORTMARKE_DAUER * i) / WORTMARKE_KETTEN,
        richtung: 'normal',
        abstand: 6 / Math.max(0.2, massstab),
        abbilden: (x, y) => [kasten.left + x * massstab, kasten.top + y * massstab]
      }))
      const stopp1 = kettenStarten(musterKetten, musterGlieder.current)
      const stopp2 = kettenStarten(wortKetten, wortGlieder.current)
      return () => {
        stopp1()
        stopp2()
      }
    }
    let aufraeumen = starten()
    const beobachter = new ResizeObserver(() => {
      aufraeumen()
      aufraeumen = starten()
    })
    beobachter.observe(h)
    return () => {
      beobachter.disconnect()
      aufraeumen()
    }
  }, [])

  return (
    <>
      {/* Ebene hinten: Raster, Linienmuster, Lichtketten auf den Linien, Lichtpunkte */}
      <div aria-hidden="true" className="hintergrund pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: -1 }}>
        <div className="hintergrund-raster absolute inset-0" style={{ backgroundImage: RASTER, opacity: 0.45 }} />
        <div ref={hinten} className="absolute inset-0">
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${RASTER_BREITE} ${RASTER_HOEHE}`} preserveAspectRatio="none">
            {MUSTER.map((d, i) => (
              <path
                key={i}
                ref={(el) => {
                  musterPfade.current[i] = el
                }}
                d={d}
                fill="none"
                stroke="white"
                strokeOpacity="0.11"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {MUSTER_KETTEN.map((_, i) => (
            <Glieder
              key={i}
              farbe={ORANGE}
              setzen={(g, el) => {
                musterGlieder.current[i][g] = el
              }}
            />
          ))}
        </div>
        <Lichtpunkte partikel={partikel} />
      </div>

      {/* Ebene vorn: die Wortmarke als blasses Wasserzeichen über den Karten, mit Lichtketten auf dem Umriss */}
      <div ref={vorn} aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 10 }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            ref={wortmarkeSvg}
            viewBox={`0 0 ${WORTMARKE.breite} ${WORTMARKE.hoehe}`}
            style={{ width: 'min(78vw, 1150px)', height: 'auto', overflow: 'visible' }}
          >
            <path d={alleD} fill="white" fillOpacity="0.04" fillRule="evenodd" stroke="white" strokeOpacity="0.07" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <path ref={umriss} d={umrissD} fill="none" stroke="none" />
          </svg>
        </div>
        {Array.from({ length: WORTMARKE_KETTEN }, (_, i) => (
          <Glieder
            key={i}
            farbe={ORANGE}
            staerke={0.6}
            laenge={16}
            dicke={3}
            setzen={(g, el) => {
              wortGlieder.current[i][g] = el
            }}
          />
        ))}
      </div>
    </>
  )
}

/** Wählt die Fassung nach der Einstellung; der Schlüssel baut die Ebenen beim Umschalten sauber neu auf. */
export function Hintergrund(): ReactElement {
  const art = useHintergrundArt()
  return art === 'klassisch' ? <HintergrundKlassisch key="klassisch" /> : <HintergrundLogo key="logo" />
}
