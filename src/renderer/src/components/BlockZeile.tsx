import type { ReactElement } from 'react'
import { Check } from 'lucide-react'
import type { Block } from '@shared/typen'
import { dauerText, uhrzeit } from '../format'
import { TaetigkeitSymbol } from '../symbole'

const PUNKT: Record<Block['bewertung'], string> = {
  produktiv: 'bg-produktiv',
  unproduktiv: 'bg-unproduktiv',
  inaktiv: 'bg-inaktiv',
  ungeklaert: 'border border-ungeklaert'
}

const BEWERTUNG: Record<Block['bewertung'], string> = {
  produktiv: 'produktiv',
  unproduktiv: 'unproduktiv',
  inaktiv: 'inaktiv',
  ungeklaert: 'ungeklärt'
}

interface Props {
  block: Block
  laeuft?: boolean
  onClick?: () => void
  /** Mehrfachauswahl: Kästchen anzeigen */
  auswahlModus?: boolean
  ausgewaehlt?: boolean
}

/** Eine Zeile in der Blockliste: Zeit, Dauer, Programm, Tätigkeit, farbige Bewertung. */
export function BlockZeile({ block, laeuft = false, onClick, auswahlModus = false, ausgewaehlt = false }: Props): ReactElement {
  const sekunden = (Date.parse(block.ende) - Date.parse(block.start)) / 1000
  const hauptzeile =
    block.bewertung === 'inaktiv'
      ? 'Inaktiv'
      : block.quelle === 'manuell'
        ? (block.taetigkeit ?? 'Von Hand eingetragen')
        : (block.programm ?? 'Unbekanntes Programm')
  const klickbar = !!onClick && !laeuft

  return (
    <div
      onClick={klickbar ? onClick : undefined}
      className={`flex items-center gap-4 py-3 ${klickbar ? 'cursor-pointer transition-colors hover:bg-panel-2/40' : ''} ${
        ausgewaehlt ? 'bg-panel-2/60' : ''
      }`}
    >
      {auswahlModus && (
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
            ausgewaehlt ? 'border-ink bg-ink text-ground' : 'border-dim'
          }`}
        >
          {ausgewaehlt && <Check size={11} strokeWidth={3} />}
        </span>
      )}
      <div className="w-24 shrink-0 text-sm text-mute">
        {uhrzeit(block.start)} – {laeuft ? 'jetzt' : uhrzeit(block.ende)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {block.taetigkeit && block.quelle === 'manuell' && <TaetigkeitSymbol name={block.taetigkeit} groesse={14} />}
          <span className="truncate text-sm">{hauptzeile}</span>
          {block.taetigkeit && block.quelle === 'auto' && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-mute">
              · <TaetigkeitSymbol name={block.taetigkeit} groesse={12} /> {block.taetigkeit}
            </span>
          )}
          {block.manuellGeprueft && block.quelle === 'auto' && (
            <Check size={12} strokeWidth={2} className="shrink-0 text-dim" aria-label="von Hand geprüft" />
          )}
        </div>
        {block.fenstertitel && <div className="truncate text-xs text-dim">{block.fenstertitel}</div>}
        {block.notiz && <div className="truncate text-xs text-dim">{block.notiz}</div>}
      </div>
      <div className="w-16 shrink-0 text-right text-sm text-mute">{dauerText(sekunden)}</div>
      <div className="flex w-24 shrink-0 items-center justify-end gap-2 text-xs text-mute">
        <span className={`inline-block h-2 w-2 rounded-full ${PUNKT[block.bewertung]}`} />
        {BEWERTUNG[block.bewertung]}
      </div>
    </div>
  )
}
