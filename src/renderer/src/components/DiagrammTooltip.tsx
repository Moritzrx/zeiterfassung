import type { ReactElement } from 'react'

interface Eintrag {
  name?: string
  value?: number
  color?: string
  payload?: { farbe?: string; text?: string; titel?: string }
}

interface Props {
  active?: boolean
  payload?: ReadonlyArray<Eintrag>
  label?: string | number
  /** Formatiert einen Wert, Standard: Sekunden als Stunden mit Komma */
  format?: (wert: number) => string
}

function standardFormat(wert: number): string {
  return (wert / 3600).toFixed(1).replace('.', ',') + ' h'
}

/** Schlichter dunkler Tooltip für alle Diagramme: Name und genauer Wert, sonst nichts. */
export function DiagrammTooltip({ active, payload, label, format = standardFormat }: Props): ReactElement | null {
  if (!active || !payload || payload.length === 0) return null
  const kopf = payload[0]?.payload?.titel ?? (label !== undefined && label !== '' ? String(label) : null)
  const zeilen = payload.filter((e) => (e.value ?? 0) > 0)
  return (
    <div className="rounded-chip bg-panel-2 px-3 py-2 text-xs text-ink">
      {kopf && <div className="mb-1 text-mute">{kopf}</div>}
      {zeilen.map((e, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: e.payload?.farbe ?? e.color ?? '#8E8E93' }}
          />
          <span className="text-mute">{e.payload?.text ?? e.name}</span>
          <span className="ml-auto pl-3">{format(e.value ?? 0)}</span>
        </div>
      ))}
    </div>
  )
}
