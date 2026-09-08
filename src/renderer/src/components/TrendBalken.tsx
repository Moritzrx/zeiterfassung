import type { ReactElement } from 'react'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DiagrammTooltip } from './DiagrammTooltip'

export interface Trendwert {
  label: string
  titel: string
  /** Stunden als Text für den Tooltip */
  text: string
  level: number
  leer: boolean
}

interface Props {
  werte: Trendwert[]
  zielLevel: number
}

/** Erreichtes Level je Woche über die letzten 12 Wochen. Ab Ziel-Level grün, darunter rot, ohne Daten leer. */
export function TrendBalken({ werte, zielLevel }: Props): ReactElement {
  const hoechster = Math.max(zielLevel + 1, ...werte.map((w) => w.level))
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={werte} margin={{ top: 8, right: 64, left: 0, bottom: 0 }} barCategoryGap="30%">
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 11 }} />
          <YAxis hide domain={[0, hoechster]} />
          <Tooltip
            content={<DiagrammTooltip format={(v) => `Level ${Math.round(v)}`} />}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <ReferenceLine
            y={zielLevel}
            stroke="#5A5A60"
            strokeDasharray="4 4"
            label={{ value: `Level ${zielLevel}`, position: 'right', fill: '#5A5A60', fontSize: 11 }}
          />
          <Bar dataKey="level" name="Level" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {werte.map((w) => (
              <Cell key={w.label} fill={w.leer ? '#1C1C1F' : w.level >= zielLevel ? '#00C076' : '#FF4D4D'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
