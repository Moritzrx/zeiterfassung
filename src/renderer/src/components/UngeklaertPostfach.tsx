import { useEffect, useState, type ReactElement } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Block } from '@shared/typen'
import { dauerText } from '../format'
import { BlockZeile } from './BlockZeile'
import { Karte } from './Karte'

interface Props {
  anzahl: number
  /** Ändert sich, wenn die Liste neu geladen werden soll */
  stand: number
  onOeffnen: (block: Block) => void
  /** Alle Blöcke eines Programms auf einmal zuordnen */
  onGruppe: (bloecke: Block[]) => void
  onDurchgehen: (bloecke: Block[]) => void
}

interface Gruppe {
  programm: string
  bloecke: Block[]
  sekunden: number
}

function sekunden(b: Block): number {
  return (Date.parse(b.ende) - Date.parse(b.start)) / 1000
}

/**
 * Das Ungeklärt-Postfach auf dem Heute-Screen. Statt jeden Block einzeln anzufassen,
 * sind die Blöcke nach Programm gebündelt: eine Entscheidung je Programm erledigt alle.
 */
export function UngeklaertPostfach({ anzahl, stand, onOeffnen, onGruppe, onDurchgehen }: Props): ReactElement | null {
  const [liste, setListe] = useState<Block[]>([])
  const [offen, setOffen] = useState<string | null>(null)

  useEffect(() => {
    if (!window.api || anzahl === 0) return
    void window.api.bloecke.ungeklaerteListe().then(setListe)
  }, [anzahl, stand])

  if (anzahl === 0) return null

  const gruppen = new Map<string, Gruppe>()
  for (const b of liste) {
    const programm = b.programm ?? 'Unbekanntes Programm'
    const g = gruppen.get(programm) ?? { programm, bloecke: [], sekunden: 0 }
    g.bloecke.push(b)
    g.sekunden += sekunden(b)
    gruppen.set(programm, g)
  }
  const sortiert = [...gruppen.values()].sort((a, b) => b.sekunden - a.sekunden)

  return (
    <Karte>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full border border-ungeklaert" />
          <span className="text-sm">
            {anzahl} {anzahl === 1 ? 'Block' : 'Blöcke'} noch nicht eingeordnet
            {sortiert.length > 1 && <span className="text-mute"> · {sortiert.length} Programme</span>}
          </span>
        </div>
        <button type="button" onClick={() => onDurchgehen(liste)} className="text-xs text-mute transition-colors hover:text-ink">
          Einzeln durchgehen
        </button>
      </div>

      <div className="mt-3 divide-y divide-panel-2">
        {sortiert.map((g) => {
          const istOffen = offen === g.programm
          const titel = [...new Set(g.bloecke.map((b) => b.fenstertitel).filter(Boolean))]
          return (
            <div key={g.programm}>
              <div className="flex items-center gap-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setOffen(istOffen ? null : g.programm)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  title="Blöcke anzeigen"
                >
                  {istOffen ? <ChevronUp size={16} className="shrink-0 text-mute" /> : <ChevronDown size={16} className="shrink-0 text-mute" />}
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{g.programm}</span>
                    <span className="block truncate text-xs text-dim">
                      {g.bloecke.length} {g.bloecke.length === 1 ? 'Block' : 'Blöcke'} · {dauerText(g.sekunden)}
                      {titel.length > 0 && ` · ${titel.length} ${titel.length === 1 ? 'Fenster' : 'verschiedene Fenster'}`}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onGruppe(g.bloecke)}
                  className="shrink-0 rounded-chip bg-ink px-3 py-1.5 text-sm text-ground transition-colors hover:bg-white"
                >
                  {g.bloecke.length === 1 ? 'Zuordnen' : `Alle ${g.bloecke.length} zuordnen`}
                </button>
              </div>
              {istOffen && (
                <div className="mb-2 divide-y divide-panel-2 pl-7">
                  {g.bloecke.map((b) => (
                    <BlockZeile key={b.id} block={b} onClick={() => onOeffnen(b)} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {liste.length >= 300 && <p className="mt-3 text-xs text-dim">Nur die neuesten 300 werden berücksichtigt.</p>}
    </Karte>
  )
}
