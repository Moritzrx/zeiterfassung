import type { ReactElement } from 'react'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DiagrammTooltip } from './DiagrammTooltip'

export interface Teamwert {
  name: string
  titel: string
  stunden: number
  ziel: number
  istIch: boolean
}

function stundenFormat(wert: number): string {
  return wert.toFixed(1).replace('.', ',') + ' h'
}

/** Wochenstunden der drei im Vergleich, mit dem Wochenziel als gestrichelter Linie. */
export function TeamBalken({ werte }: { werte: Teamwert[] }): ReactElement {
  const ziel = Math.max(...werte.map((w) => w.ziel), 1)
  const hoechster = Math.max(ziel * 1.15, ...werte.map((w) => w.stunden))
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={werte} margin={{ top: 8, right: 56, left: 0, bottom: 0 }} barCategoryGap="35%">
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 12 }} />
          <YAxis hide domain={[0, hoechster]} />
          <Tooltip content={<DiagrammTooltip format={stundenFormat} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine
            y={ziel}
            stroke="#5A5A60"
            strokeDasharray="4 4"
            label={{ value: `Ziel ${stundenFormat(ziel)}`, position: 'right', fill: '#5A5A60', fontSize: 11 }}
          />
          <Bar dataKey="stunden" name="produktiv diese Woche" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {werte.map((w) => (
              <Cell key={w.name} fill={w.stunden >= w.ziel ? '#00C076' : w.istIch ? '#F2F2F3' : '#8E8E93'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
