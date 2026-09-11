import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import { useHintergrundArt } from '../hintergrundart'
import { WORTMARKE, WORTMARKE_BAHN_OBEN, WORTMARKE_BAHN_UNTEN } from './wortmarke'

/*
 * Der lebendige Hintergrund hinter allen Screens, in zwei Fassungen (Einstellungen → Darstellung):
 *
 * LOGO (Standard seit 10. September 2026, Wunsch des Auftraggebers): das Linienmuster des wessamedia-Logos
 * (dünne schräge Linien oben und unten) und die Wortmarke "wessamedia" als Wasserzeichen in der Mitte.
 * Orangene Lichter laufen auf ZWEI Bahnen von links nach rechts durch die Schrift: jeder Buchstabe ist an seinem
 * linkesten und rechtesten Punkt geteilt, eine Bahn fährt die obere Hälfte seines Randes ab, die andere die untere
 * (`WORTMARKE_BAHN_OBEN/UNTEN`, exakt die Konturen, zusammen der ganze Rand); am Buchstabenende blendet das Licht
 * aus und beim nächsten wieder ein, keine Brücke. Dazu die Musterlinien, 1:1 aus dem Logo-Bild (`MUSTER`).
 * Gezeichnet auf einer Leinwand als durchgehende Linien mit Komet-Verlauf (Rückmeldungen vom 10. September 2026). Die Wortmarke liegt als eigene Ebene ÜBER den Karten
 * (z-index 10, ohne Mausereignisse, unter Dialogen und Leisten), sonst wäre sie hinter dem Milchglas der
 * Karten unsichtbar; sie ist so blass, dass der Vordergrund lesbar bleibt.
 *
 * KLASSISCH: ein feines Instrumenten-Raster, zwei langsam drehende Zifferblatt-Ringe, geschwungene
 * Lichtbahnen in Grün, Orange und Lila und aufsteigende Lichtpunkte.
 *
 * Alles läuft ausschließlich auf dem Compositor (nur transform und opacity), damit der Hauptthread frei bleibt
 * und die Screen-Wechsel flüssig laufen. Die Lichter sind deshalb keine SVG-Strichanimation (die zwingt jedes
 * Bild zum Neuzeichnen), sondern je Bahn eine Kette aus kurzen leuchtenden Gliedern, die per
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
 * Das Linienmuster des Logos, exakt aus dem Logo-Bild abgenommen (10. September 2026, "bitte eins zu eins",
 * zweite Fassung nach "mehrere Striche übereinander"): Scratchpad muster-skelett.cjs maskiert die hellen Linien
 * (Helligkeit > 160, ohne das Band der Wortmarke), dünnt sie auf ein Pixel aus (Zhang-Suen), verfolgt das Skelett
 * von Knoten zu Knoten (Enden und Verzweigungen über die Übergangszahl), vereinfacht jede Kette zur Geraden, legt
 * kollineare Stücke über Kreuzungen und T-Knoten hinweg zu EINER Geraden zusammen, zieht nahe Enden auf einen
 * Punkt bzw. auf die getroffene Linie und verbindet Ecken (genau zwei Enden) zu Linienzügen. 28 Züge, jeder beginnt
 * am Ende, das weiter von der Wortmarke weg liegt (die Lichter laufen von außen zur Schrift). Raster 1000 × 523 =
 * das Bild 1440 × 753 GLEICHMÄSSIG skaliert; im Fenster wird das Muster wie preserveAspectRatio "slice" auf die
 * Fensterhöhe oder -breite gezogen und mittig beschnitten, nie verzerrt. Nur M und L; die Mitte bleibt frei.
 */
export const MUSTER: string[] = [
  'M0.5 -26.4 L65.3 173.6',
  'M34.9 542.9 L207.6 350.7',
  'M124.3 352.1 L143.1 413.2 L35.4 351.4',
  'M43.1 -19.1 L247.2 175.0',
  'M146.8 79.5 L77.8 173.6',
  'M204.2 -25.8 L284.0 172.9',
  'M205.0 548.5 L271.5 351.4',
  'M303.4 -7.3 L224.9 25.7',
  'M380.2 539.4 L244.1 432.5',
  'M417.4 11.8 L340.3 173.6',
  'M352.3 148.4 L465.6 150.6',
  'M436.1 548.0 L356.9 352.1',
  'M374.9 396.4 L439.6 350.7',
  'M422.2 -26.9 L417.4 11.8',
  'M417.4 11.8 L473.6 173.6',
  'M471.0 531.1 L632.6 351.4',
  'M471.6 548.7 L531.3 357.3 L560.0 432.1',
  'M642.6 -26.6 L583.3 173.6',
  'M596.4 129.4 L645.8 174.3',
  'M610.4 -25.7 L691.0 172.9',
  'M623.0 548.5 L689.6 352.1',
  'M753.3 -9.6 L637.2 40.4',
  'M774.4 539.6 L663.9 450.7',
  'M853.4 -25.2 L760.4 173.6',
  'M843.8 547.9 L763.9 352.1',
  'M882.4 -26.7 L940.3 170.1 L772.7 147.5',
  'M788.1 411.4 L873.6 350.7',
  'M891.5 548.9 L949.3 351.4'
]

