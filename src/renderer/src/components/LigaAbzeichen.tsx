import type { ReactElement } from 'react'
import { LIGA_FARBEN, liga, type Liga, type LigaStufe } from '@shared/liga'
import bronze from '../assets/wappen/liga-bronze.png'
import silber from '../assets/wappen/liga-silber.png'
import gold from '../assets/wappen/liga-gold.png'
import kristall from '../assets/wappen/liga-kristall.png'
import meister from '../assets/wappen/liga-meister.png'
import champion from '../assets/wappen/liga-champion.png'
import titan from '../assets/wappen/liga-titan.png'
import legende from '../assets/wappen/liga-legende.png'
import { Definitionen, Metallschrift, SCHILD, dunkel } from './wappen'

/*
 * Die Liga-Abzeichen: ein illustriertes Wappen je Stufe (erzeugt mit Higgsfield, liegt als PNG mit
 * Alphakanal in assets/wappen und wird ohne sichtbaren Rand eingeblendet), darüber als Vektor die
 * römische Ziffer der Unterstufe. Ohne Liga bleibt ein graues Schild mit Strich.
 */

const BILDER: Record<LigaStufe, string | null> = { keine: null, bronze, silber, gold, kristall, meister, champion, titan, legende }
const ROEMISCH: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' }

interface Props {
  /** Trophäenstand oder direkt eine Liga */
  trophaeen?: number
  liga?: Liga
  groesse?: number
}

export function LigaAbzeichen({ trophaeen = 0, liga: vorgabe, groesse = 56 }: Props): ReactElement {
  const l = vorgabe ?? liga(trophaeen)
  const farbe = LIGA_FARBEN[l.stufe]
  const bild = BILDER[l.stufe]
  const id = `liga-${l.stufe}`
  const ziffer = ROEMISCH[l.nummer]

  return (
    <div className="relative shrink-0 select-none" style={{ width: groesse, height: groesse }} role="img" aria-label={l.name}>
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
        {!bild && (
          <g>
            <path d={SCHILD} fill="#1C1C1F" stroke={farbe} strokeWidth={2.5} strokeLinejoin="round" />
            <path d="M38 52 H62" stroke={farbe} strokeWidth={4} strokeLinecap="round" />
          </g>
        )}
        {bild && ziffer && (
          <g>
            <rect x={ziffer === 'III' ? 30 : 35} y={44} width={ziffer === 'III' ? 40 : 30} height={26} rx={8} fill="#000000" fillOpacity={0.38} />
            <Metallschrift text={ziffer} fuellung="#FFFFFF" farbe={farbe} y={65} groesse={ziffer === 'III' ? 24 : 28} kontur={dunkel(farbe, 0.8)} />
          </g>
        )}
      </svg>
    </div>
  )
}
