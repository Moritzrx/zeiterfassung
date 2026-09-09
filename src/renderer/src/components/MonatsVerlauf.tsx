import { memo, type ReactElement } from 'react'
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DiagrammTooltip } from './DiagrammTooltip'

export interface Monatswert {
  label: string
  titel: string
  produktiv: number
  schnitt: number
}

function stundenFormat(wert: number): string {
  return wert.toFixed(1).replace('.', ',') + ' h'
}

/** Produktive Stunden je Tag über den gewählten Zeitraum, darüber der gleitende 7-Tage-Schnitt als dünne Linie. */
function MonatsVerlaufInnen({ werte }: { werte: Monatswert[] }): ReactElement {
  // Höchstens etwa acht Beschriftungen auf der Achse, egal wie lang der Zeitraum ist.
  const abstand = Math.max(0, Math.ceil(werte.length / 8) - 1)
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={werte} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 11 }} interval={abstand} />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip content={<DiagrammTooltip format={stundenFormat} />} cursor={{ stroke: '#3A3A3E' }} />
          <Area
            type="monotone"
            dataKey="produktiv"
            name="produktiv"
            stroke="#00C076"
            strokeWidth={1.5}
            fill="#00C076"
            fillOpacity={0.14}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="schnitt"
            name="7-Tage-Schnitt (alle Tage)"
            stroke="#8E8E93"
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Gemerkt: rendert nur neu, wenn sich die Eingaben ändern; die Statusmeldung alle 5 s rendert sonst jedes Diagramm mit. */
export const MonatsVerlauf = memo(MonatsVerlaufInnen)
