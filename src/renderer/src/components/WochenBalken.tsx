import type { ReactElement } from 'react'
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DiagrammTooltip } from './DiagrammTooltip'

export interface TagesWerte {
  label: string
  titel: string
  produktiv: number
  unproduktiv: number
  ungeklaert: number
  inaktiv: number
}

interface Props {
  tage: TagesWerte[]
  /** Tagesrichtwert in Stunden, als gestrichelte Linie */
  richtwert: number
}

function stundenFormat(wert: number): string {
  return wert.toFixed(1).replace('.', ',') + ' h'
}

/** Montag bis Sonntag, jeder Balken gestapelt nach produktiv, unproduktiv, ungeklärt, inaktiv. */
export function WochenBalken({ tage, richtwert }: Props): ReactElement {
  const hoechster = Math.max(richtwert * 1.15, ...tage.map((t) => t.produktiv + t.unproduktiv + t.ungeklaert + t.inaktiv))
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={tage} margin={{ top: 8, right: 36, left: 0, bottom: 0 }} barCategoryGap="28%">
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 12 }} />
          <YAxis hide domain={[0, hoechster]} />
          <Tooltip content={<DiagrammTooltip format={stundenFormat} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine
            y={richtwert}
            stroke="#5A5A60"
            strokeDasharray="4 4"
            label={{ value: stundenFormat(richtwert), position: 'right', fill: '#5A5A60', fontSize: 11 }}
          />
          <Bar dataKey="produktiv" name="produktiv" stackId="tag" fill="#00C076" isAnimationActive={false} />
          <Bar dataKey="unproduktiv" name="unproduktiv" stackId="tag" fill="#FF4D4D" isAnimationActive={false} />
          <Bar dataKey="ungeklaert" name="ungeklärt" stackId="tag" fill="#8A8A8F" isAnimationActive={false} />
          <Bar dataKey="inaktiv" name="inaktiv" stackId="tag" fill="#3A3A3E" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
