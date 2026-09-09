import type { ReactElement } from 'react'
import { STUFEN_FARBEN, rangName, rangStufe } from '@shared/rang'
import {
  Band,
  Brillant,
  Definitionen,
  Flammen,
  Fluegel,
  Funkeln,
  Krone,
  Lorbeer,
  Metallform,
  Metallschrift,
  Nieten,
  SCHILD,
  Strahlen,
  dunkel,
  hell,
  stern
} from './wappen'

/*
 * Das Abzeichen eines Wochenrangs, ein Wappen wie aus einem Spiel:
 *   Bronze 1–3    genietetes Bronzeschild, Sterne, Namensband
 *   Silber 4–6    Silberschild mit Flügeln, Stern oben, Sterne, Namensband
 *   Gold 7–9      Goldschild im Lorbeer mit Rubin oben, Sterne, Namensband
 *   Champion 10   Schild mit Krone in Flammen und Strahlenkranz, leuchtet
 *   Diamant 11–15 Brillant im Strahlenkranz mit Flügeln, ein bis fünf kleine Diamanten, leuchtet
 * Rang 0 ist ein schlichtes graues Schild.
 */

interface Props {
  rang: number
  groesse?: number
}

/** Ein bis drei Sterne in einer Reihe. */
function Sterne({ anzahl, farbe, y }: { anzahl: number; farbe: string; y: number }): ReactElement {
  return (
    <g>
      {Array.from({ length: anzahl }, (_, i) => (
        <polygon key={i} points={stern(50 + (i - (anzahl - 1) / 2) * 11, y, 4.6)} fill={hell(farbe, 0.4)} stroke={dunkel(farbe, 0.45)} strokeWidth={0.5} />
      ))}
    </g>
  )
}

/** Ein bis fünf kleine Brillanten in einer Reihe, mit Lichtkante. */
function Diamanten({ anzahl, farbe, y }: { anzahl: number; farbe: string; y: number }): ReactElement {
  return (
    <g>
      {Array.from({ length: anzahl }, (_, i) => {
        const x = 50 + (i - (anzahl - 1) / 2) * 10
        return (
          <g key={i}>
            <polygon points={`${x - 3.6},${y - 2} ${x + 3.6},${y - 2} ${x},${y + 5}`} fill={dunkel(farbe, 0.15)} stroke={dunkel(farbe, 0.5)} strokeWidth={0.5} />
            <polygon points={`${x - 3.6},${y - 2} ${x + 3.6},${y - 2} ${x + 2.2},${y - 5} ${x - 2.2},${y - 5}`} fill="#FFFFFF" fillOpacity={0.85} />
            <polygon points={`${x - 3.6},${y - 2} ${x},${y + 5} ${x - 1},${y - 2}`} fill="#FFFFFF" fillOpacity={0.35} />
          </g>
        )
      })}
    </g>
  )
}

/** Ein kleiner geschliffener Stein oben in der Schildspitze. */
function Stein({ farbe, stein }: { farbe: string; stein: string }): ReactElement {
  return (
    <g>
      <polygon points="50,9 56,15 50,21 44,15" fill={stein} stroke={dunkel(farbe, 0.5)} strokeWidth={0.6} />
      <polygon points="50,9 56,15 50,15" fill="#FFFFFF" fillOpacity={0.5} />
    </g>
  )
}

export function RangAbzeichen({ rang, groesse = 56 }: Props): ReactElement {
  const stufe = rangStufe(rang)
  const farbe = STUFEN_FARBEN[stufe]
  const id = `rang-${stufe}`
  const leuchtet = stufe === 'champion' || stufe === 'diamant'
  const metall = `url(#${id}-metall)`
  const filter = leuchtet ? `url(#${id}-leuchten)` : undefined
  const sterne = stufe === 'bronze' || stufe === 'silber' || stufe === 'gold' ? ((rang - 1) % 3) + 1 : 0
  const diamanten = stufe === 'diamant' ? rang - 10 : 0
  const name = rangName(rang)
  const zahl = (y: number, groesseZahl: number, fuellung = metall, kontur?: string): ReactElement => (
    <Metallschrift text={String(rang)} fuellung={fuellung} farbe={farbe} y={y} groesse={rang >= 10 ? groesseZahl * 0.88 : groesseZahl} kontur={kontur} />
  )

  let inhalt: ReactElement
  switch (stufe) {
    case 'keine':
      inhalt = (
        <g>
          <path d={SCHILD} fill="#1C1C1F" stroke={farbe} strokeWidth={2} strokeLinejoin="round" />
          {zahl(62, 34, farbe)}
        </g>
      )
      break
    case 'bronze':
      inhalt = (
        <g>
          <Metallform id={id} farbe={farbe} form={SCHILD} />
          <Nieten farbe={farbe} />
          {zahl(54, 34)}
          <Sterne anzahl={sterne} farbe={farbe} y={65} />
          <Band id={id} farbe={farbe} text={name} />
        </g>
      )
      break
    case 'silber':
      inhalt = (
        <g>
          <Fluegel farbe={farbe} gross={false} />
          <Metallform id={id} farbe={farbe} form={SCHILD} />
          <Nieten farbe={farbe} />
          <Stein farbe={farbe} stein={hell(farbe, 0.5)} />
          {zahl(56, 32)}
          <Sterne anzahl={sterne} farbe={farbe} y={66} />
          <Band id={id} farbe={farbe} text={name} />
        </g>
      )
      break
    case 'gold':
      inhalt = (
        <g>
          <Lorbeer farbe={farbe} />
          <Metallform id={id} farbe={farbe} form={SCHILD} />
          <Stein farbe={farbe} stein="#FF4D4D" />
          {zahl(56, 32)}
          <Sterne anzahl={sterne} farbe={farbe} y={66} />
          <Band id={id} farbe={farbe} text={name} />
        </g>
      )
      break
    case 'champion':
      inhalt = (
        <g>
          <Strahlen farbe={farbe} anzahl={16} innen={32} aussen={54} />
          <Flammen id={id} farbe={farbe} />
          <g transform="translate(0 8)">
            <Metallform id={id} farbe={farbe} form={SCHILD} filter={filter} />
          </g>
          <Krone farbe={farbe} metall={metall} />
          {zahl(70, 28)}
          <Band id={id} farbe={farbe} text={name} y={80} />
        </g>
      )
      break
    default:
      inhalt = (
        <g>
          <Strahlen farbe={farbe} anzahl={18} innen={30} aussen={54} />
          <Fluegel farbe={hell(farbe, 0.45)} gross />
          <Brillant id={id} farbe={farbe} filter={filter} />
          {zahl(44, 26, '#0A2E4A', '#FFFFFF')}
          <Diamanten anzahl={diamanten} farbe={farbe} y={62} />
          <Funkeln x={20} y={30} r={7} farbe="#FFFFFF" />
          <Funkeln x={84} y={38} r={5} farbe="#FFFFFF" />
          <Funkeln x={62} y={82} r={3.5} farbe="#FFFFFF" />
          <Band id={id} farbe={farbe} text={name} y={82} />
        </g>
      )
  }

  return (
    <svg width={groesse} height={groesse} viewBox="0 0 100 100" overflow="visible" role="img" aria-label={`Rang ${rang}, ${rangName(rang)}`}>
      <Definitionen id={id} farbe={farbe} leuchtet={leuchtet} />
      {inhalt}
    </svg>
  )
}
