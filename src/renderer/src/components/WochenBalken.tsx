import { memo, type ReactElement } from 'react'
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
  /** Tagesrichtwert in produktiven Stunden, als gestrichelte Linie */
  richtwert: number
}

function stundenFormat(wert: number): string {
  return wert.toFixed(1).replace('.', ',') + ' h'
}

/**
 * Montag bis Sonntag. Der breite grüne Balken ist die produktive Zeit, nur sie zählt gegen die
 * Richtwert-Linie. Unproduktives und Ungeklärtes stehen als schmale Balken daneben, damit man sie
 * sieht, ohne dass sie den grünen Balken höher machen. Inaktive Zeit bleibt weg.
 */
function WochenBalkenInnen({ tage, richtwert }: Props): ReactElement {
  const hoechster = Math.max(richtwert * 1.15, ...tage.flatMap((t) => [t.produktiv, t.unproduktiv, t.ungeklaert]))
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={tage} margin={{ top: 8, right: 36, left: 0, bottom: 0 }} barCategoryGap="22%" barGap={2}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 12 }} />
          <YAxis hide domain={[0, hoechster]} />
          <Tooltip content={<DiagrammTooltip format={stundenFormat} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine
            y={richtwert}
            stroke="#5A5A60"
            strokeDasharray="4 4"
            label={{ value: `${stundenFormat(richtwert)} produktiv`, position: 'right', fill: '#5A5A60', fontSize: 11 }}
          />
          <Bar dataKey="produktiv" name="produktiv" fill="#00C076" barSize={26} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="unproduktiv" name="unproduktiv" fill="#FF4D4D" barSize={7} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="ungeklaert" name="ungeklärt" fill="#8A8A8F" barSize={7} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Gemerkt: rendert nur neu, wenn sich die Eingaben ändern; die Statusmeldung alle 5 s rendert sonst jedes Diagramm mit. */
export const WochenBalken = memo(WochenBalkenInnen)
