import type { ReactElement } from 'react'
import { LIGA_FARBEN, liga, type Liga } from '@shared/liga'
import {
  Definitionen,
  Edelstein,
  Fluegel,
  Funkeln,
  Krone,
  Lorbeer,
  Metallform,
  Metallschrift,
  Nieten,
  SCHILD,
  SECHSECK,
  Strahlen,
  dunkel,
  stern
} from './wappen'

/*
 * Die Liga-Abzeichen, von unten nach oben prächtiger:
 *   Bronze   Schild mit Nieten
 *   Silber   Schild mit Nieten und Flügeln
 *   Gold     Schild mit Lorbeer
 *   Kristall geschliffener Edelstein mit Funkeln
 *   Meister  Schild mit Krone und Lorbeer
 *   Champion Schild mit Krone und Strahlenkranz, leuchtet
 *   Titan    Sechseck-Platte mit großen Flügeln und Blitz, leuchtet
 *   Legende  Stern im Strahlenkranz, leuchtet
 */

const ROEMISCH: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' }

interface Props {
  /** Trophäenstand oder direkt eine Liga */
  trophaeen?: number
  liga?: Liga
  groesse?: number
}

export function LigaAbzeichen({ trophaeen = 0, liga: vorgabe, groesse = 56 }: Props): ReactElement {
  const l = vorgabe ?? liga(trophaeen)
  const stufe = l.stufe
  const farbe = LIGA_FARBEN[stufe]
  const id = `liga-${stufe}`
  const leuchtet = stufe !== 'keine'
  const metall = `url(#${id}-metall)`
  const filter = leuchtet ? `url(#${id}-leuchten)` : undefined
  const ziffer = (y = 63, groesseZiffer = 34): ReactElement => (
    <Metallschrift text={ROEMISCH[l.nummer] ?? ''} fuellung={metall} farbe={farbe} y={y} groesse={l.nummer === 3 ? groesseZiffer * 0.86 : groesseZiffer} />
  )

  let inhalt: ReactElement
  switch (stufe) {
    case 'keine':
      inhalt = (
        <g>
          <path d={SCHILD} fill="#1C1C1F" stroke={farbe} strokeWidth={2} strokeLinejoin="round" />
          <path d="M38 52 H62" stroke={farbe} strokeWidth={4} strokeLinecap="round" />
        </g>
      )
      break
    case 'bronze':
      inhalt = (
        <g>
          <Metallform id={id} farbe={farbe} form={SCHILD} filter={filter} />
          <Nieten farbe={farbe} />
          {ziffer()}
        </g>
      )
      break
    case 'silber':
      inhalt = (
        <g>
          <Fluegel farbe={farbe} gross={false} />
          <Metallform id={id} farbe={farbe} form={SCHILD} filter={filter} />
          <Nieten farbe={farbe} />
          {ziffer()}
        </g>
      )
      break
    case 'gold':
      inhalt = (
        <g>
          <Lorbeer farbe={farbe} />
          <Metallform id={id} farbe={farbe} form={SCHILD} filter={filter} />
          {ziffer()}
        </g>
      )
      break
    case 'kristall':
      inhalt = (
        <g>
          <Edelstein id={id} farbe={farbe} filter={filter} />
          <Metallschrift text={ROEMISCH[l.nummer] ?? ''} fuellung="#EAF7FF" farbe={farbe} y={62} groesse={l.nummer === 3 ? 26 : 30} />
          <Funkeln x={30} y={26} r={6} farbe="#FFFFFF" />
          <Funkeln x={74} y={70} r={4.5} farbe="#FFFFFF" />
        </g>
      )
      break
    case 'meister':
      inhalt = (
        <g>
          <Lorbeer farbe={farbe} />
          <g transform="translate(0 6)">
            <Metallform id={id} farbe={farbe} form={SCHILD} filter={filter} />
          </g>
          <Krone farbe={farbe} metall={metall} />
          {ziffer(72, 30)}
        </g>
      )
      break
    case 'champion':
      inhalt = (
        <g>
          <Strahlen farbe={farbe} anzahl={14} innen={30} aussen={50} />
          <g transform="translate(0 6)">
            <Metallform id={id} farbe={farbe} form={SCHILD} filter={filter} />
          </g>
          <Krone farbe={farbe} metall={metall} />
          {ziffer(72, 30)}
        </g>
      )
      break
    case 'titan':
      inhalt = (
        <g>
          <Fluegel farbe={farbe} gross />
          <Metallform id={id} farbe={farbe} form={SECHSECK} filter={filter} />
          <path
            d="M55 20 L38 54 H49 L44 80 L64 44 H53 Z"
            fill="#FFD166"
            stroke={dunkel('#FFD166', 0.4)}
            strokeWidth={0.8}
            strokeLinejoin="round"
            opacity={0.9}
            transform="translate(50 50) scale(0.78) translate(-50 -56)"
          />
          {ziffer(84, 15)}
        </g>
      )
      break
    default:
      inhalt = (
        <g>
          <Strahlen farbe="#A78BFA" anzahl={20} innen={22} aussen={50} />
          <g filter={filter}>
            <circle cx="50" cy="50" r="30" fill="#2A1D4A" stroke={farbe} strokeWidth={1.5} />
            <polygon points={stern(50, 52, 27)} fill={metall} stroke={dunkel(farbe, 0.5)} strokeWidth={1.2} strokeLinejoin="round" />
            <polygon points={stern(50, 52, 27)} fill={`url(#${id}-glanz)`} />
          </g>
          <Funkeln x={24} y={22} r={5} farbe="#FFFFFF" />
          <Funkeln x={78} y={30} r={3.5} farbe="#FFFFFF" />
        </g>
      )
  }

  return (
    <svg width={groesse} height={groesse} viewBox="0 0 100 100" overflow="visible" role="img" aria-label={l.name}>
      <Definitionen id={id} farbe={farbe} />
      {inhalt}
    </svg>
  )
}
