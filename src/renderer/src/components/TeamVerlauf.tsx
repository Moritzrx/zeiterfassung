import type { ReactElement } from 'react'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DiagrammTooltip } from './DiagrammTooltip'

export interface Verlaufsperson {
  name: string
  farbe: string
  istIch: boolean
}

/** Eine Woche mit den Stunden je Person unter deren Namen. */
export type Verlaufswoche = { label: string; titel: string } & Record<string, string | number>

interface Props {
  wochen: Verlaufswoche[]
  personen: Verlaufsperson[]
  /** Wochenziel in Stunden, als gestrichelte Linie */
  ziel: number
}

function stundenFormat(wert: number): string {
  return wert.toFixed(1).replace('.', ',') + ' h'
}

/** Produktive Wochenstunden der drei als Linien über den gewählten Zeitraum. */
export function TeamVerlauf({ wochen, personen, ziel }: Props): ReactElement {
  const abstand = Math.max(0, Math.ceil(wochen.length / 8) - 1)
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={wochen} margin={{ top: 8, right: 56, left: 16, bottom: 0 }}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 11 }} interval={abstand} />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip content={<DiagrammTooltip format={stundenFormat} />} cursor={{ stroke: '#3A3A3E' }} />
          <ReferenceLine
            y={ziel}
            stroke="#5A5A60"
            strokeDasharray="4 4"
            label={{ value: `Ziel ${stundenFormat(ziel)}`, position: 'right', fill: '#5A5A60', fontSize: 11 }}
          />
          {personen.map((p) => (
            <Line
              key={p.name}
              type="monotone"
              dataKey={p.name}
              name={p.name}
              stroke={p.farbe}
              strokeWidth={p.istIch ? 2.5 : 1.75}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
