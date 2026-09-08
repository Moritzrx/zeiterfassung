import { useState, type ReactElement } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { stundenText } from '../format'
import { TaetigkeitSymbol } from '../symbole'

export interface Verteilungswert {
  name: string
  sekunden: number
}

const GRAUSTUFEN = ['#F2F2F3', '#C9C9CD', '#A6A6AB', '#88888D', '#6E6E73', '#59595E', '#48484C', '#3A3A3E']
const ORANGE = '#FE5303'

/** Anteil jeder Tätigkeit an der produktiven Zeit. Grautöne, das größte Segment am hellsten; beim Überfahren orange. */
export function VerteilungsRing({ werte }: { werte: Verteilungswert[] }): ReactElement {
  const [aktiv, setAktiv] = useState<number | null>(null)
  const gesamt = werte.reduce((s, w) => s + w.sekunden, 0)

  if (werte.length === 0 || gesamt === 0) {
    return <p className="mt-2 text-sm text-dim">Noch keine produktive Zeit in den letzten 30 Tagen.</p>
  }

  const groesse = 200
  return (
    <div className="mt-2 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <PieChart width={groesse} height={groesse} onMouseLeave={() => setAktiv(null)}>
        <Pie
          data={werte}
          dataKey="sekunden"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={groesse / 2 - 26}
          outerRadius={groesse / 2}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          paddingAngle={werte.length > 1 ? 2 : 0}
          cornerRadius={4}
          isAnimationActive={false}
          onMouseEnter={(_, index) => setAktiv(index)}
        >
          {werte.map((w, i) => (
            <Cell key={w.name} fill={aktiv === i ? ORANGE : GRAUSTUFEN[Math.min(i, GRAUSTUFEN.length - 1)]} />
          ))}
        </Pie>
      </PieChart>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {werte.map((w, i) => (
          <div
            key={w.name}
            onMouseEnter={() => setAktiv(i)}
            onMouseLeave={() => setAktiv(null)}
            className={`flex items-center gap-3 rounded-chip px-2 py-1 text-sm transition-colors ${
              aktiv === i ? 'bg-panel-2' : ''
            }`}
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: aktiv === i ? ORANGE : GRAUSTUFEN[Math.min(i, GRAUSTUFEN.length - 1)] }}
            />
            <TaetigkeitSymbol name={w.name === 'Sonstige' || w.name === 'Ohne Tätigkeit' ? null : w.name} groesse={16} />
            <span className="truncate">{w.name}</span>
            <span className="ml-auto shrink-0 text-mute">{stundenText(w.sekunden)} h</span>
            <span className="w-10 shrink-0 text-right text-mute">{Math.round((w.sekunden / gesamt) * 100)} %</span>
          </div>
        ))}
      </div>
    </div>
  )
}
