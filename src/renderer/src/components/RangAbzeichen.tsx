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
 * Das Abzeichen eines Wochenrangs, ein Wappen im Spiel-Stil:
 *   Bronze 1–3    genietetes Bronzeschild, goldene Sterne, Namensband
 *   Silber 4–6    Silberschild mit Flügeln, Stein oben, Sterne, Namensband
 *   Gold 7–9      Goldschild im Lorbeer mit Rubin oben, Sterne, Namensband
 *   Champion 10   Schild mit Krone in Flammen und Strahlenkranz
 *   Diamant 11–15 Brillant im Strahlenkranz mit Flügeln, ein bis fünf kleine Brillanten
 * Alle leuchten in ihrer Farbe. Rang 0 ist ein schlichtes graues Schild.
 */

interface Props {
  rang: number
  groesse?: number
}

const STERN_GELB = '#FFD166'

/** Ein bis drei goldene Sterne in einer Reihe. */
function Sterne({ anzahl, y }: { anzahl: number; y: number }): ReactElement {
  return (
    <g>
      {Array.from({ length: anzahl }, (_, i) => (
        <polygon key={i} points={stern(50 + (i - (anzahl - 1) / 2) * 13, y, 6)} fill={STERN_GELB} stroke="#6B4A00" strokeWidth={1.2} strokeLinejoin="round" />
      ))}
    </g>
  )
}

/** Ein bis fünf kleine Brillanten in einer Reihe, mit Lichtkante. */
function Diamanten({ anzahl, farbe, y }: { anzahl: number; farbe: string; y: number }): ReactElement {
  return (
    <g>
      {Array.from({ length: anzahl }, (_, i) => {
        const x = 50 + (i - (anzahl - 1) / 2) * 10.5
        return (
          <g key={i}>
            <polygon points={`${x - 4},${y - 2} ${x + 4},${y - 2} ${x},${y + 5.5}`} fill={dunkel(farbe, 0.15)} stroke={dunkel(farbe, 0.6)} strokeWidth={0.9} />
            <polygon points={`${x - 4},${y - 2} ${x + 4},${y - 2} ${x + 2.4},${y - 5.5} ${x - 2.4},${y - 5.5}`} fill="#FFFFFF" fillOpacity={0.9} stroke={dunkel(farbe, 0.6)} strokeWidth={0.9} />
            <polygon points={`${x - 4},${y - 2} ${x},${y + 5.5} ${x - 1},${y - 2}`} fill="#FFFFFF" fillOpacity={0.35} />
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
      <polygon points="50,8 57,15 50,22 43,15" fill={stein} stroke={dunkel(farbe, 0.7)} strokeWidth={1.2} strokeLinejoin="round" />
      <polygon points="50,8 57,15 50,15" fill="#FFFFFF" fillOpacity={0.55} />
    </g>
  )
}

export function RangAbzeichen({ rang, groesse = 56 }: Props): ReactElement {
  const stufe = rangStufe(rang)
  const farbe = STUFEN_FARBEN[stufe]
  const id = `rang-${stufe}`
  const metall = `url(#${id}-metall)`
  const filter = stufe === 'keine' ? undefined : `url(#${id}-leuchten)`
  const sterne = stufe === 'bronze' || stufe === 'silber' || stufe === 'gold' ? ((rang - 1) % 3) + 1 : 0
  const diamanten = stufe === 'diamant' ? rang - 10 : 0
  const name = rangName(rang)
  const zahl = (y: number, groesseZahl: number, fuellung = '#FFFFFF', kontur?: string): ReactElement => (
    <Metallschrift text={String(rang)} fuellung={fuellung} farbe={farbe} y={y} groesse={rang >= 10 ? groesseZahl * 0.86 : groesseZahl} kontur={kontur} />
  )

  let inhalt: ReactElement
  switch (stufe) {
    case 'keine':
      inhalt = (
        <g>
          <path d={SCHILD} fill="#1C1C1F" stroke={farbe} strokeWidth={2.5} strokeLinejoin="round" />
          {zahl(62, 36, farbe, '#0B0B0C')}
        </g>
      )
      break
    case 'bronze':
      inhalt = (
        <g>
          <Metallform id={id} farbe={farbe} form={SCHILD} filter={filter} />
          <Nieten farbe={farbe} />
          {zahl(55, 40)}
          <Sterne anzahl={sterne} y={66} />
          <Band id={id} farbe={farbe} text={name} />
        </g>
      )
      break
    case 'silber':
      inhalt = (
        <g>
          <Fluegel farbe={farbe} gross={false} />
          <Metallform id={id} farbe={farbe} form={SCHILD} filter={filter} />
          <Nieten farbe={farbe} />
          <Stein farbe={farbe} stein={hell(farbe, 0.5)} />
          {zahl(57, 36)}
          <Sterne anzahl={sterne} y={67} />
          <Band id={id} farbe={farbe} text={name} />
        </g>
      )
      break
    case 'gold':
      inhalt = (
        <g>
          <Lorbeer farbe={farbe} />
          <Metallform id={id} farbe={farbe} form={SCHILD} filter={filter} />
          <Stein farbe={farbe} stein="#FF4D4D" />
          {zahl(57, 36)}
          <Sterne anzahl={sterne} y={67} />
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
          {zahl(71, 30)}
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
          {zahl(45, 28, '#FFFFFF', '#0A2E4A')}
          <Diamanten anzahl={diamanten} farbe={farbe} y={63} />
          <Funkeln x={20} y={30} r={7} farbe="#FFFFFF" />
          <Funkeln x={84} y={38} r={5} farbe="#FFFFFF" />
          <Funkeln x={62} y={82} r={3.5} farbe="#FFFFFF" />
          <Band id={id} farbe={farbe} text={name} y={82} />
        </g>
      )
  }

  return (
    <svg width={groesse} height={groesse} viewBox="0 0 100 100" overflow="visible" role="img" aria-label={`Rang ${rang}, ${rangName(rang)}`}>
      <Definitionen id={id} farbe={farbe} />
      {inhalt}
    </svg>
  )
}
