import { memo, type ReactElement } from 'react'
import { Check } from 'lucide-react'
import type { Block } from '@shared/typen'
import { anzeigeName } from '@shared/fenster'
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
  /** Mehrere zusammenhängende Abschnitte desselben Programms in einer Zeile (Anzahl > 1 zeigt einen Chip) */
  abschnitte?: number
  /** Dauer in Sekunden, falls sie nicht der Spanne start–ende entspricht (Summe der Abschnitte) */
  sekunden?: number
}

/** Eine Zeile in der Blockliste: Zeit, Dauer, Programm, Tätigkeit, farbige Bewertung. */
function BlockZeileInnen({
  block,
  laeuft = false,
  onClick,
  auswahlModus = false,
  ausgewaehlt = false,
  abschnitte = 1,
  sekunden: sekundenVorgabe
}: Props): ReactElement {
  const sekunden = sekundenVorgabe ?? (Date.parse(block.ende) - Date.parse(block.start)) / 1000
  // Im Browser steht die Seite vorne ("YouTube"), der Browser als Chip daneben.
  const fenster = anzeigeName(block.programm, block.fenstertitel)
  const hauptzeile =
    block.bewertung === 'inaktiv'
      ? 'Inaktiv'
      : block.quelle === 'manuell'
        ? (block.taetigkeit ?? 'Von Hand eingetragen')
        : fenster.haupt
  const klickbar = !!onClick && !laeuft

  return (
    <div
      onClick={klickbar ? onClick : undefined}
      className={`flex items-center gap-4 rounded-chip px-2 py-3 -mx-2 ${klickbar ? 'druckbar cursor-pointer transition-colors hover:bg-panel-2/50' : ''} ${
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
          {fenster.neben && block.quelle === 'auto' && (
            <span className="shrink-0 rounded-chip bg-panel-2 px-1.5 py-0.5 text-xs text-mute">{fenster.neben}</span>
          )}
          {abschnitte > 1 && (
            <span className="shrink-0 rounded-chip bg-panel-2 px-1.5 py-0.5 text-xs text-mute" title="Mehrere Blöcke desselben Programms direkt hintereinander, zusammen angezeigt">
              {abschnitte} Abschnitte
            </span>
          )}
          {block.taetigkeit && block.quelle === 'auto' && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-mute">
              · <TaetigkeitSymbol name={block.taetigkeit} groesse={12} /> {block.taetigkeit}
            </span>
          )}
          {block.manuellGeprueft && block.quelle === 'auto' && (
            <Check size={12} strokeWidth={2} className="shrink-0 text-dim" aria-label="von Hand geprüft" />
          )}
        </div>
        {block.fenstertitel && (
          <div className="truncate text-xs text-dim" title={block.fenstertitel}>
            {fenster.titel || block.fenstertitel}
          </div>
        )}
        {block.notiz && <div className="truncate text-xs text-dim">{block.notiz}</div>}
      </div>
      <div className="w-20 shrink-0 text-right text-sm text-mute">{dauerText(sekunden)}</div>
      <div className="flex w-24 shrink-0 items-center justify-end gap-2 text-xs text-mute">
        <span className={`inline-block h-2 w-2 rounded-full ${PUNKT[block.bewertung]}`} />
        {BEWERTUNG[block.bewertung]}
      </div>
    </div>
  )
}

/**
 * Gemerkt, damit lange Listen (Heute-Screen) nicht bei jedem Tick des Bildschirms neu gerendert werden.
 * Die Klick-Funktion zählt bewusst nicht mit: Aufrufer geben ihr eine stabile Funktion (siehe HeuteScreen).
 */
export const BlockZeile = memo(
  BlockZeileInnen,
  (a, b) =>
    a.block === b.block &&
    a.laeuft === b.laeuft &&
    a.auswahlModus === b.auswahlModus &&
    a.ausgewaehlt === b.ausgewaehlt &&
    a.abschnitte === b.abschnitte &&
    a.sekunden === b.sekunden &&
    !!a.onClick === !!b.onClick
)
