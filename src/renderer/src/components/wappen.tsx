import type { ReactElement } from 'react'

/*
 * Gemeinsame Bausteine für die Wappen der Ränge und Ligen: Metallverläufe, Schildformen,
 * Lorbeer, Flügel, Krone, Strahlenkranz, Nieten, Funkeln und Metallschrift.
 * Alles im Raster 100 × 100, damit es in jeder Größe scharf bleibt.
 */

export const SCHRIFT = "'Inter Variable', Inter, system-ui, sans-serif"
export const SCHILD = 'M50 5 L85 17 V47 C85 66 69 83 50 95 C31 83 15 66 15 47 V17 Z'
export const SECHSECK = 'M50 4 L90 27 V73 L50 96 L10 73 V27 Z'
export const EDELSTEIN = 'M50 4 L80 18 L94 50 L80 82 L50 96 L20 82 L6 50 L20 18 Z'
export const INNEN = 'translate(50 50) scale(0.78) translate(-50 -50)'

/** Zwei Farben mischen, t = 0 ganz a, t = 1 ganz b. */
export function mischen(a: string, b: string, t: number): string {
  const p = (h: string): [number, number, number] => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16)
  ]
  const [ar, ag, ab] = p(a)
  const [br, bg, bb] = p(b)
  const k = (x: number, y: number): string =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0')
  return `#${k(ar, br)}${k(ag, bg)}${k(ab, bb)}`
}
export const hell = (f: string, t: number): string => mischen(f, '#FFFFFF', t)
export const dunkel = (f: string, t: number): string => mischen(f, '#000000', t)

/** Stern als Punktliste, standardmäßig fünfzackig. */
export function stern(cx: number, cy: number, r: number, zacken = 5, innen = 0.45): string {
  const punkte: string[] = []
  for (let i = 0; i < zacken * 2; i++) {
    const radius = i % 2 === 0 ? r : r * innen
    const winkel = -Math.PI / 2 + (i * Math.PI) / zacken
    punkte.push(`${(cx + radius * Math.cos(winkel)).toFixed(2)},${(cy + radius * Math.sin(winkel)).toFixed(2)}`)
  }
  return punkte.join(' ')
}