/**
 * Lichter auf dem Muster: sechs Lichter, jedes fährt seine Linien nacheinander ab (Ablaufplan, siehe `Licht`), mit
 * festem Tempo in Rastereinheiten je Sekunde; Kette aus 22 Gliedern. Mit den Pausen (0,8–2,4 s) sind im Schnitt
 * drei bis vier Lichter gleichzeitig unterwegs, etwa so viele wie vorher mit vier Dauerlichtern.
 */
const MUSTER_LICHTER = 6
const MUSTER_TEMPO = 150
const MUSTER_GLIEDER = 22
/**
 * Lichter auf den Rand-Bahnen der Wortmarke: fünf oben, vier unten, 48 Glieder (11. September 2026, "ein paar mehr
 * Lichtstreifen, damit die Schrift durchgehender beleuchtet ist": vorher 3 + 2 mit 44 Gliedern, rund 15 % der Ränder
 * gleichzeitig beleuchtet, jetzt rund 30 %). Tempo in Wortmarken-Einheiten je Sekunde.
 */
const WORTMARKE_LICHTER_OBEN = 5
const WORTMARKE_LICHTER_UNTEN = 4
const WORTMARKE_TEMPO = 90
const WORTMARKE_GLIEDER = 48
/** Abstand der Kettenglieder auf der Leinwand (Einheiten der jeweiligen Bahn). */
const GLIED = 3.5

const RASTER_BREITE = 1000
const RASTER_HOEHE = 600
/** Raster des Logo-Musters, seitenrichtig zum Logo-Bild (1440 × 753). */
const MUSTER_BREITE = 1000
const MUSTER_HOEHE = 523
/** Abstand der Glieder entlang der Bahn in der klassischen Fassung (Rasterlängen). */
const GLIED_ABSTAND = 13

/** Eine Lichtkette: ein Pfad, seine Farbe, das Tempo und die Abbildung von Pfad- auf Bildschirmkoordinaten. */
interface Kette {
  pfad: SVGPathElement
  dauer: number
  verzoegerung: number
  /** alternate = hin und zurück (klassische Bahnen), normal = immer in eine Richtung, mit Ein- und Ausblenden */
  richtung: 'alternate' | 'normal'
  /** Abstand der Glieder in Pfadeinheiten */
  abstand: number
  /** Anteil der Laufzeit (0 bis 0,8), den das Licht nach dem Ausblenden unsichtbar wartet, bevor es wieder startet */
  pause?: number
  /**
   * Bei einem Pfad aus mehreren Teilstücken (Musterlinien in einem Pfad): die Längen, bei denen ein Teilstück
   * endet, aufsteigend. Das Licht blendet an jedem Teilstück-Ende aus und am nächsten Anfang ein, der Sprung
   * dazwischen bleibt unsichtbar. So bedient eine Kette alle Linien statt zwölf Ketten.
   */
  grenzen?: number[]
}

/*
 * Die Keyframes werden in den EINHEITEN des Pfads gerechnet, nie in Pixeln: Der Behälter der Glieder wird per
 * CSS-Transform auf die Fenstergröße skaliert (`skalieren`). Beim Vergrößern des Fensters ändert sich nur diese
 * eine Transform, keine Animation wird neu gebaut. Vorher wurden bei jeder Größenänderung alle Keyframes neu
 * berechnet (hunderttausende getPointAtLength-Aufrufe), das ließ die App beim Maximieren kurz hängen
 * (Rückmeldung vom 10. September 2026). Die Glieder skalieren mit (ein Versuch, sie per CSS-Variablen
 * gleich groß zu halten, kostete beim Maximieren 190 ms Style-Neuberechnung für alle Glieder).
 */
