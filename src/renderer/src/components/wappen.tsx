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
      <radialGradient id={`${id}-feld`} cx="50%" cy="38%" r="65%">
        <stop offset="0%" stopColor={dunkel(farbe, 0.58)} />
        <stop offset="100%" stopColor={dunkel(farbe, 0.9)} />
      </radialGradient>
      <radialGradient id={`${id}-glanz`} cx="32%" cy="22%" r="60%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.42} />
        <stop offset="60%" stopColor="#FFFFFF" stopOpacity={0} />
      </radialGradient>
      {/* Fase: oben links Licht, unten rechts Schatten */}
      <linearGradient id={`${id}-kante`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.7} />
        <stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.05} />
        <stop offset="100%" stopColor="#000000" stopOpacity={0.6} />
      </linearGradient>
      <linearGradient id={`${id}-flamme`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor={dunkel(farbe, 0.2)} />
        <stop offset="55%" stopColor={farbe} />
        <stop offset="100%" stopColor="#FFE38A" />
      </linearGradient>
      <linearGradient id={`${id}-eis`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="35%" stopColor={hell(farbe, 0.35)} />
        <stop offset="100%" stopColor={dunkel(farbe, 0.45)} />
      </linearGradient>
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

/** Eine Form mit gefastem Metallrand, dunklem Innenfeld, feiner Gravurlinie und Glanzlicht. */
export function Metallform({ id, farbe, form, filter }: { id: string; farbe: string; form: string; filter?: string }): ReactElement {
  return (
    <g filter={filter}>
      <path d={form} fill={`url(#${id}-metall)`} stroke={dunkel(farbe, 0.55)} strokeWidth={1.6} strokeLinejoin="round" />
      <path d={form} fill="none" stroke={`url(#${id}-kante)`} strokeWidth={1.4} strokeLinejoin="round" transform="translate(50 50) scale(0.93) translate(-50 -50)" />
      <path d={form} fill={`url(#${id}-feld)`} stroke={dunkel(farbe, 0.6)} strokeWidth={1} strokeLinejoin="round" transform={INNEN} />
      <path d={form} fill="none" stroke={hell(farbe, 0.1)} strokeOpacity={0.6} strokeWidth={0.7} strokeLinejoin="round" transform="translate(50 50) scale(0.7) translate(-50 -50)" />
      <path d={form} fill={`url(#${id}-glanz)`} />
    </g>
  )
}

/** Ein Schriftband mit eingekerbten Enden, das quer über dem unteren Teil des Wappens liegt. */
export function Band({ id, farbe, text, y = 76 }: { id: string; farbe: string; text: string; y?: number }): ReactElement {
  const h = 13
  return (
    <g>
      {/* Falten, wo das Band hinter dem Wappen hervorkommt */}
      <path d={`M18 ${y + 2} L24 ${y - 3} L24 ${y + 2} Z`} fill={dunkel(farbe, 0.6)} />
      <path d={`M82 ${y + 2} L76 ${y - 3} L76 ${y + 2} Z`} fill={dunkel(farbe, 0.6)} />
      <path
        d={`M6 ${y} H94 L88 ${y + h / 2} L94 ${y + h} H6 L12 ${y + h / 2} Z`}
        fill={`url(#${id}-metall)`}
        stroke={dunkel(farbe, 0.55)}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <path d={`M9 ${y + 1.5} H91`} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={0.8} />
      <text
        x="50"
        y={y + h - 3.4}
        textAnchor="middle"
        fontSize={7.6}
        fontWeight={800}
        letterSpacing="1.2"
        fill={dunkel(farbe, 0.72)}
        fontFamily={SCHRIFT}
      >
        {text.toUpperCase()}
      </text>
    </g>
  )
}

/** Flammen, die hinter einem Wappen aufsteigen. */
export function Flammen({ id, farbe }: { id: string; farbe: string }): ReactElement {
  const zungen = [
    'M22 70 C6 56 12 40 18 30 C16 44 26 44 24 32 C34 42 30 58 26 70 Z',
    'M78 70 C94 56 88 40 82 30 C84 44 74 44 76 32 C66 42 70 58 74 70 Z',
    'M36 40 C28 26 34 14 44 2 C40 16 52 18 50 6 C60 18 56 30 50 40 Z',
    'M64 42 C72 28 66 16 56 4 C60 18 48 20 50 8 C40 20 44 32 50 42 Z',
    'M50 44 C42 30 46 16 50 4 C54 16 58 30 50 44 Z'
  ]
  return (
    <g>
      {zungen.map((d, i) => (
        <path key={i} d={d} fill={`url(#${id}-flamme)`} stroke={dunkel(farbe, 0.35)} strokeWidth={0.6} strokeLinejoin="round" opacity={i === 4 ? 1 : 0.92} />
      ))}
    </g>
  )
}

/**
 * Ein Brillant von der Seite: Tafel oben, Kranzfacetten bis zur Rundiste (breiteste Stelle),
 * darunter der Pavillon, der in der Kalette zusammenläuft. Facetten wechseln hell und dunkel.
 */
export function Brillant({ id, farbe, filter }: { id: string; farbe: string; filter?: string }): ReactElement {
  const TL = '34,22'
  const TM = '50,22'
  const TR = '66,22'
  const GL = '4,48'
  const P1 = '27,48'
  const P3 = '73,48'
  const GR = '96,48'
  const CU = '50,96'
  const umriss = `${TL} ${TR} ${GR} ${CU} ${GL}`
  const facetten: Array<[string, string, number]> = [
    [`${GL} ${TL} ${P1}`, '#FFFFFF', 0.45],
    [`${TL} ${TM} ${P1}`, '#000000', 0.28],
    [`${TM} ${P1} ${P3}`, '#FFFFFF', 0.22],
    [`${TM} ${TR} ${P3}`, '#000000', 0.28],
    [`${TR} ${GR} ${P3}`, '#FFFFFF', 0.45],
    [`${GL} ${P1} ${CU}`, '#000000', 0.42],
    [`${P1} ${P3} ${CU}`, '#FFFFFF', 0.12],
    [`${P3} ${GR} ${CU}`, '#000000', 0.42]
  ]
  return (
    <g filter={filter}>
      <polygon points={umriss} fill={`url(#${id}-eis)`} stroke={dunkel(farbe, 0.5)} strokeWidth={1.2} strokeLinejoin="round" />
      {facetten.map(([punkte, fuellung, deckung], i) => (
        <polygon key={i} points={punkte} fill={fuellung} fillOpacity={deckung} />
      ))}
      {/* Tafel und Rundiste als feine Kanten */}
      <polygon points={`${TL} ${TR} ${P3} ${P1}`} fill="#FFFFFF" fillOpacity={0.28} />
      <path d="M4 48 H96" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={0.9} />
      <path d="M34 22 H66" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={0.9} />
      {/* Lichtreflex auf der Tafel */}
      <polygon points="37,24 54,24 46,30 39,30" fill="#FFFFFF" fillOpacity={0.75} />
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

/** Text in Metall mit Kontur (standardmäßig dunkel), mittig. */
export function Metallschrift({
  text,
  fuellung,
  farbe,
  y,
  groesse,
  kontur
}: {
  text: string
  fuellung: string
  farbe: string
  y: number
  groesse: number
  kontur?: string
}): ReactElement {
  return (
    <text
      x="50"
      y={y}
      textAnchor="middle"
      fontSize={groesse}
      fontWeight={800}
      fill={fuellung}
      stroke={kontur ?? dunkel(farbe, 0.6)}
      strokeWidth={kontur ? 1.4 : 1}
      paintOrder="stroke"
      fontFamily={SCHRIFT}
      letterSpacing="-1"
    >
      {text}
    </text>
  )
}
