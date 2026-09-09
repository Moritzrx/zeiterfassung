import type { ReactElement } from 'react'
import { LIGA_FARBEN, liga, type Liga, type LigaStufe } from '@shared/liga'

const FUELLUNG: Record<LigaStufe, string> = {
  keine: '#1C1C1F',
  bronze: '#2E1F14',
  silber: '#262932',
  gold: '#332A10',
  kristall: '#0F2A38',
  meister: '#241C3A',
  champion: '#3A1808',
  titan: '#23262E',
  legende: '#3A2A0C'
}

const ROEMISCH: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' }

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
  /** Trophäenstand oder direkt eine Liga */
  trophaeen?: number
  liga?: Liga
  groesse?: number
}

/**
 * Das Abzeichen einer Liga: ein Sechseck in der Farbe der Stufe mit der römischen
 * Ziffer der Unterstufe. Ab der Champion-Liga leuchtet es, die Legenden-Liga trägt einen Stern.
 */
export function LigaAbzeichen({ trophaeen = 0, liga: vorgabe, groesse = 56 }: Props): ReactElement {
  const l = vorgabe ?? liga(trophaeen)
  const farbe = LIGA_FARBEN[l.stufe]
  const fuellung = FUELLUNG[l.stufe]
  const leuchtet = l.stufe === 'champion' || l.stufe === 'titan' || l.stufe === 'legende'
  const filterId = `liga-glanz-${l.stufe}`
  const sechseck = 'M32 3 L57 17.5 V46.5 L32 61 L7 46.5 V17.5 Z'

  return (
    <svg width={groesse} height={groesse} viewBox="0 0 64 64" overflow="visible" role="img" aria-label={l.name}>
      {leuchtet && (
        <defs>
          <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.4" result="glanz" />
            <feMerge>
              <feMergeNode in="glanz" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      <path d={sechseck} fill={fuellung} stroke={farbe} strokeWidth={2.5} strokeLinejoin="round" filter={leuchtet ? `url(#${filterId})` : undefined} />
      {l.stufe !== 'keine' && (
        <path d={sechseck} fill="none" stroke={farbe} strokeWidth={1} strokeOpacity={0.45} transform="translate(32 32) scale(0.8) translate(-32 -32)" />
      )}
      {l.stufe === 'legende' ? (
        <polygon points={stern(32, 33, 13)} fill={farbe} />
      ) : l.stufe === 'keine' ? (
        <path d="M24 32 H40" stroke={farbe} strokeWidth={3} strokeLinecap="round" />
      ) : (
        <text
          x="32"
          y="40"
          textAnchor="middle"
          fontSize={l.nummer === 3 ? 18 : 21}
          fontWeight={700}
          fill={farbe}
          fontFamily="'Inter Variable', Inter, system-ui, sans-serif"
        >
          {ROEMISCH[l.nummer]}
        </text>
      )}
    </svg>
  )
}