/** Verläufe, Glanz und Leuchten; die Kennung hält die Wappen verschiedener Stufen auseinander. */
export function Definitionen({ id, farbe, leuchtet }: { id: string; farbe: string; leuchtet: boolean }): ReactElement {
  return (
    <defs>
      <linearGradient id={`${id}-metall`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={hell(farbe, 0.55)} />
        <stop offset="38%" stopColor={farbe} />
        <stop offset="68%" stopColor={dunkel(farbe, 0.38)} />
        <stop offset="100%" stopColor={hell(farbe, 0.2)} />
      </linearGradient>
      <linearGradient id={`${id}-feld`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={dunkel(farbe, 0.7)} />
        <stop offset="100%" stopColor={dunkel(farbe, 0.88)} />
      </linearGradient>
      <radialGradient id={`${id}-glanz`} cx="32%" cy="22%" r="60%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.42} />
        <stop offset="60%" stopColor="#FFFFFF" stopOpacity={0} />
      </radialGradient>
      {leuchtet && (
        <filter id={`${id}-leuchten`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.5" result="glanz" />
          <feMerge>
            <feMergeNode in="glanz" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      )}
    </defs>
  )
}

/** Eine Form mit Metallrand, dunklem Innenfeld und Glanzlicht. */
export function Metallform({ id, farbe, form, filter }: { id: string; farbe: string; form: string; filter?: string }): ReactElement {
  return (
    <g filter={filter}>
      <path d={form} fill={`url(#${id}-metall)`} stroke={dunkel(farbe, 0.55)} strokeWidth={1.6} strokeLinejoin="round" />
      <path d={form} fill={`url(#${id}-feld)`} stroke={hell(farbe, 0.15)} strokeWidth={0.8} strokeLinejoin="round" transform={INNEN} />
      <path d={form} fill={`url(#${id}-glanz)`} />
    </g>
  )
}

/** Lorbeerzweige links und rechts: ein Stiel als Bogen, daran wechselseitig Blätter. */
export function Lorbeer({ farbe }: { farbe: string }): ReactElement {
  const p0 = [42, 94]
  const p1 = [4, 84]
  const p2 = [12, 28]
  const punkt = (t: number): [number, number] => [
    (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
  ]
  const richtung = (t: number): number => {
    const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
    const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
    return (Math.atan2(dy, dx) * 180) / Math.PI
  }
  const blaetter: ReactElement[] = []
  for (let i = 0; i < 8; i++) {
    const t = 0.1 + i * 0.115
    const [x, y] = punkt(t)
    const drehung = richtung(t) + (i % 2 === 0 ? -42 : 42)
    blaetter.push(
      <ellipse
        key={i}
        cx={x}
        cy={y}
        rx={7}
        ry={2.9}
        fill={i % 2 === 0 ? farbe : hell(farbe, 0.28)}
        stroke={dunkel(farbe, 0.45)}
        strokeWidth={0.6}
        transform={`rotate(${drehung.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`}
      />
    )
  }
  const zweig = (
    <g>
      <path d={`M${p0[0]} ${p0[1]} Q${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`} fill="none" stroke={dunkel(farbe, 0.3)} strokeWidth={1.6} strokeLinecap="round" />
      {blaetter}
    </g>
  )
  return (
    <g>
      {zweig}
      <g transform="translate(50 0) scale(-1 1) translate(-50 0)">{zweig}</g>
    </g>
  )
}

/** Ein Flügelpaar hinter dem Wappen, drei Federn je Seite. */
export function Fluegel({ farbe, gross }: { farbe: string; gross: boolean }): ReactElement {
  const s = gross ? 1.1 : 0.85
  const federn = [
    'M26 34 C12 28 2 16 6 2 C14 12 22 20 32 28 Z',
    'M24 44 C8 40 -2 28 2 14 C10 24 18 32 30 38 Z',
    'M24 54 C8 52 -4 42 -2 30 C6 38 14 44 28 48 Z'
  ]
  return (
    <g>
      {[-1, 1].map((seite) => (
        <g key={seite} transform={`translate(50 46) scale(${seite * s} ${s}) translate(-50 -46)`}>
          {federn.map((d, n) => (
            <path key={n} d={d} fill={n === 1 ? hell(farbe, 0.18) : farbe} stroke={dunkel(farbe, 0.45)} strokeWidth={0.8} strokeLinejoin="round" />
          ))}
        </g>
      ))}
    </g>
  )
}

/** Eine Krone oben auf dem Wappen. */
export function Krone({ farbe, metall }: { farbe: string; metall: string }): ReactElement {
  return (
    <g>
      <path d="M31 30 L36 12 L50 24 L64 12 L69 30 L64 36 H36 Z" fill={metall} stroke={dunkel(farbe, 0.5)} strokeWidth={1} strokeLinejoin="round" />
      <circle cx="36" cy="12" r="2.6" fill={hell(farbe, 0.6)} />
      <circle cx="50" cy="24" r="2.6" fill={hell(farbe, 0.6)} />
      <circle cx="64" cy="12" r="2.6" fill={hell(farbe, 0.6)} />
      <rect x="38" y="30" width="24" height="3.5" fill={dunkel(farbe, 0.3)} />
      <circle cx="50" cy="31.8" r="1.6" fill="#FF4D4D" />
    </g>
  )
}

/** Strahlenkranz hinter dem Wappen. */
export function Strahlen({ farbe, anzahl, innen, aussen }: { farbe: string; anzahl: number; innen: number; aussen: number }): ReactElement {
  const strahlen: ReactElement[] = []
  for (let i = 0; i < anzahl; i++) {
    const a = (i * 2 * Math.PI) / anzahl
    const b = 0.16
    const p = (r: number, w: number): string => `${(50 + r * Math.cos(w)).toFixed(1)},${(50 + r * Math.sin(w)).toFixed(1)}`
    strahlen.push(
      <polygon
        key={i}
        points={`${p(innen, a - b)} ${p(aussen, a)} ${p(innen, a + b)}`}
        fill={i % 2 === 0 ? farbe : hell(farbe, 0.3)}
        fillOpacity={i % 2 === 0 ? 0.55 : 0.35}
      />
    )
  }
  return <g>{strahlen}</g>
}

/** Nieten am Schildrand. */
export function Nieten({ farbe }: { farbe: string }): ReactElement {
  const punkte: [number, number][] = [
    [50, 10],
    [28, 18],
    [72, 18],
    [20, 40],
    [80, 40],
    [26, 66],
    [74, 66]
  ]
  return (
    <g>
      {punkte.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.1} fill={hell(farbe, 0.5)} stroke={dunkel(farbe, 0.5)} strokeWidth={0.6} />
      ))}
    </g>
  )
}

/** Vierzackiges Funkeln. */
export function Funkeln({ x, y, r, farbe }: { x: number; y: number; r: number; farbe: string }): ReactElement {
  return <polygon points={stern(x, y, r, 4, 0.3)} fill={farbe} />
}

/** Geschliffener Edelstein: Metallrand, Facetten von der Mitte zu den Ecken, dunkler Kern. */
export function Edelstein({ id, farbe, filter }: { id: string; farbe: string; filter?: string }): ReactElement {
  const ecken: [number, number][] = [
    [50, 4],
    [80, 18],
    [94, 50],
    [80, 82],
    [50, 96],
    [20, 82],
    [6, 50],
    [20, 18]
  ]
  return (
    <g filter={filter}>
      <path d={EDELSTEIN} fill={`url(#${id}-metall)`} stroke={dunkel(farbe, 0.5)} strokeWidth={1.4} strokeLinejoin="round" />
      {ecken.map(([x1, y1], i) => {
        const [x2, y2] = ecken[(i + 1) % ecken.length]
        return (
          <polygon
            key={i}
            points={`50,50 ${x1},${y1} ${x2},${y2}`}
            fill={i % 2 === 0 ? '#FFFFFF' : '#000000'}
            fillOpacity={i % 2 === 0 ? (i === 0 || i === 6 ? 0.34 : 0.12) : 0.22}
          />
        )
      })}
      <path d={EDELSTEIN} fill={`url(#${id}-feld)`} fillOpacity={0.55} transform="translate(50 50) scale(0.55) translate(-50 -50)" />
    </g>
  )
}

/** Text in Metall mit dunkler Kontur, mittig. */
export function Metallschrift({ text, fuellung, farbe, y, groesse }: { text: string; fuellung: string; farbe: string; y: number; groesse: number }): ReactElement {
  return (
    <text
      x="50"
      y={y}
      textAnchor="middle"
      fontSize={groesse}
      fontWeight={800}
      fill={fuellung}
      stroke={dunkel(farbe, 0.6)}
      strokeWidth={1}
      paintOrder="stroke"
      fontFamily={SCHRIFT}
      letterSpacing="-1"
    >
      {text}
    </text>
  )
}
