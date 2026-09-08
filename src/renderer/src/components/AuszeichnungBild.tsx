import type { ReactElement } from 'react'
import { Flame, Repeat, Target, Trophy, type LucideIcon } from 'lucide-react'
import type { AuszeichnungTyp } from '@shared/typen'

/**
 * Grauer Platzhalter in der richtigen Größe, bis die echten Abzeichen als PNG
 * unter src/assets/badges/ liegen. Freigeschaltet in Orange, sonst ausgegraut.
 */
const SYMBOLE: Record<AuszeichnungTyp, LucideIcon> = {
  erste_woche_level10: Trophy,
  drei_wochen_level10: Repeat,
  alle_lernziele: Target,
  fokus_woche: Flame
}

export function AuszeichnungBild({
  typ,
  erreicht,
  groesse = 80
}: {
  typ: AuszeichnungTyp
  erreicht: boolean
  groesse?: number
}): ReactElement {
  const Icon = SYMBOLE[typ]
  const farbe = erreicht ? '#FE5303' : '#3A3A3E'
  return (
    <div className="relative" style={{ width: groesse, height: groesse }}>
      <svg width={groesse} height={groesse} viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M32 3 L57 17.5 V46.5 L32 61 L7 46.5 V17.5 Z"
          fill={erreicht ? '#3A1808' : '#151517'}
          stroke={farbe}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" style={{ color: farbe }}>
        <Icon size={groesse * 0.38} strokeWidth={1.75} />
      </div>
    </div>
  )
}
