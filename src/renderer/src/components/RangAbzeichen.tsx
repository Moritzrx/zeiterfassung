import type { ReactElement } from 'react'
import { STUFEN_FARBEN, rangName, rangStufe, type RangStufe } from '@shared/rang'
import bronze from '../assets/wappen/rang-bronze.png'
import silber from '../assets/wappen/rang-silber.png'
import gold from '../assets/wappen/rang-gold.png'
import champion from '../assets/wappen/rang-champion.png'
import diamant from '../assets/wappen/rang-diamant.png'
import { Band, Definitionen, Metallschrift, SCHILD, dunkel, stern } from './wappen'

/*
 * Das Abzeichen eines Wochenrangs: ein illustriertes Wappen je Stufe (erzeugt mit Higgsfield,
 * liegt als PNG mit Alphakanal in assets/wappen und wird
 * ohne sichtbaren Rand eingeblendet), darüber als Vektor die Rangzahl, die Sterne bzw.
 * kleinen Brillanten der Unterstufe und das Namensband. Rang 0 bleibt ein graues Schild.
 */

const BILDER: Record<RangStufe, string | null> = { keine: null, bronze, silber, gold, champion, diamant }
const STERN_GELB = '#FFD166'

interface Props {
  rang: number
  groesse?: number
}

function Sterne({ anzahl, y }: { anzahl: number; y: number }): ReactElement {
  return (
    <g>
      {Array.from({ length: anzahl }, (_, i) => (
        <polygon key={i} points={stern(50 + (i - (anzahl - 1) / 2) * 12, y, 5.4)} fill={STERN_GELB} stroke="#5A3D00" strokeWidth={1.2} strokeLinejoin="round" />
      ))}
    </g>
  )
}

function Diamanten({ anzahl, farbe, y }: { anzahl: number; farbe: string; y: number }): ReactElement {
  return (
    <g>
      {Array.from({ length: anzahl }, (_, i) => {
        const x = 50 + (i - (anzahl - 1) / 2) * 9.5
        return (
          <g key={i}>
            <polygon points={`${x - 3.6},${y - 2} ${x + 3.6},${y - 2} ${x},${y + 5}`} fill={dunkel(farbe, 0.1)} stroke={dunkel(farbe, 0.6)} strokeWidth={0.9} />
            <polygon points={`${x - 3.6},${y - 2} ${x + 3.6},${y - 2} ${x + 2.2},${y - 5} ${x - 2.2},${y - 5}`} fill="#FFFFFF" fillOpacity={0.92} stroke={dunkel(farbe, 0.6)} strokeWidth={0.9} />
          </g>
        )
      })}
    </g>
  )
}

export function RangAbzeichen({ rang, groesse = 56 }: Props): ReactElement {
  const stufe = rangStufe(rang)
  const farbe = STUFEN_FARBEN[stufe]
  const bild = BILDER[stufe]
  const id = `rang-${stufe}`
  const sterne = stufe === 'bronze' || stufe === 'silber' || stufe === 'gold' ? ((rang - 1) % 3) + 1 : 0
  const diamanten = stufe === 'diamant' ? rang - 10 : 0
  const name = rangName(rang)

  return (
    <div className="relative shrink-0 select-none" style={{ width: groesse, height: groesse }} role="img" aria-label={`Rang ${rang}, ${name}`}>
      {bild && (
        <img
          src={bild}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{ left: '-12%', top: '-12%', width: '124%', height: '124%' }}
        />
      )}
      <svg className="absolute inset-0" width={groesse} height={groesse} viewBox="0 0 100 100" overflow="visible" aria-hidden="true">
        <Definitionen id={id} farbe={farbe} />
        {!bild && <path d={SCHILD} fill="#1C1C1F" stroke={farbe} strokeWidth={2.5} strokeLinejoin="round" />}
        {/* dunkler Rückhalt, damit die Zahl auf dem Wappen lesbar bleibt */}
        {bild && <rect x={rang >= 10 ? 27 : 33} y={41} width={rang >= 10 ? 46 : 34} height={30} rx={9} fill="#000000" fillOpacity={0.38} />}
        <Metallschrift text={String(rang)} fuellung="#FFFFFF" farbe={farbe} y={65} groesse={rang >= 10 ? 30 : 34} kontur={bild ? dunkel(farbe, 0.8) : '#0B0B0C'} />
        {sterne > 0 && <Sterne anzahl={sterne} y={78} />}
        {diamanten > 0 && <Diamanten anzahl={diamanten} farbe={farbe} y={78} />}
        {bild && <Band id={id} farbe={farbe} text={name} y={86} />}
      </svg>
    </div>
  )
}
