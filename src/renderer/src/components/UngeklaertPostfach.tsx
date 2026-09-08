import { useEffect, useState, type ReactElement } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Block } from '@shared/typen'
import { berlinDatum } from '@shared/zeit'
import { datumText } from '../format'
import { BlockZeile } from './BlockZeile'
import { Karte } from './Karte'

interface Props {
  anzahl: number
  /** Ändert sich, wenn die Liste neu geladen werden soll */
  stand: number
  onOeffnen: (block: Block) => void
  onDurchgehen: (bloecke: Block[]) => void
}

/** Das Ungeklärt-Postfach auf dem Heute-Screen: Anzahl, aufklappbare Liste, Durchgehen. */
export function UngeklaertPostfach({ anzahl, stand, onOeffnen, onDurchgehen }: Props): ReactElement | null {
  const [offen, setOffen] = useState(false)
  const [liste, setListe] = useState<Block[]>([])

  useEffect(() => {
    if (!offen || !window.api) return
    void window.api.bloecke.ungeklaerteListe().then(setListe)
  }, [offen, stand])

  if (anzahl === 0) return null

  async function durchgehen(): Promise<void> {
    if (!window.api) return
    onDurchgehen(await window.api.bloecke.ungeklaerteListe())
  }

  const gruppen: Array<{ datum: string; bloecke: Block[] }> = []
  for (const b of liste) {
    const datum = berlinDatum(new Date(b.start))
    const letzte = gruppen[gruppen.length - 1]
    if (letzte && letzte.datum === datum) letzte.bloecke.push(b)
    else gruppen.push({ datum, bloecke: [b] })
  }

  return (
    <Karte>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setOffen((o) => !o)} className="flex items-center gap-3 text-left">
          <span className="inline-block h-2 w-2 rounded-full border border-ungeklaert" />
          <span className="text-sm">
            {anzahl} {anzahl === 1 ? 'Block' : 'Blöcke'} noch nicht eingeordnet
          </span>
          {offen ? <ChevronUp size={16} className="text-mute" /> : <ChevronDown size={16} className="text-mute" />}
        </button>
        <button
          type="button"
          onClick={durchgehen}
          className="rounded-chip bg-panel-2 px-3 py-1.5 text-sm text-ink transition-colors hover:bg-inaktiv"
        >
          Durchgehen
        </button>
      </div>
      {offen && (
        <div className="mt-3">
          {gruppen.map((g) => (
            <div key={g.datum}>
              <p className="mt-3 text-xs tracking-wide text-mute uppercase">{datumText(g.datum)}</p>
              <div className="divide-y divide-panel-2">
                {g.bloecke.map((b) => (
                  <BlockZeile key={b.id} block={b} onClick={() => onOeffnen(b)} />
                ))}
              </div>
            </div>
          ))}
          {liste.length >= 300 && <p className="mt-3 text-xs text-dim">Nur die neuesten 300 werden angezeigt.</p>}
        </div>
      )}
    </Karte>
  )
}
