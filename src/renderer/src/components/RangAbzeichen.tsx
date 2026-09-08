import type { ReactElement } from 'react'
import { STUFEN_FARBEN, rangName, rangStufe, type RangStufe } from '@shared/rang'

const FUELLUNG: Record<RangStufe, string> = {
  keine: '#1C1C1F',
  bronze: '#2E1F14',
  silber: '#262932',
  gold: '#332A10',
  champion: '#3A1808',
  diamant: '#0F2A38'
}

/** Fünfzackiger Stern als Punktliste. */
function stern(cx: number, cy: number, r: number): string {
  const punkte: string[] = []
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45
    const winkel = -Math.PI / 2 + (i * Math.PI) / 5
    punkte.push(`${(cx + radius * Math.cos(winkel)).toFixed(2)},${(cy + radius * Math.sin(winkel)).toFixed(2)}`)
  }
  return punkte.join(' ')
}

interface Props {
  rang: number
  groesse?: number
}

/**
 * Das Abzeichen eines Rangs: ein Schild in der Farbe der Stufe (Bronze, Silber, Gold,
 * Orange für den Champion, Diamant darüber). Sterne zeigen die Stufe innerhalb der
 * Farbe, der Champion bekommt eine Krone, die Diamant-Ränge einen Diamanten je Rang.
 */
export function RangAbzeichen({ rang, groesse = 56 }: Props): ReactElement {
  const stufe = rangStufe(rang)
  const farbe = STUFEN_FARBEN[stufe]
  const fuellung = FUELLUNG[stufe]
  const leuchtet = stufe === 'champion' || stufe === 'diamant'
  const filterId = `rang-glanz-${stufe}`
  const sterne = stufe === 'bronze' || stufe === 'silber' || stufe === 'gold' ? ((rang - 1) % 3) + 1 : 0
  const diamanten = stufe === 'diamant' ? rang - 10 : 0

  return (
    <svg width={groesse} height={groesse} viewBox="0 0 64 64" role="img" aria-label={`Rang ${rang}, ${rangName(rang)}`}>
      {leuchtet && (
        <defs>
          <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="glanz" />
            <feMerge>
              <feMergeNode in="glanz" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      <path
        d="M32 4 L54 12 V30 C54 44 44 54 32 60 C20 54 10 44 10 30 V12 Z"
        fill={fuellung}
        stroke={farbe}
        strokeWidth={2.5}
        strokeLinejoin="round"
        filter={leuchtet ? `url(#${filterId})` : undefined}
      />
      {stufe === 'champion' && <path d="M21 17 L27 23 L32 13 L37 23 L43 17 L41 27 H23 Z" fill={farbe} />}
      {stufe === 'diamant' && (
        <path d="M32 4 L54 12 V30 C54 44 44 54 32 60 C20 54 10 44 10 30 V12 Z" fill="none" stroke={farbe} strokeWidth={1} strokeOpacity={0.5} transform="translate(32 32) scale(0.82) translate(-32 -32)" />
      )}
      <text
        x="32"
        y={stufe === 'champion' ? 46 : 41}
        textAnchor="middle"
        fontSize={rang >= 10 ? 19 : 22}
        fontWeight={600}
        fill={farbe}
        fontFamily="'Inter Variable', Inter, system-ui, sans-serif"
      >
        {rang}
      </text>
      {Array.from({ length: sterne }, (_, i) => (
        <polygon key={i} points={stern(32 + (i - (sterne - 1) / 2) * 9, 50, 3.4)} fill={farbe} />
      ))}
      {Array.from({ length: diamanten }, (_, i) => {
        const x = 32 + (i - (diamanten - 1) / 2) * 7.5
        return <polygon key={i} points={`${x},47 ${x + 3},51 ${x},55 ${x - 3},51`} fill={farbe} />
      })}
    </svg>
  )
}
