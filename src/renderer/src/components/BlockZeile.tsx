import type { ReactElement } from 'react'
import type { Block } from '@shared/typen'
import { dauerText, uhrzeit } from '../format'

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

/** Eine Zeile in der Blockliste: Zeit, Dauer, Programm, Tätigkeit, farbige Bewertung. */
export function BlockZeile({ block, laeuft = false }: { block: Block; laeuft?: boolean }): ReactElement {
  const sekunden = (Date.parse(block.ende) - Date.parse(block.start)) / 1000
  const hauptzeile =
    block.bewertung === 'inaktiv'
      ? 'Inaktiv'
      : block.quelle === 'manuell'
        ? (block.taetigkeit ?? 'Von Hand eingetragen')
        : (block.programm ?? 'Unbekanntes Programm')

  return (
    <div className="flex items-center gap-4 py-3">
      <div className="w-24 shrink-0 text-sm text-mute">
        {uhrzeit(block.start)} – {laeuft ? 'jetzt' : uhrzeit(block.ende)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm">{hauptzeile}</span>
          {block.taetigkeit && block.quelle === 'auto' && (
            <span className="shrink-0 text-xs text-mute">· {block.taetigkeit}</span>
          )}
          {block.manuellGeprueft && block.quelle === 'auto' && (
            <span className="shrink-0 text-xs text-dim" title="von Hand geprüft">
              ✓
            </span>
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
