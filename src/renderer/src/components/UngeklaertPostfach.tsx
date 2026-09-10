import { useEffect, useState, type ReactElement } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { seiteVon } from '@shared/fenster'
import type { Block } from '@shared/typen'
import { dauerText } from '../format'
import { BlockZeile } from './BlockZeile'
import { Karte } from './Karte'

interface Props {
  anzahl: number
  /** Ändert sich, wenn die Liste neu geladen werden soll */
  stand: number
  onOeffnen: (block: Block) => void
  /** Alle Blöcke einer Gruppe auf einmal zuordnen; muster = erkannte Seite (für eine Titel-Regel) */
  onGruppe: (bloecke: Block[], muster: string | null) => void
  onDurchgehen: (bloecke: Block[]) => void
}

interface Gruppe {
  schluessel: string
  programm: string
  /** erkannte Seite im Browser, z. B. "YouTube" */
  seite: string | null
  bloecke: Block[]
  sekunden: number
}

function sekunden(b: Block): number {
  return (Date.parse(b.ende) - Date.parse(b.start)) / 1000
}

/**
 * Das Ungeklärt-Postfach auf dem Heute-Screen. Die Blöcke sind nach Programm gebündelt,
 * im Browser zusätzlich nach Seite (YouTube, Google Sheets ...): eine Entscheidung je Gruppe erledigt alle.
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
    const seite = seiteVon(b.programm, b.fenstertitel)
    const schluessel = seite ? `${programm} · ${seite}` : programm
    const g = gruppen.get(schluessel) ?? { schluessel, programm, seite, bloecke: [], sekunden: 0 }
    g.bloecke.push(b)
    g.sekunden += sekunden(b)
    gruppen.set(schluessel, g)
  }
  const sortiert = [...gruppen.values()].sort((a, b) => b.sekunden - a.sekunden)

  return (
    <Karte>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full border border-ungeklaert" />
          <span className="text-sm">
            {anzahl} {anzahl === 1 ? 'Block' : 'Blöcke'} noch nicht eingeordnet
            {sortiert.length > 1 && <span className="text-mute"> · {sortiert.length} Gruppen</span>}
          </span>
        </div>
        <button type="button" onClick={() => onDurchgehen(liste)} className="knopf-primaer rounded-chip px-3 py-1.5 text-xs">
          Einzeln durchgehen
        </button>
      </div>

      <div className="mt-3 divide-y divide-panel-2">
        {sortiert.map((g) => {
          const istOffen = offen === g.schluessel
          const titel = [...new Set(g.bloecke.map((b) => b.fenstertitel).filter(Boolean))]
          return (
            <div key={g.schluessel}>
              <div className="flex items-center gap-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setOffen(istOffen ? null : g.schluessel)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  title="Blöcke anzeigen"
                >
                  {istOffen ? <ChevronUp size={16} className="shrink-0 text-mute" /> : <ChevronDown size={16} className="shrink-0 text-mute" />}
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm">
                      <span className="truncate">{g.programm}</span>
                      {g.seite && <span className="shrink-0 rounded-chip bg-panel-2 px-1.5 py-0.5 text-xs text-mute">{g.seite}</span>}
                    </span>
                    <span className="block truncate text-xs text-dim">
                      {g.bloecke.length} {g.bloecke.length === 1 ? 'Block' : 'Blöcke'} · {dauerText(g.sekunden)}
                      {titel.length > 1 && ` · ${titel.length} verschiedene Tabs`}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onGruppe(g.bloecke, g.seite)}
                  className="knopf-primaer shrink-0 rounded-chip px-3 py-1.5 text-sm"
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
