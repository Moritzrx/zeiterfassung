import { useState, type ReactElement } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { stundenText } from '../format'
import { TaetigkeitSymbol, taetigkeitFarbe, useSymbolZuordnung } from '../symbole'

export interface Verteilungswert {
  name: string
  sekunden: number
}

const SONSTIGE = '#5A5A60'

/** Anteil jeder Tätigkeit an der produktiven Zeit. Markenfarben oder Palette; beim Überfahren treten die anderen zurück. */
export function VerteilungsRing({ werte }: { werte: Verteilungswert[] }): ReactElement {
  const [aktiv, setAktiv] = useState<number | null>(null)
  const zuordnung = useSymbolZuordnung()
  const gesamt = werte.reduce((s, w) => s + w.sekunden, 0)

  if (werte.length === 0 || gesamt === 0) {
    return <p className="mt-2 text-sm text-dim">Noch keine produktive Zeit in diesem Zeitraum.</p>
  }

  const farben = werte.map((w, i) =>
    w.name === 'Sonstige' || w.name === 'Ohne Tätigkeit' ? SONSTIGE : taetigkeitFarbe(zuordnung, w.name, i)
  )
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
            <Cell key={w.name} fill={farben[i]} fillOpacity={aktiv === null || aktiv === i ? 1 : 0.25} />
          ))}
        </Pie>
      </PieChart>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {werte.map((w, i) => (
          <div
            key={w.name}
            onMouseEnter={() => setAktiv(i)}
            onMouseLeave={() => setAktiv(null)}
            className={`flex items-center gap-3 rounded-chip px-2 py-1.5 text-sm transition-colors ${
              aktiv === i ? 'bg-panel-2' : ''
            }`}
          >
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: farben[i] }} />
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
