import { useState, type ReactElement } from 'react'
import type { Bewertung } from '@shared/typen'

interface Props {
  anzahl: number
  programm: string | null
  taetigkeiten: string[]
  onTaetigkeit: (name: string) => void
  onBewertung: (bewertung: Bewertung) => void
  onLoeschen: () => void
  onAlleMitProgramm: () => void
  /** Alle Blöcke zwischen dem frühesten und dem spätesten ausgewählten dazunehmen (ab 2 ausgewählten) */
  onAlleDazwischen?: () => void
  onFertig: () => void
}

const FELD =
  'rounded-chip bg-panel-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim'

/** Leiste unten, wenn mehrere Blöcke ausgewählt sind. */
export function Mehrfachleiste({
  anzahl,
  programm,
  taetigkeiten,
  onTaetigkeit,
  onBewertung,
  onLoeschen,
  onAlleMitProgramm,
  onAlleDazwischen,
  onFertig
}: Props): ReactElement {
  const [name, setName] = useState('')
  const [bestaetigen, setBestaetigen] = useState(false)

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 flex justify-center px-6">
      <div className="flex w-full max-w-[800px] flex-wrap items-center gap-2 rounded-card bg-panel-2 p-3 text-sm">
        <span className="mr-2 text-mute">{anzahl} ausgewählt</span>
        <input
          className={`${FELD} w-40`}
          list="taetigkeiten-mehrfach"
          placeholder="Tätigkeit"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              onTaetigkeit(name.trim())
              setName('')
            }
          }}
        />
        <datalist id="taetigkeiten-mehrfach">
          {taetigkeiten.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button
          type="button"
          disabled={!name.trim() || anzahl === 0}
          onClick={() => {
            onTaetigkeit(name.trim())
            setName('')
          }}
          className="rounded-chip px-3 py-1.5 text-ink hover:bg-inaktiv disabled:text-dim"
        >
          Setzen
        </button>
        <span className="mx-1 h-5 w-px bg-inaktiv" />
        <button type="button" disabled={anzahl === 0} onClick={() => onBewertung('produktiv')} className="flex items-center gap-2 rounded-chip px-3 py-1.5 hover:bg-inaktiv disabled:text-dim">
          <span className="inline-block h-2 w-2 rounded-full bg-produktiv" />
          produktiv
        </button>
        <button type="button" disabled={anzahl === 0} onClick={() => onBewertung('unproduktiv')} className="flex items-center gap-2 rounded-chip px-3 py-1.5 hover:bg-inaktiv disabled:text-dim">
          <span className="inline-block h-2 w-2 rounded-full bg-unproduktiv" />
          unproduktiv
        </button>
        <button
          type="button"
          disabled={anzahl === 0}
          onClick={() => {
            if (!bestaetigen) {
              setBestaetigen(true)
              return
            }
            setBestaetigen(false)
            onLoeschen()
          }}
          className={`rounded-chip px-3 py-1.5 disabled:text-dim ${bestaetigen ? 'bg-unproduktiv text-ink' : 'text-unproduktiv hover:bg-inaktiv'}`}
        >
          {bestaetigen ? 'Wirklich löschen?' : 'Löschen'}
        </button>
        {onAlleDazwischen && anzahl >= 2 && (
          <button
            type="button"
            onClick={onAlleDazwischen}
            className="rounded-chip px-3 py-1.5 text-mute hover:bg-inaktiv hover:text-ink"
            title="Alle Blöcke zwischen dem ersten und dem letzten ausgewählten dazunehmen"
          >
            Alles dazwischen
          </button>
        )}
        {programm && (
          <button type="button" onClick={onAlleMitProgramm} className="rounded-chip px-3 py-1.5 text-mute hover:bg-inaktiv hover:text-ink">
            Alle mit „{programm}“ diese Woche
          </button>
        )}
        <button type="button" onClick={onFertig} className="ml-auto rounded-chip bg-ink px-3 py-1.5 text-ground">
          Fertig
        </button>
      </div>
    </div>
  )
}
