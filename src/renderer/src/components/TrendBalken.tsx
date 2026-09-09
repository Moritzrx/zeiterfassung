import { memo, type ReactElement } from 'react'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DiagrammTooltip } from './DiagrammTooltip'

export interface Trendwert {
  label: string
  titel: string
  /** Stunden als Text für den Tooltip */
  text: string
  rang: number
  leer: boolean
}

interface Props {
  werte: Trendwert[]
  zielRang: number
}

/** Erreichter Rang je Woche. Ab Ziel-Rang grün, darunter rot, ohne Daten leer. */
function TrendBalkenInnen({ werte, zielRang }: Props): ReactElement {
  const hoechster = Math.max(zielRang + 1, ...werte.map((w) => w.rang))
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={werte} margin={{ top: 8, right: 64, left: 0, bottom: 0 }} barCategoryGap="30%">
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 11 }} />
          <YAxis hide domain={[0, hoechster]} />
          <Tooltip
            content={<DiagrammTooltip format={(v) => `Rang ${Math.round(v)}`} />}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <ReferenceLine
            y={zielRang}
            stroke="#5A5A60"
            strokeDasharray="4 4"
            label={{ value: `Rang ${zielRang}`, position: 'right', fill: '#5A5A60', fontSize: 11 }}
          />
          <Bar dataKey="rang" name="Rang" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {werte.map((w) => (
              <Cell key={w.label} fill={w.leer ? '#1C1C1F' : w.rang >= zielRang ? '#00C076' : '#FF4D4D'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Gemerkt: rendert nur neu, wenn sich die Eingaben ändern; die Statusmeldung alle 5 s rendert sonst jedes Diagramm mit. */
export const TrendBalken = memo(TrendBalkenInnen)
