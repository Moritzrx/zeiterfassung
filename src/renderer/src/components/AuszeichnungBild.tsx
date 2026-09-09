import type { ReactElement } from 'react'
import {
  Award,
  BedDouble,
  Brush,
  Flame,
  Footprints,
  Gem,
  Infinity as Unendlich,
  Moon,
  Mountain,
  Repeat,
  Sunrise,
  Swords,
  Target,
  Trophy,
  type LucideIcon
} from 'lucide-react'
import { AUSZEICHNUNGEN } from '@shared/auszeichnungen'
import type { AuszeichnungTyp } from '@shared/typen'
import { Definitionen, dunkel, hell } from './wappen'

/** Das Symbol in der Mitte jeder Medaille. */
const SYMBOLE: Record<AuszeichnungTyp, LucideIcon> = {
  erste_woche_level10: Trophy,
  drei_wochen_level10: Repeat,
  dauerbrenner: Flame,
  comeback: Swords,
  eternal: Unendlich,
  perfekte_woche: Award,
  alle_lernziele: Target,
  fokus_woche: Gem,
  marathon: Mountain,
  sprint: Footprints,
  fruehaufsteher: Sunrise,
  nachteule: Moon,
  wochenend_krieger: BedDouble,
  aufgeraeumt: Brush
}

/**
 * Eine Medaille im Spiel-Stil: Ordensband oben, Metallrand in der Farbe der Auszeichnung,
 * geflochtener Innenring, Glanz und in der Mitte das Symbol. Noch offene sind grau und blass.
 */
export function AuszeichnungBild({ typ, erreicht, groesse = 80 }: { typ: AuszeichnungTyp; erreicht: boolean; groesse?: number }): ReactElement {
  const Icon = SYMBOLE[typ]
  const farbe = erreicht ? AUSZEICHNUNGEN[typ].farbe : '#5A5A60'
  const id = `ausz-${typ}-${erreicht ? 'an' : 'aus'}`
  const band = erreicht ? dunkel(farbe, 0.35) : '#2A2A2E'
  return (
    <div className={`relative ${erreicht ? '' : 'opacity-60'}`} style={{ width: groesse, height: groesse }}>
      <svg width={groesse} height={groesse} viewBox="0 0 100 100" overflow="visible" aria-hidden="true">
        <Definitionen id={id} farbe={farbe} />
        <g filter={erreicht ? `url(#${id}-leuchten)` : undefined}>
          {/* Ordensband */}
          <path d="M31 0 H47 L52 36 H36 Z" fill={band} stroke={dunkel(farbe, 0.75)} strokeWidth={1.6} strokeLinejoin="round" />
          <path d="M53 0 H69 L64 36 H48 Z" fill={hell(band, 0.12)} stroke={dunkel(farbe, 0.75)} strokeWidth={1.6} strokeLinejoin="round" />
          {/* Medaille */}
          <circle cx="50" cy="62" r="33" fill={dunkel(farbe, 0.72)} transform="translate(0 3)" />
          <circle cx="50" cy="62" r="33" fill={`url(#${id}-metall)`} stroke={dunkel(farbe, 0.78)} strokeWidth={3} />
          <circle cx="50" cy="62" r="26" fill={`url(#${id}-feld)`} stroke={dunkel(farbe, 0.6)} strokeWidth={1.2} />
          <circle cx="50" cy="62" r="29.5" fill="none" stroke={hell(farbe, 0.4)} strokeOpacity={0.8} strokeWidth={1.4} strokeDasharray="2.6 2.2" />
          <ellipse cx="50" cy="46" rx="20" ry="8" fill={`url(#${id}-glanz)`} />
        </g>
      </svg>
      <div
        className="absolute flex items-center justify-center"
        style={{ left: 0, width: groesse, top: groesse * 0.62 - groesse * 0.2, height: groesse * 0.4, color: erreicht ? '#FFFFFF' : '#8E8E93' }}
      >
        <Icon size={groesse * 0.3} strokeWidth={2.2} style={erreicht ? { filter: 'drop-shadow(0 1px 0 rgba(0,0,0,.6))' } : undefined} />
      </div>
    </div>
  )
}
