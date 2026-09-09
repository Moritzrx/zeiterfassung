import type { ReactElement } from 'react'

/*
 * Gemeinsame Bausteine für die Wappen der Ränge und Ligen im Spiel-Stil:
 * satte Farbverläufe, dicke dunkle Konturen, Glanz oben, Sockel unten, Leuchten.
 * Alles im Raster 100 × 100, damit es in jeder Größe scharf bleibt.
 */

export const SCHRIFT = "'Inter Variable', Inter, system-ui, sans-serif"
export const SCHILD = 'M50 5 L85 17 V47 C85 66 69 83 50 95 C31 83 15 66 15 47 V17 Z'
export const SECHSECK = 'M50 4 L90 27 V73 L50 96 L10 73 V27 Z'
export const EDELSTEIN = 'M50 4 L80 18 L94 50 L80 82 L50 96 L20 82 L6 50 L20 18 Z'
export const INNEN = 'translate(50 50) scale(0.8) translate(-50 -50)'

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
export function Definitionen({ id, farbe }: { id: string; farbe: string; leuchtet?: boolean }): ReactElement {
  return (
    <defs>
      <linearGradient id={`${id}-metall`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={hell(farbe, 0.6)} />
        <stop offset="42%" stopColor={farbe} />
        <stop offset="100%" stopColor={dunkel(farbe, 0.5)} />
      </linearGradient>
      <radialGradient id={`${id}-feld`} cx="50%" cy="32%" r="72%">
        <stop offset="0%" stopColor={mischen(farbe, '#000000', 0.12)} />
        <stop offset="100%" stopColor={dunkel(farbe, 0.62)} />
      </radialGradient>
      <linearGradient id={`${id}-glanz`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.55} />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
      </linearGradient>
      <linearGradient id={`${id}-kante`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.6} />
        <stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.05} />
        <stop offset="100%" stopColor="#000000" stopOpacity={0.5} />
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
      <filter id={`${id}-leuchten`} x="-45%" y="-45%" width="190%" height="190%">
        <feGaussianBlur stdDeviation="4" result="glanz" />
        <feMerge>
          <feMergeNode in="glanz" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )
}

/** Eine Form im Spiel-Stil: Sockel, satter Metallrand mit dicker Kontur, farbiges Feld, Glanz oben, Lichtkante. */
export function Metallform({ id, farbe, form, filter }: { id: string; farbe: string; form: string; filter?: string }): ReactElement {
  return (
    <g filter={filter}>
      <path d={form} fill={dunkel(farbe, 0.72)} transform="translate(0 3.5)" />
      <path d={form} fill={`url(#${id}-metall)`} stroke={dunkel(farbe, 0.78)} strokeWidth={3.2} strokeLinejoin="round" />
      <path d={form} fill={`url(#${id}-feld)`} stroke={dunkel(farbe, 0.6)} strokeWidth={1.2} strokeLinejoin="round" transform={INNEN} />
      <path d={form} fill={`url(#${id}-glanz)`} transform="translate(50 13) scale(0.7 0.4) translate(-50 -5)" />
      <path d={form} fill="none" stroke={`url(#${id}-kante)`} strokeWidth={1.3} strokeLinejoin="round" transform="translate(50 50) scale(0.92) translate(-50 -50)" />
    </g>
  )
}