function skalieren(el: HTMLElement, sx: number, sy: number, dx = 0, dy = 0): void {
  el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${sx.toFixed(5)}, ${sy.toFixed(5)})`
}

/**
 * Abgetastete Bahn: ein Punkt alle 2 Einheiten, dazwischen linear; spart hunderttausende getPointAtLength-Aufrufe.
 * Wo im Pfad ein Teilstück endet und das nächste beginnt (M im Pfad), liegt ein SPRUNG mitten in einem
 * Abtastintervall. Für jedes solche Intervall steht in `spruenge`, bei welcher Länge genau der Sprung liegt (per
 * Bisektion auf 0,0001 Einheiten gesucht) und wo der Pfad unmittelbar davor und danach ist; `bei` interpoliert
 * dann bis exakt an das Ende der einen Linie bzw. ab dem Anfang der nächsten. Vorher lag der Zwischenwert
 * irgendwo auf der Geraden zwischen zwei Linien, quer über den Bildschirm, und das Licht zeichnete dorthin einen
 * Strich: das "orangene Aufblitzen" (Rückmeldung vom 10. September 2026). Ein erster Versuch, einfach auf den
 * näheren Abtastpunkt zu springen, reichte nicht: Lag der Sprung in der ersten Hälfte des Intervalls, landete ein
 * Punkt, der noch zur alten Linie gehört, schon auf der neuen, und der Strich blieb (per Pixelprüfung im
 * Scratchpad `licht-pruefen.js` nachgewiesen: 5 500 leuchtende Pixel abseits aller Linien in einem Bild).
 */
interface Abtastung {
  laenge: number
  punkte: Float64Array
  /** Schlüssel = Abtastintervall i (zwischen Punkt i und i+1), in dem ein Teilstück endet */
  spruenge: Map<number, { bei: number; vor: [number, number]; nach: [number, number] }>
  /** Alle Sprungstellen (Längen) aufsteigend */
  sprungLagen: Float64Array
}
const ABTAST = 2
const abtastungen = new WeakMap<SVGPathElement, Abtastung>()
const keyframeSpeicher = new WeakMap<SVGPathElement, Map<string, Keyframe[]>>()

function abtasten(pfad: SVGPathElement): Abtastung {
  const bekannt = abtastungen.get(pfad)
  if (bekannt) return bekannt
  const laenge = pfad.getTotalLength()
  const n = Math.max(2, Math.ceil(laenge / ABTAST) + 1)
  const punkte = new Float64Array(n * 2)
  const spruenge: Abtastung['spruenge'] = new Map()
  for (let i = 0; i < n; i++) {
    const p = pfad.getPointAtLength(Math.min(laenge, i * ABTAST))
    punkte[i * 2] = p.x
    punkte[i * 2 + 1] = p.y
    // Zwei Abtastpunkte liegen 2 Einheiten auseinander; ein deutlich größerer Abstand ist ein Sprung.
    if (i > 0 && Math.hypot(p.x - punkte[(i - 1) * 2], p.y - punkte[(i - 1) * 2 + 1]) > ABTAST * 2.5) {
      // Die genaue Sprungstelle suchen: Solange ein Punkt höchstens so weit vom letzten sicheren Punkt entfernt
      // liegt wie sein Längenabstand, gehört er noch zur alten Linie (auf einer Linie ist der Luftweg nie länger
      // als der Weg entlang der Linie).
      let lo = (i - 1) * ABTAST
      let hi = Math.min(laenge, i * ABTAST)
      let vor: [number, number] = [punkte[(i - 1) * 2], punkte[(i - 1) * 2 + 1]]
      for (let k = 0; k < 16; k++) {
        const mitte = (lo + hi) / 2
        const q = pfad.getPointAtLength(mitte)
        if (Math.hypot(q.x - vor[0], q.y - vor[1]) <= mitte - lo + 0.01) {
          lo = mitte
          vor = [q.x, q.y]
        } else hi = mitte
      }
      const nach = pfad.getPointAtLength(hi)
      spruenge.set(i - 1, { bei: hi, vor, nach: [nach.x, nach.y] })
    }
  }
  const sprungLagen = Float64Array.from([...spruenge.values()].map((s) => s.bei).sort((p, q) => p - q))
  const a = { laenge, punkte, spruenge, sprungLagen }
  abtastungen.set(pfad, a)
  return a
}

function bei(a: Abtastung, lage: number): [number, number] {
  const n = a.punkte.length / 2
  const l = Math.min(Math.max(lage, 0), a.laenge)
  const t = l / ABTAST
  const i = Math.min(Math.floor(t), n - 2)
  const f = Math.min(1, t - i)
  const s = a.spruenge.get(i)
  if (s) {
    const l0 = i * ABTAST
    const l1 = Math.min(a.laenge, (i + 1) * ABTAST)
    if (l < s.bei) {
      // Noch auf der alten Linie: vom Abtastpunkt bis genau an ihr Ende.
      const g = (l - l0) / Math.max(1e-6, s.bei - l0)
      return [a.punkte[i * 2] * (1 - g) + s.vor[0] * g, a.punkte[i * 2 + 1] * (1 - g) + s.vor[1] * g]
    }
    // Schon auf der neuen Linie: von ihrem Anfang bis zum nächsten Abtastpunkt.
    const g = (l - s.bei) / Math.max(1e-6, l1 - s.bei)
    return [s.nach[0] * (1 - g) + a.punkte[(i + 1) * 2] * g, s.nach[1] * (1 - g) + a.punkte[(i + 1) * 2 + 1] * g]
  }
  return [a.punkte[i * 2] * (1 - f) + a.punkte[(i + 1) * 2] * f, a.punkte[i * 2 + 1] * (1 - f) + a.punkte[(i + 1) * 2 + 1] * f]
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
    const a = abtasten(k.pfad)
    const laenge = a.laenge
    if (!laenge) return
    const anzahl = glieder[i]?.length ?? 0
    // Bei 'normal' läuft der Kopf um eine Kettenlänge über das Ende hinaus, damit auch das letzte Glied die
    // Bahn verlässt; vorher blieb die Kette am Ende stehen und verblasste dort langsam ("bleibt stehen").
    const kettenLaenge = k.richtung === 'normal' ? Math.max(0, anzahl - 1) * k.abstand : 0
    const strecke = laenge + kettenLaenge
    // Ein Schritt je 12 Einheiten, damit auch enge Kurven sauber nachgefahren werden; wenige Keyframes halten
    // den Compositor leicht (jeder Commit schiebt alle Keyframes hinüber).
    const schritte = Math.min(800, Math.max(60, Math.round(strecke / 12)))
    // Am Anfang und Ende jedes Teilstücks blendet jedes Glied über dieses Stück ein bzw. aus (nur bei 'normal').
    const grenzen = k.grenzen && k.grenzen.length ? k.grenzen : [laenge]
    const kuerzestes = grenzen.reduce((min, ende, idx) => Math.min(min, ende - (idx ? grenzen[idx - 1] : 0)), laenge)
    const blende = Math.min(kuerzestes * 0.2, 60)
    const sichtbarkeit = (lage: number): number => {
      if (lage < 0 || lage > laenge) return 0
      let anfang = 0
      for (const ende of grenzen) {
        if (lage <= ende) return Math.max(0, Math.min(1, (lage - anfang) / blende, (ende - lage) / blende))
        anfang = ende
      }
      return 0
    }
    const pause = k.richtung === 'normal' ? Math.min(0.8, Math.max(0, k.pause ?? 0)) : 0
    // Gleiche Bahn, gleiche Kette: die Keyframes werden je Glied nur einmal gebaut (die Lichter der
    // Wortmarke unterscheiden sich nur im Versatz).
    const speicher = keyframeSpeicher.get(k.pfad) ?? new Map<string, Keyframe[]>()
    keyframeSpeicher.set(k.pfad, speicher)
    glieder[i]?.forEach((el, g) => {
      if (!el) return
      const grund = Number.parseFloat(el.style.opacity || '1')
      const schluessel = `${g}|${anzahl}|${k.abstand}|${k.richtung}|${pause}|${grund}|${grenzen.length}`
      let keyframes = speicher.get(schluessel)
      if (!keyframes) {
        keyframes = []
        for (let s = 0; s <= schritte; s++) {
          // Das Glied g läuft dem Kopf um g Abstände hinterher: auf Hin-und-zurück-Bahnen staut es sich am
          // Anfang, sonst wartet es unsichtbar vor dem Anfang und verschwindet hinter dem Ende.
          const roh = (s / schritte) * strecke - g * k.abstand
          const lage = k.richtung === 'alternate' ? Math.max(0, roh) : Math.min(laenge, Math.max(0, roh))
          const [px, py] = bei(a, lage)
          const [qx, qy] = bei(a, lage + 2)
          const [rx, ry] = bei(a, lage - 2)
          const winkel = Math.atan2(qy - ry, qx - rx)
          const frame: Keyframe = { transform: `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0) rotate(${winkel.toFixed(4)}rad)` }
          if (k.richtung === 'normal') {
            frame.opacity = (grund * sichtbarkeit(roh)).toFixed(3)
            // Mit Pause: der Lauf belegt nur den vorderen Teil der Zeit, danach wartet das Glied unsichtbar.
            if (pause > 0) frame.offset = (s / schritte) * (1 - pause)
          }
          keyframes.push(frame)
        }
        if (pause > 0) keyframes.push({ ...keyframes[keyframes.length - 1], opacity: '0', offset: 1 })
        speicher.set(schluessel, keyframes)
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

/**
 * Die Glieder einer Kette: kurze leuchtende Striche, die sich entlang der Bahn drehen und überlappen, sodass
 * sie wie eine durchgehende Linie wirken (Rückmeldung vom 10. September 2026: "keine Punkte, eine Linie").
 * Maße in Einheiten des skalierten Behälters. `komet`: vorne hell, nach hinten verglühend (Lichter, die in
 * eine Richtung laufen); sonst in der Mitte am hellsten (klassische Bahnen, die hin- und zurücklaufen).
 */
function Glieder({
  farbe,
  setzen,
  anzahl = 10,
  staerke = 1,
  laenge = 30,
  dicke = 5,
  komet = false
}: {
  farbe: string
  setzen: (g: number, el: HTMLDivElement | null) => void
  anzahl?: number
  staerke?: number
  laenge?: number
  dicke?: number
  komet?: boolean
}): ReactElement {
  return (
    <>
      {Array.from({ length: anzahl }, (_, g) => {
        const mitte = (anzahl - 1) / 2
        const kraft = (komet ? 1 - (g / Math.max(1, anzahl - 1)) * 0.9 : 1 - (Math.abs(g - mitte) / mitte) * 0.85) * staerke
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
              opacity: (komet ? 0.15 : 0.3) + kraft * (komet ? 0.85 : 0.7),
              boxShadow: `0 0 ${(3 + kraft * 6).toFixed(0)}px ${farbe}, 0 0 ${(8 + kraft * 14).toFixed(0)}px ${farbe}99`
            }}
          />
        )
      })}
    </>
  )
}

/** Die aufsteigenden Lichtpunkte; `hof` gibt jedem einen atmenden weichen Hof (Logo-Fassung). */
function Lichtpunkte({ partikel, hof = false }: { partikel: Partikel[]; hof?: boolean }): ReactElement {
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
            ['--drift' as string]: `${p.drift}px`,
            ['--farbe' as string]: p.farbe
          }}
        >
          {hof && <span className="hintergrund-hof" style={{ animationDelay: `${p.verzoegerung}s` }} />}
        </span>
      ))}
    </>
  )
}

function partikelErzeugen(anzahl: number, farben: string[], saat: number, groesseFaktor = 1): Partikel[] {
  const z = zufall(saat)
  return Array.from({ length: anzahl }, (_, i) => ({
    links: z() * 100,
    groesse: (2 + z() * 3) * groesseFaktor,
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
  const skalierer = useRef<HTMLDivElement>(null)
  const glieder = useRef<Array<Array<HTMLDivElement | null>>>(BAHNEN.map(() => []))

  // Funken entlang der Bahnen bewegen (einmal gerechnet); bei Größenänderung nur den Maßstab anpassen.
  useEffect(() => {
    const el = behaelter.current
    const sk = skalierer.current
    if (!el || !sk || bewegungReduziert()) return
    const { pfade, entfernen } = pfadeAnlegen(BAHNEN.map((b) => b.d))
    const ketten: Kette[] = BAHNEN.map((b, i) => ({
      pfad: pfade[i],
      dauer: b.dauer,
      verzoegerung: b.verzoegerung,
      richtung: 'alternate',
      abstand: GLIED_ABSTAND
    }))
    const aufraeumen = kettenStarten(ketten, glieder.current)
    const anpassen = (): void => {
      if (el.clientWidth && el.clientHeight) skalieren(sk, el.clientWidth / RASTER_BREITE, el.clientHeight / RASTER_HOEHE)
    }
    anpassen()
    const beobachter = new ResizeObserver(anpassen)
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
        <div ref={skalierer} className="absolute top-0 left-0" style={{ width: RASTER_BREITE, height: RASTER_HOEHE, transformOrigin: '0 0' }}>
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
      </div>

      <Lichtpunkte partikel={partikel} />
    </div>
  )
}

/* ------------------------------------------------------------------------------------------------ */

/** Ein Teilstück einer Bahn (Pfadlängen von … bis), das ein Licht in einem Lauf komplett abfährt. */
interface Teil {
  anfang: number
  ende: number
}

/** Ein Lauf im Ablaufplan eines Lichts: welches Teilstück, von welcher bis welcher Sekunde im Zyklus. */
interface Lauf {
  teil: number
  start: number
  ende: number
}

/**
 * Ein Licht auf der Leinwand. Es fährt nach einem festen Ablaufplan (`plan`, Sekunden im Zyklus) seine
 * Teilstücke ab, immer mit demselben Tempo (Einheiten je Sekunde, lange Linien dauern also länger), und wartet
 * dazwischen unsichtbar. Vorher liefen alle Musterlinien als EIN langer Pfad in fester Zeit: kurze Querstriche
 * blitzten dabei nur für Zehntelsekunden auf, lange Linien rasten (Rückmeldung vom 10. September 2026,
 * "die Lichtstreifen müssen verbessert werden").
 */
interface Licht {
  tabelle: Abtastung
  teile: Teil[]
  plan: Lauf[]
  /** Länge des Ablaufplans in Sekunden; danach beginnt er von vorn */
  zyklus: number
  tempo: number
  /** Verschiebung in Sekunden, damit gleiche Pläne nicht gleichzeitig laufen */
  versatz: number
  glieder: number
  abstand: number
  /** Strecke in Einheiten, auf der das Licht am Anfang und Ende eines Teilstücks ein- bzw. ausblendet */
  blende: number
  /** Bahnpunkt (Einheiten) → Bildschirm (Pixel), liest die aktuellen Maßstäbe */
  abbilden: (x: number, y: number) => [number, number]
}

/**
 * Baut den Ablaufplan eines Lichts: die Teilstücke in der gegebenen Reihenfolge, je Lauf so lang, wie das Licht
 * mit seinem Tempo braucht, bis auch der Schwanz der Kette das Ende erreicht hat, dazwischen die Pausen.
 */
function planBauen(teile: Teil[], reihenfolge: number[], tempo: number, kette: number, pause: (i: number) => number): { plan: Lauf[]; zyklus: number } {
  const plan: Lauf[] = []
  let t = 0
  reihenfolge.forEach((teil, i) => {
    const dauer = (teile[teil].ende - teile[teil].anfang + kette) / tempo
    plan.push({ teil, start: t, ende: t + dauer })
    t += dauer + pause(i)
  })
  return { plan, zyklus: t }
}

/** Teilstücke einer Bahn aus ihren Sprüngen (M im Pfad): jedes Teilstück reicht von einem Sprung zum nächsten. */
function teileAusSpruengen(a: Abtastung): Teil[] {
  const teile: Teil[] = []
  let anfang = 0
  for (const s of a.sprungLagen) {
    if (s - anfang > 1) teile.push({ anfang, ende: s })
    anfang = s
  }
  if (a.laenge - anfang > 1) teile.push({ anfang, ende: a.laenge })
  return teile
}

/** Liegt zwischen den Längen l1 und l2 (beliebige Reihenfolge) ein Sprung der Bahn? */
function sprungZwischen(a: Abtastung, l1: number, l2: number): boolean {
  const von = Math.min(l1, l2)
  const bis = Math.max(l1, l2)
  for (const s of a.sprungLagen) {
    if (s > bis) return false
    if (s > von) return true
  }
  return false
}

/** Der letzte Sprung vor und der nächste Sprung nach der Länge `lage` (null, wenn es keinen gibt). */
function sprungNachbarn(a: Abtastung, lage: number): [number | null, number | null] {
  let vorher: number | null = null
  for (const s of a.sprungLagen) {
    if (s > lage) return [vorher, s]
    vorher = s
  }
  return [vorher, null]
}

/** Mischt eine Liste mit festem Zufall (Fisher-Yates). */
function mischen<T>(liste: T[], z: () => number): T[] {
  const aus = liste.slice()
  for (let i = aus.length - 1; i > 0; i--) {
    const j = Math.floor(z() * (i + 1))
    ;[aus[i], aus[j]] = [aus[j], aus[i]]
  }
  return aus
}

/**
 * Zeichnet die Lichter der Logo-Fassung auf eine Leinwand (Canvas), Bild für Bild per requestAnimationFrame.
 * Dritte Fassung (10. September 2026): Die Web-Animations-Ketten (bis zu 328 Glieder mit je hunderten
 * Keyframes) lasteten den Compositor aus (TickAnimations rund 12 ms je Bild) und machten jeden Commit beim
 * Vergrößern teuer (PushProperties über 100 ms); dazu sahen die Glieder "gepunktet" aus. Die Leinwand
 * kostet je Bild unter einer Millisekunde Hauptthread, nichts bei Größenänderung und zeichnet echte,
 * durchgehende Linien exakt auf der Bahn. Ruht, wenn das Fenster verborgen ist.
 */
function lichterZeichnen(canvas: HTMLCanvasElement, lichter: Licht[]): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  let anfrage = 0
  let laeuft = true
  // Drei Durchgänge je Kette: breiter Schein, mittlerer Schein, Kern. Breiten in Pixeln.
  const durchgaenge: Array<[number, number]> = [
    [10, 0.14],
    [5, 0.38],
    [2.4, 1]
  ]
  // Helligkeitsstufen der Kette (Anteil der vollen Deckkraft), aufsteigend; siehe unten.
  const STUFEN = [0.05, 0.11, 0.18, 0.26, 0.35, 0.45, 0.56, 0.68, 0.81, 0.94]
  interface Punkt {
    x: number
    y: number
    a: number
    lage: number
  }
  // Nur die Flecken des letzten Bilds löschen statt der ganzen Leinwand: spart Füllrate auf schwachen Grafikchips.
  let flecken: Array<[number, number, number, number]> = []
  const RAND = 14
  const zeichnen = (zeit: number): void => {
    if (!laeuft) return
    for (const [x, y, b, h] of flecken) ctx.clearRect(x, y, b, h)
    flecken = []
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const l of lichter) {
      if (!l.zyklus || !l.tabelle.laenge) continue
      const tz = (((zeit / 1000 + l.versatz) % l.zyklus) + l.zyklus) % l.zyklus
      const lauf = l.plan.find((r) => tz >= r.start && tz < r.ende)
      if (!lauf) continue
      const teil = l.teile[lauf.teil]
      const kopf = teil.anfang + (tz - lauf.start) * l.tempo
      // Sichtbarkeit: außerhalb des Teilstücks nichts, an seinen Enden ein- und ausblenden, an Sprüngen innerhalb
      // (Lücken zwischen Buchstaben der Wortmarke) kurz aus- und wieder einblenden statt hart abzureißen.
      const sichtbar = (lage: number): number => {
        if (lage < teil.anfang || lage > teil.ende) return 0
        let a = Math.min(1, (lage - teil.anfang) / l.blende, (teil.ende - lage) / l.blende)
        const [vorher, nachher] = sprungNachbarn(l.tabelle, lage)
        const klein = l.blende / 2
        if (vorher !== null) a = Math.min(a, (lage - vorher) / klein)
        if (nachher !== null) a = Math.min(a, (nachher - lage) / klein)
        return Math.max(0, a)
      }
      const punkte: Punkt[] = []
      for (let g = 0; g <= l.glieder; g++) {
        const lage = kopf - g * l.abstand
        const [ux, uy] = bei(l.tabelle, Math.min(teil.ende, Math.max(teil.anfang, lage)))
        const [x, y] = l.abbilden(ux, uy)
        // Komet: vorne hell, nach hinten verglühend.
        const a = sichtbar(lage) * (1 - (g / l.glieder) * 0.92)
        punkte.push({ x, y, a, lage })
      }
      const sichtbare = punkte.filter((p) => p.a > 0.01)
      if (sichtbare.length === 0) continue
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of sichtbare) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
      flecken.push([minX - RAND, minY - RAND, maxX - minX + 2 * RAND, maxY - minY + 2 * RAND])
      // Zusammenhängende Läufe (innerhalb des Teilstücks, ohne Sprung dazwischen) in EINEM Zug zeichnen:
      // einzelne Stücke mit runden Enden überlagerten sich an den Nähten und wirkten "gepunktet".
      // Der Verlauf (vorne hell, hinten dunkel) kommt aus einem Farbverlauf entlang der Kette.
      const laeufe: Punkt[][] = []
      let lauf2: Punkt[] = []
      for (let g = 0; g <= l.glieder; g++) {
        const p = punkte[g]
        const vorher = punkte[g - 1]
        const bruch = g > 0 && (p.lage < teil.anfang || vorher.lage > teil.ende || sprungZwischen(l.tabelle, p.lage, vorher.lage))
        if (bruch || p.a <= 0.005) {
          if (lauf2.length > 1) laeufe.push(lauf2)
          lauf2 = p.a > 0.005 ? [p] : []
          continue
        }
        lauf2.push(p)
      }
      if (lauf2.length > 1) laeufe.push(lauf2)
      // Die Helligkeit folgt der BAHN, nicht der Luftlinie: Je Helligkeitsstufe wird der Teil der Kette, der mindestens
      // so hell ist (vom Kopf aus ein zusammenhängendes Stück, an Blenden auch mehrere), als EIN durchgehender Zug mit
      // runden Ecken und Kappen über die dunkleren Stufen gelegt; die Deckkraft jeder Stufe ist so gewählt, dass sich
      // die gewünschte Gesamthelligkeit ergibt. Vorher lag ein linearer Farbverlauf entlang der Sehne Kopf → Schwanz
      // über der Kette: in jeder Ecke drehte sich die Sehne, und die Grenze, an der das Licht verblasst, rutschte am
      // Schwanz sichtbar zurück (Rückmeldung vom 10. September 2026, "der hintere Teil läuft wieder zurück").
      for (const r of laeufe) {
        for (const [dicke, staerke] of durchgaenge) {
          ctx.lineWidth = dicke
          let bisher = 0
          for (const stufe of STUFEN) {
            const ziel = stufe * staerke
            const deckkraft = 1 - (1 - ziel) / (1 - bisher)
            bisher = ziel
            ctx.strokeStyle = `rgba(254, 83, 3, ${deckkraft.toFixed(3)})`
            ctx.beginPath()
            let offen = false
            let gezeichnet = false
            for (let i = 0; i < r.length; i++) {
              const p = r[i]
              if (p.a >= stufe) {
                if (!offen) {
                  ctx.moveTo(p.x, p.y)
                  offen = true
                } else {
                  ctx.lineTo(p.x, p.y)
                  gezeichnet = true
                }
              } else offen = false
            }
            if (gezeichnet) ctx.stroke()
          }
        }
      }
    }
    anfrage = requestAnimationFrame(zeichnen)
  }
  const sichtbarkeit = (): void => {
    if (document.hidden) {
      cancelAnimationFrame(anfrage)
      laeuft = false
    } else if (!laeuft) {
      laeuft = true
      anfrage = requestAnimationFrame(zeichnen)
    }
  }
  document.addEventListener('visibilitychange', sichtbarkeit)
  anfrage = requestAnimationFrame(zeichnen)
  return () => {
    laeuft = false
    cancelAnimationFrame(anfrage)
    document.removeEventListener('visibilitychange', sichtbarkeit)
  }
}

/** Die Logo-Fassung: Linienmuster hinten, Wortmarke als Wasserzeichen vorn, orangene Lichter auf beidem (Leinwand). */
function HintergrundLogo(): ReactElement {
  // Etwas mehr und etwas größere Punkte als klassisch ("minimal auffälliger, aber nicht viel"), sie funkeln per CSS.
  const partikel = useMemo(() => partikelErzeugen(36, FARBEN_LOGO, 11, 1.5), [])
  const hinten = useRef<HTMLDivElement>(null)
  const leinwand = useRef<HTMLCanvasElement>(null)
  const wortmarkeSvg = useRef<SVGSVGElement>(null)
  const bahnOben = useRef<SVGPathElement>(null)
  const bahnUnten = useRef<SVGPathElement>(null)
  const musterWeg = useRef<SVGPathElement>(null)

  const alleD = useMemo(() => WORTMARKE.pfade.join(' '), [])

  useEffect(() => {
    const h = hinten.current
    const canvas = leinwand.current
    const svg = wortmarkeSvg.current
    const oben = bahnOben.current
    const unten = bahnUnten.current
    const weg = musterWeg.current
    if (!h || !canvas || !svg || !oben || !unten || !weg || bewegungReduziert()) return
    const musterTabelle = abtasten(weg)
    const musterTeile = teileAusSpruengen(musterTabelle)
    const obenTabelle = abtasten(oben)
    const untenTabelle = abtasten(unten)
    // Maßstäbe, die bei Größenänderung nur überschrieben werden; die Bahnen bleiben in Einheiten.
    const mass = { sx: 1, sy: 1, dx: 0, dy: 0, links: 0, oben: 0, m: 1 }
    const musterAbbilden = (x: number, y: number): [number, number] => [mass.dx + x * mass.sx, mass.dy + y * mass.sy]
    const wortAbbilden = (x: number, y: number): [number, number] => [mass.links + x * mass.m, mass.oben + y * mass.m]
    const lichter: Licht[] = []
    // Muster: Die Linien werden fest gemischt und reihum auf die Lichter verteilt, jedes Licht fährt seine Linien
    // nacheinander mit festen Zufallspausen ab. So leuchtet jede Linie regelmäßig, nie zwei Lichter auf derselben,
    // und die Zyklen der Lichter sind verschieden lang, das Muster wirkt nicht getaktet.
    const z = zufall(23)
    const reihenfolge = mischen(musterTeile.map((_, i) => i), z)
    for (let i = 0; i < MUSTER_LICHTER; i++) {
      const eigene = reihenfolge.filter((_, k) => k % MUSTER_LICHTER === i)
      const { plan, zyklus } = planBauen(musterTeile, eigene, MUSTER_TEMPO, MUSTER_GLIEDER * GLIED, () => 0.8 + z() * 1.6)
      lichter.push({ tabelle: musterTabelle, teile: musterTeile, plan, zyklus, tempo: MUSTER_TEMPO, versatz: z() * zyklus, glieder: MUSTER_GLIEDER, abstand: GLIED, blende: 14, abbilden: musterAbbilden })
    }
    // Wortmarke: obere und untere Rand-Bahn, beide von links nach rechts; die Lichter einer Bahn sind gleichmäßig über
    // den Zyklus verteilt (ohne Pause), die untere Bahn um eine halbe Lücke versetzt. An den Buchstabengrenzen (M)
    // blendet das Licht über blende/2 aus und wieder ein (siehe lichterZeichnen).
    const wortLichter = (tabelle: Abtastung, anzahl: number, phase: number): void => {
      const teile = [{ anfang: 0, ende: tabelle.laenge }]
      const { plan, zyklus } = planBauen(teile, [0], WORTMARKE_TEMPO, WORTMARKE_GLIEDER * GLIED, () => 0)
      for (let i = 0; i < anzahl; i++) {
        lichter.push({ tabelle, teile, plan, zyklus, tempo: WORTMARKE_TEMPO, versatz: ((i + phase) * zyklus) / anzahl, glieder: WORTMARKE_GLIEDER, abstand: GLIED, blende: 16, abbilden: wortAbbilden })
      }
    }
    wortLichter(obenTabelle, WORTMARKE_LICHTER_OBEN, 0)
    wortLichter(untenTabelle, WORTMARKE_LICHTER_UNTEN, 0.5)
    const anpassen = (): void => {
      const dpr = window.devicePixelRatio || 1
      const breite = h.clientWidth
      const hoehe = h.clientHeight
      if (!breite || !hoehe) return
      canvas.width = Math.round(breite * dpr)
      canvas.height = Math.round(hoehe * dpr)
      canvas.style.width = `${breite}px`
      canvas.style.height = `${hoehe}px`
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Das Muster behält das Seitenverhältnis des Logos (wie preserveAspectRatio "slice" im SVG): gleichmäßig so
      // skaliert, dass es das Fenster füllt, mittig, Überstand wird abgeschnitten. So bleiben die Winkel wie im Logo.
      const s = Math.max(breite / MUSTER_BREITE, hoehe / MUSTER_HOEHE)
      mass.sx = s
      mass.sy = s
      mass.dx = (breite - MUSTER_BREITE * s) / 2
      mass.dy = (hoehe - MUSTER_HOEHE * s) / 2
      // Die Wortmarke behält ihr Seitenverhältnis: Lage und Maßstab aus dem vorn gezeichneten SVG.
      const kasten = svg.getBoundingClientRect()
      if (kasten.width) {
        mass.m = kasten.width / WORTMARKE.breite
        mass.links = kasten.left
        mass.oben = kasten.top
      }
    }
    anpassen()
    const stopp = lichterZeichnen(canvas, lichter)
    const beobachter = new ResizeObserver(anpassen)
    beobachter.observe(h)
    return () => {
      beobachter.disconnect()
      stopp()
    }
  }, [])

  return (
    <>
      {/* Ebene hinten: Raster, Linienmuster, Lichter auf Linien und Wortmarke (Leinwand), Lichtpunkte */}
      <div aria-hidden="true" className="hintergrund pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: -1 }}>
        <div className="hintergrund-raster absolute inset-0" style={{ backgroundImage: RASTER, opacity: 0.45 }} />
        <div ref={hinten} className="absolute inset-0">
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${MUSTER_BREITE} ${MUSTER_HOEHE}`} preserveAspectRatio="xMidYMid slice">
            {/* Die Linien exakt wie im Logo (spitze Ecken); Linie und Licht nutzen dieselben Koordinaten. */}
            {MUSTER.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="white" strokeOpacity="0.11" strokeWidth="1" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
            {/* Alle Linien als ein Pfad: daran laufen die Lichter entlang (unsichtbar, nur zum Messen). */}
            <path ref={musterWeg} d={MUSTER.join(' ')} fill="none" stroke="none" />
          </svg>
          {/*
            Die Lichter (Muster und Rand der Wortmarke) liegen HINTEN, hinter Ring, Karten und Text, obwohl die
            Wortmarke selbst vorn liegt: Rückmeldung vom 10. September 2026, die Lichter zogen über den grünen
            Ring und über Text.
          */}
          <canvas ref={leinwand} className="absolute top-0 left-0" />
        </div>
        <Lichtpunkte partikel={partikel} hof />
      </div>

      {/* Ebene vorn: nur die Wortmarke als blasses Wasserzeichen über den Karten (die Lichter dazu liegen hinten) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 10 }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            ref={wortmarkeSvg}
            viewBox={`0 0 ${WORTMARKE.breite} ${WORTMARKE.hoehe}`}
            style={{ width: 'min(78vw, 1150px)', height: 'auto', overflow: 'visible' }}
          >
            <path d={alleD} fill="white" fillOpacity="0.04" fillRule="evenodd" stroke="white" strokeOpacity="0.07" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {/* Die zwei Rand-Bahnen (obere und untere Hälfte jedes Buchstabens), unsichtbar, nur zum Messen */}
            <path ref={bahnOben} d={WORTMARKE_BAHN_OBEN} fill="none" stroke="none" />
            <path ref={bahnUnten} d={WORTMARKE_BAHN_UNTEN} fill="none" stroke="none" />
          </svg>
        </div>
      </div>
    </>
  )
}

/** Wählt die Fassung nach der Einstellung; der Schlüssel baut die Ebenen beim Umschalten sauber neu auf. */
export function Hintergrund(): ReactElement {
  const art = useHintergrundArt()
  return art === 'klassisch' ? <HintergrundKlassisch key="klassisch" /> : <HintergrundLogo key="logo" />
}
