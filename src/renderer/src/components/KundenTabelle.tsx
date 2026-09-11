import { useMemo, type ReactElement } from 'react'
import { Building2 } from 'lucide-react'
import type { Block } from '@shared/typen'
import { taetigkeitSchluessel } from '@shared/regeln'
import { kurzDatum, stundenText } from '../format'
import { berlinDatum } from '@shared/zeit'

interface Zeile {
  name: string
  sekunden: number
  zuletzt: string | null
}

/** Anteil eines Blocks am Zeitraum in Sekunden. */
function anteil(b: Block, von: number, bis: number): number {
  const s = Math.max(Date.parse(b.start), von)
  const e = Math.min(Date.parse(b.ende), bis)
  return e > s ? (e - s) / 1000 : 0
}

/**
 * Kundenliste auf der Auswertung (11. September 2026, "wo sehe ich, wie viel Zeit in welche Kunden geflossen ist"):
 * jeder Kunde mit produktiven Stunden im Zeitraum, Anteil an der produktiven Zeit, Balken und letztem Einsatz;
 * sortiert nach Stunden. Kunden aus der Teamliste ohne Zeit im Zeitraum stehen darunter, damit die Liste
 * vollständig ist. Rechnet aus den lokalen Blöcken (bis 13 Wochen zurück).
 */
export function KundenTabelle({
  bloecke,
  kunden,
  von,
  bis
}: {
  bloecke: Block[]
  /** Alle bekannten Kunden des Teams */
  kunden: string[]
  von: Date
  bis: Date
}): ReactElement | null {
  const { zeilen, ohneKunde, gesamt, ohneZeit } = useMemo(() => {
    const v = von.getTime()
    const b2 = bis.getTime()
    const summen = new Map<string, Zeile>()
    let ohneKunde = 0
    let gesamt = 0
    for (const b of bloecke) {
      if (b.bewertung !== 'produktiv' || b.geloeschtAm) continue
      const a = anteil(b, v, b2)
      if (a <= 0) continue
      gesamt += a
      if (!b.kunde) {
        ohneKunde += a
        continue
      }
      const schluessel = taetigkeitSchluessel(b.kunde)
      const z = summen.get(schluessel) ?? { name: b.kunde, sekunden: 0, zuletzt: null }
      z.sekunden += a
      if (!z.zuletzt || b.ende > z.zuletzt) z.zuletzt = b.ende
      summen.set(schluessel, z)
    }
    const zeilen = [...summen.values()].sort((a, b) => b.sekunden - a.sekunden)
    const ohneZeit = kunden.filter((k) => !summen.has(taetigkeitSchluessel(k)))
    return { zeilen, ohneKunde, gesamt, ohneZeit }
  }, [bloecke, kunden, von, bis])

  if (zeilen.length === 0 && kunden.length === 0) return null
  const maxSekunden = Math.max(zeilen[0]?.sekunden ?? 0, ohneKunde, 1)

  return (
    <div className="mt-2">
      {zeilen.length === 0 ? (
        <p className="text-sm text-dim">In diesem Zeitraum hat noch kein Block einen Kunden.</p>
      ) : (
        <div className="flex flex-col divide-y divide-panel-2">
          {zeilen.map((z) => (
            <div key={z.name} className="flex items-center gap-4 py-2.5">
              <div className="flex w-52 min-w-0 shrink-0 items-center gap-2">
                <Building2 size={14} strokeWidth={1.5} className="shrink-0 text-mute" />
                <span className="truncate text-sm">{z.name}</span>
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-produktiv" style={{ width: `${Math.max(2, (z.sekunden / maxSekunden) * 100)}%` }} />
              </div>
              <div className="w-16 shrink-0 text-right text-sm tabular-nums">{stundenText(z.sekunden)} h</div>
              <div className="w-12 shrink-0 text-right text-xs tabular-nums text-mute">{gesamt ? Math.round((z.sekunden / gesamt) * 100) : 0} %</div>
              <div className="w-20 shrink-0 text-right text-xs text-dim">{z.zuletzt ? kurzDatum(berlinDatum(new Date(z.zuletzt))) : ''}</div>
            </div>
          ))}
          {ohneKunde > 0 && (
            <div className="flex items-center gap-4 py-2.5 text-mute">
              <div className="w-52 shrink-0 text-sm">Ohne Kunde</div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-inaktiv" style={{ width: `${Math.max(2, (ohneKunde / maxSekunden) * 100)}%` }} />
              </div>
              <div className="w-16 shrink-0 text-right text-sm tabular-nums">{stundenText(ohneKunde)} h</div>
              <div className="w-12 shrink-0 text-right text-xs tabular-nums">{gesamt ? Math.round((ohneKunde / gesamt) * 100) : 0} %</div>
              <div className="w-20 shrink-0" />
            </div>
          )}
        </div>
      )}
      {ohneZeit.length > 0 && (
        <p className="mt-3 text-xs text-dim">Ohne Zeit in diesem Zeitraum: {ohneZeit.join(', ')}</p>
      )}
    </div>
  )
}
