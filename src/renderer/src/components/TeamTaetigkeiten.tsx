import { useMemo, useState, type ReactElement } from 'react'
import { Building2 } from 'lucide-react'
import type { TeamAktuell, TeamTaetigkeit } from '@shared/typen'
import { stundenText, uhrzeit } from '../format'
import { TaetigkeitSymbol } from '../symbole'
import { Karte } from './Karte'

/** So lange nach dem Ende des jüngsten Blocks gilt eine Person noch als "gerade dabei" (Blöcke werden alle 60 s gemeldet). */
const GERADE_MS = 3 * 60_000
const MAX_ZEILEN = 8

interface Person {
  userId: string
  name: string
  istIch: boolean
}

function initialen(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * "Was die anderen machen" (15. September 2026, Wunsch des Auftraggebers): je Person der aktuelle Stand
 * ("Gerade: Konzept seit 09:12") und die produktiven Stunden je Tätigkeit, heute oder diese Woche, mit Kunde
 * als Chip. Nur Summen und Tätigkeitsnamen, keine Programme oder Fenstertitel.
 */
export function TeamTaetigkeiten({
  personen,
  heute,
  woche,
  aktuell,
  fehler
}: {
  personen: Person[]
  heute: TeamTaetigkeit[]
  woche: TeamTaetigkeit[]
  aktuell: TeamAktuell[]
  fehler: string | null
}): ReactElement {
  const [zeitraum, setZeitraum] = useState<'heute' | 'woche'>('heute')
  const zeilen = zeitraum === 'heute' ? heute : woche
  const jetzt = Date.now()

  const jePerson = useMemo(() => {
    const karte = new Map<string, TeamTaetigkeit[]>()
    for (const z of zeilen) {
      const l = karte.get(z.userId) ?? []
      l.push(z)
      karte.set(z.userId, l)
    }
    for (const l of karte.values()) l.sort((a, b) => b.produktiveSekunden - a.produktiveSekunden)
    return karte
  }, [zeilen])

  return (
    <Karte>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs tracking-wide text-mute uppercase">Was die anderen machen</p>
        <div className="flex gap-1 rounded-chip bg-panel-2 p-1">
          {(
            [
              ['heute', 'Heute'],
              ['woche', 'Diese Woche']
            ] as const
          ).map(([wert, label]) => (
            <button
              key={wert}
              type="button"
              onClick={() => setZeitraum(wert)}
              className={`rounded-chip px-3 py-1 text-xs transition-colors ${zeitraum === wert ? 'bg-ink text-ground' : 'text-mute hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {fehler ? (
        <p className="mt-3 text-sm text-mute">{fehler}</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {personen.map((p) => {
            const liste = jePerson.get(p.userId) ?? []
            const gesamt = liste.reduce((s, z) => s + z.produktiveSekunden, 0)
            const max = liste[0]?.produktiveSekunden ?? 1
            const a = aktuell.find((x) => x.userId === p.userId)
            const dabei = a && jetzt - Date.parse(a.ende) < GERADE_MS
            return (
              <div key={p.userId} className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${p.istIch ? 'bg-produktiv text-ground' : 'bg-panel-2 text-ink'}`}>
                    {initialen(p.name)}
                  </span>
                  <span className="truncate text-sm">{p.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-mute">{stundenText(gesamt)} h</span>
                </div>
                <p className="mt-1.5 flex min-h-4 items-center gap-1.5 text-xs">
                  {a && dabei ? (
                    <>
                      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${a.bewertung === 'produktiv' ? 'bg-produktiv' : a.bewertung === 'unproduktiv' ? 'bg-unproduktiv' : 'bg-dim'}`} />
                      <span className="truncate text-ink">
                        Gerade: {a.taetigkeit ?? (a.bewertung === 'unproduktiv' ? 'Nicht am Rechner' : 'ohne Tätigkeit')} seit {uhrzeit(a.start)}
                      </span>
                    </>
                  ) : a ? (
                    <span className="truncate text-dim">Zuletzt {a.taetigkeit ?? 'ohne Tätigkeit'} bis {uhrzeit(a.ende)}</span>
                  ) : (
                    <span className="text-dim">Heute noch nichts gemeldet</span>
                  )}
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {liste.length === 0 && <p className="text-xs text-dim">{zeitraum === 'heute' ? 'Heute noch keine produktive Zeit.' : 'Diese Woche noch keine produktive Zeit.'}</p>}
                  {liste.slice(0, MAX_ZEILEN).map((z) => (
                    <div key={`${z.taetigkeit ?? ''}|${z.kunde ?? ''}`}>
                      <div className="flex items-center gap-1.5 text-sm">
                        {z.taetigkeit ? <TaetigkeitSymbol name={z.taetigkeit} groesse={13} /> : null}
                        <span className="truncate">{z.taetigkeit ?? 'Ohne Tätigkeit'}</span>
                        {z.kunde && (
                          <span className="flex shrink-0 items-center gap-1 rounded-chip bg-panel-2 px-1.5 py-0.5 text-[11px] text-mute">
                            <Building2 size={10} strokeWidth={1.75} />
                            {z.kunde}
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-xs tabular-nums text-mute">{stundenText(z.produktiveSekunden)} h</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-panel-2">
                        <div className={`h-full rounded-full ${p.istIch ? 'bg-produktiv' : 'bg-ink/70'}`} style={{ width: `${Math.max(3, (z.produktiveSekunden / max) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                  {liste.length > MAX_ZEILEN && <p className="text-xs text-dim">und {liste.length - MAX_ZEILEN} weitere</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Karte>
  )
}
