import type { ReactElement, ReactNode } from 'react'
import { RANG_ZIEL, STUFEN_FARBEN, rang, rangFortschritt, rangStufe } from '@shared/rang'

interface Props {
  produktivSekunden: number
  /** Anzahl der Abschnitte, ein Abschnitt je Rang bis zum Wochenziel (Standard 10) */
  zielRang: number
  groesse?: number
  children?: ReactNode
}

const LEER = '#1C1C1F'

function polar(cx: number, cy: number, r: number, grad: number): [number, number] {
  const rad = (grad * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function bogen(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0)
  const [x1, y1] = polar(cx, cy, r, a1)
  const gross = a1 - a0 > 180 ? 1 : 0
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${gross} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

/**
 * Der Rang-Ring: ein Abschnitt je Rang bis zum Wochenziel. Volle Abschnitte sind
 * geschaffte Ränge, der aktuelle füllt sich. Ab dem Ziel bleibt der Ring voll und
 * wechselt in den Diamant-Rängen die Farbe.
 */
export function RangRing({ produktivSekunden, zielRang, groesse = 260, children }: Props): ReactElement {
  const abschnitte = Math.max(1, Math.min(RANG_ZIEL, zielRang))
  const aktuell = rang(produktivSekunden)
  const fortschritt = rangFortschritt(produktivSekunden)
  const farbe = aktuell > RANG_ZIEL ? STUFEN_FARBEN[rangStufe(aktuell)] : STUFEN_FARBEN.champion
  const mitte = groesse / 2
  const radius = mitte - 9
  const winkel = 360 / abschnitte
  const spalt = abschnitte > 1 ? 3 : 0

  const teile: ReactElement[] = []
  for (let i = 0; i < abschnitte; i++) {
    const a0 = -90 + i * winkel + spalt / 2
    const a1 = -90 + (i + 1) * winkel - spalt / 2
    teile.push(<path key={`h${i}`} d={bogen(mitte, mitte, radius, a0, a1)} stroke={LEER} />)
    let anteil = i < aktuell ? 1 : i === aktuell ? fortschritt : 0
    if (aktuell >= abschnitte) anteil = 1
    if (anteil > 0.01) {
      teile.push(
        <path
          key={`v${i}`}
          d={bogen(mitte, mitte, radius, a0, a0 + (a1 - a0) * anteil)}
          stroke={farbe}
          style={{ filter: `drop-shadow(0 0 8px ${farbe}70)` }}
        />
      )
    }
  }

  return (
    <div className="relative" style={{ width: groesse, height: groesse }}>
      <svg width={groesse} height={groesse} fill="none" strokeWidth={12} strokeLinecap="butt">
        {teile}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
