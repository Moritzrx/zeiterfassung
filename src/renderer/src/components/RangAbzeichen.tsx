import type { ReactElement } from 'react'
import { STUFEN_FARBEN, rangName, rangStufe } from '@shared/rang'
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
  Strahlen,
  dunkel,
  hell,
  stern
} from './wappen'

/*
 * Das Abzeichen eines Wochenrangs, in derselben Machart wie die Liga-Wappen:
 *   Bronze 1–3    Schild mit Nieten, ein bis drei Sterne
 *   Silber 4–6    Schild mit Flügeln, ein bis drei Sterne
 *   Gold 7–9      Schild im Lorbeer, ein bis drei Sterne
 *   Champion 10   oranges Schild mit Krone im Strahlenkranz, leuchtet
 *   Diamant 11–15 geschliffener Diamant mit ein bis fünf kleinen Diamanten, leuchtet
 * Rang 0 ist ein schlichtes graues Schild.
 */

interface Props {
  rang: number
  groesse?: number
}

/** Ein bis drei Sterne unten im Schildfeld. */
function Sterne({ anzahl, farbe, y }: { anzahl: number; farbe: string; y: number }): ReactElement {
  return (
    <g>
      {Array.from({ length: anzahl }, (_, i) => (
        <polygon key={i} points={stern(50 + (i - (anzahl - 1) / 2) * 11, y, 4.6)} fill={hell(farbe, 0.35)} stroke={dunkel(farbe, 0.45)} strokeWidth={0.5} />
      ))}
    </g>
  )
}

/** Ein bis fünf kleine Diamanten in einer Reihe. */
function Diamanten({ anzahl, farbe, y }: { anzahl: number; farbe: string; y: number }): ReactElement {
  return (
    <g>
      {Array.from({ length: anzahl }, (_, i) => {
        const x = 50 + (i - (anzahl - 1) / 2) * 9.5
        return (
          <g key={i}>
            <polygon points={`${x},${y - 5} ${x + 4},${y} ${x},${y + 5} ${x - 4},${y}`} fill={hell(farbe, 0.6)} stroke={dunkel(farbe, 0.4)} strokeWidth={0.5} />
            <polygon points={`${x},${y - 5} ${x + 4},${y} ${x - 4},${y}`} fill="#FFFFFF" fillOpacity={0.45} />
          </g>
        )
      })}
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
  const zahl = (y: number, groesseZahl: number, fuellung = metall): ReactElement => (
    <Metallschrift text={String(rang)} fuellung={fuellung} farbe={farbe} y={y} groesse={rang >= 10 ? groesseZahl * 0.88 : groesseZahl} />
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
          {zahl(58, 36)}
          <Sterne anzahl={sterne} farbe={farbe} y={74} />
        </g>
      )
      break
    case 'silber':
      inhalt = (
        <g>
          <Fluegel farbe={farbe} gross={false} />
          <Metallform id={id} farbe={farbe} form={SCHILD} />
          <Nieten farbe={farbe} />
          {zahl(58, 36)}
          <Sterne anzahl={sterne} farbe={farbe} y={74} />
        </g>
      )
      break
    case 'gold':
      inhalt = (
        <g>
          <Lorbeer farbe={farbe} />
          <Metallform id={id} farbe={farbe} form={SCHILD} />
          {zahl(58, 36)}
          <Sterne anzahl={sterne} farbe={farbe} y={74} />
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
          {zahl(74, 30)}
        </g>
      )
      break
    default:
      inhalt = (
        <g>
          <Edelstein id={id} farbe={farbe} filter={filter} />
          {zahl(56, 30, '#EAF7FF')}
          <Diamanten anzahl={diamanten} farbe={farbe} y={72} />
          <Funkeln x={30} y={24} r={6} farbe="#FFFFFF" />
          <Funkeln x={76} y={34} r={4} farbe="#FFFFFF" />
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