/** Ein Schriftband mit eingekerbten Enden, das quer über dem unteren Teil des Wappens liegt. */
export function Band({ id, farbe, text, y = 76 }: { id: string; farbe: string; text: string; y?: number }): ReactElement {
  const h = 15
  return (
    <g>
      <path d={`M18 ${y + 3} L24 ${y - 3} L24 ${y + 3} Z`} fill={dunkel(farbe, 0.7)} />
      <path d={`M82 ${y + 3} L76 ${y - 3} L76 ${y + 3} Z`} fill={dunkel(farbe, 0.7)} />
      <path d={`M4 ${y + 2} H96 L90 ${y + 2 + h / 2} L96 ${y + 2 + h} H4 L10 ${y + 2 + h / 2} Z`} fill={dunkel(farbe, 0.72)} />
      <path
        d={`M4 ${y} H96 L90 ${y + h / 2} L96 ${y + h} H4 L10 ${y + h / 2} Z`}
        fill={`url(#${id}-metall)`}
        stroke={dunkel(farbe, 0.75)}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path d={`M8 ${y + 2} H92`} stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={1} />
      <text
        x="50"
        y={y + h - 3.6}
        textAnchor="middle"
        fontSize={8.4}
        fontWeight={900}
        letterSpacing="1.4"
        fill="#FFFFFF"
        stroke={dunkel(farbe, 0.75)}
        strokeWidth={1.6}
        paintOrder="stroke"
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
        <path key={i} d={d} fill={`url(#${id}-flamme)`} stroke={dunkel(farbe, 0.55)} strokeWidth={1.2} strokeLinejoin="round" opacity={i === 4 ? 1 : 0.92} />
      ))}
    </g>
  )
}

/** Lorbeerzweige links und rechts: ein Stiel als Bogen, daran wechselseitig Blätter mit Kontur. */
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
        rx={7.5}
        ry={3.2}
        fill={i % 2 === 0 ? farbe : hell(farbe, 0.3)}
        stroke={dunkel(farbe, 0.65)}
        strokeWidth={1.2}
        transform={`rotate(${drehung.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`}
      />
    )
  }
  const zweig = (
    <g>
      <path d={`M${p0[0]} ${p0[1]} Q${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`} fill="none" stroke={dunkel(farbe, 0.5)} strokeWidth={2.2} strokeLinecap="round" />
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

/** Ein Flügelpaar hinter dem Wappen, drei Federn je Seite mit kräftiger Kontur. */
export function Fluegel({ farbe, gross }: { farbe: string; gross: boolean }): ReactElement {
  const s = gross ? 1.12 : 0.88
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
            <path key={n} d={d} fill={n === 1 ? hell(farbe, 0.22) : farbe} stroke={dunkel(farbe, 0.65)} strokeWidth={1.6} strokeLinejoin="round" />
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
      <path d="M31 30 L36 12 L50 24 L64 12 L69 30 L64 36 H36 Z" fill={metall} stroke={dunkel(farbe, 0.72)} strokeWidth={1.8} strokeLinejoin="round" />
      <circle cx="36" cy="12" r="3" fill={hell(farbe, 0.65)} stroke={dunkel(farbe, 0.6)} strokeWidth={0.8} />
      <circle cx="50" cy="24" r="3" fill={hell(farbe, 0.65)} stroke={dunkel(farbe, 0.6)} strokeWidth={0.8} />
      <circle cx="64" cy="12" r="3" fill={hell(farbe, 0.65)} stroke={dunkel(farbe, 0.6)} strokeWidth={0.8} />
      <rect x="38" y="30" width="24" height="3.5" fill={dunkel(farbe, 0.35)} />
      <circle cx="50" cy="31.8" r="2" fill="#FF4D4D" stroke="#7A1010" strokeWidth={0.6} />
    </g>
  )
}

/** Strahlenkranz hinter dem Wappen. */
export function Strahlen({ farbe, anzahl, innen, aussen }: { farbe: string; anzahl: number; innen: number; aussen: number }): ReactElement {
  const strahlen: ReactElement[] = []
  for (let i = 0; i < anzahl; i++) {
    const a = (i * 2 * Math.PI) / anzahl
    const b = 0.18
    const p = (r: number, w: number): string => `${(50 + r * Math.cos(w)).toFixed(1)},${(50 + r * Math.sin(w)).toFixed(1)}`
    strahlen.push(
      <polygon
        key={i}
        points={`${p(innen, a - b)} ${p(aussen, a)} ${p(innen, a + b)}`}
        fill={i % 2 === 0 ? farbe : hell(farbe, 0.35)}
        fillOpacity={i % 2 === 0 ? 0.75 : 0.5}
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
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.5} fill={hell(farbe, 0.55)} stroke={dunkel(farbe, 0.7)} strokeWidth={1} />
      ))}
    </g>
  )
}

/** Vierzackiges Funkeln. */
export function Funkeln({ x, y, r, farbe }: { x: number; y: number; r: number; farbe: string }): ReactElement {
  return <polygon points={stern(x, y, r, 4, 0.3)} fill={farbe} />
}

/** Geschliffener Edelstein: Rand, Facetten von der Mitte zu den Ecken, dunkler Kern. */
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
      <path d={EDELSTEIN} fill={dunkel(farbe, 0.7)} transform="translate(0 3.5)" />
      <path d={EDELSTEIN} fill={`url(#${id}-metall)`} stroke={dunkel(farbe, 0.72)} strokeWidth={2.8} strokeLinejoin="round" />
      {ecken.map(([x1, y1], i) => {
        const [x2, y2] = ecken[(i + 1) % ecken.length]
        return (
          <polygon
            key={i}
            points={`50,50 ${x1},${y1} ${x2},${y2}`}
            fill={i % 2 === 0 ? '#FFFFFF' : '#000000'}
            fillOpacity={i % 2 === 0 ? (i === 0 || i === 6 ? 0.36 : 0.14) : 0.22}
          />
        )
      })}
      <path d={EDELSTEIN} fill={`url(#${id}-feld)`} fillOpacity={0.6} transform="translate(50 50) scale(0.55) translate(-50 -50)" />
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
    [`${GL} ${TL} ${P1}`, '#FFFFFF', 0.5],
    [`${TL} ${TM} ${P1}`, '#000000', 0.3],
    [`${TM} ${P1} ${P3}`, '#FFFFFF', 0.24],
    [`${TM} ${TR} ${P3}`, '#000000', 0.3],
    [`${TR} ${GR} ${P3}`, '#FFFFFF', 0.5],
    [`${GL} ${P1} ${CU}`, '#000000', 0.45],
    [`${P1} ${P3} ${CU}`, '#FFFFFF', 0.14],
    [`${P3} ${GR} ${CU}`, '#000000', 0.45]
  ]
  return (
    <g filter={filter}>
      <polygon points={umriss} fill={dunkel(farbe, 0.7)} transform="translate(0 3.5)" />
      <polygon points={umriss} fill={`url(#${id}-eis)`} stroke={dunkel(farbe, 0.7)} strokeWidth={2.8} strokeLinejoin="round" />
      {facetten.map(([punkte, fuellung, deckung], i) => (
        <polygon key={i} points={punkte} fill={fuellung} fillOpacity={deckung} />
      ))}
      <polygon points={`${TL} ${TR} ${P3} ${P1}`} fill="#FFFFFF" fillOpacity={0.3} />
      <path d="M4 48 H96" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={1} />
      <path d="M34 22 H66" stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1} />
      <polygon points="37,24 54,24 46,30 39,30" fill="#FFFFFF" fillOpacity={0.8} />
    </g>
  )
}

/** Text im Spiel-Stil: fett, mit dicker Kontur und Schattenkante. */
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
  const rand = kontur ?? dunkel(farbe, 0.78)
  return (
    <g>
      <text x="50" y={y + 2} textAnchor="middle" fontSize={groesse} fontWeight={900} fill={rand} stroke={rand} strokeWidth={2.6} paintOrder="stroke" fontFamily={SCHRIFT} letterSpacing="-1">
        {text}
      </text>
      <text x="50" y={y} textAnchor="middle" fontSize={groesse} fontWeight={900} fill={fuellung} stroke={rand} strokeWidth={2.4} paintOrder="stroke" fontFamily={SCHRIFT} letterSpacing="-1">
        {text}
      </text>
    </g>
  )
}
