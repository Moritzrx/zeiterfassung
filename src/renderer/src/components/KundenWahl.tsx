import { useState, type ReactElement } from 'react'
import { Building2, Plus } from 'lucide-react'

const FELD =
  'w-full rounded-chip bg-panel-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim'

/** Vergleich von Namen wie beim Speichern: ohne Groß/Klein, Leerzeichen und Bindestriche. */
const schluessel = (name: string): string => name.toLowerCase().replace(/[\s-]/g, '')

/**
 * Kunde (oder Projekt) wählen, als zweite Dimension neben der Tätigkeit (11. September 2026): alle bekannten
 * Kunden als Chips, "Kein Kunde" und ein Feld für einen neuen Namen. Wird im Block-Dialog, im Fokus, bei
 * "Ich bin weg" und beim Eintragen benutzt. Leerer Wert = kein Kunde.
 */
export function KundenWahl({
  wert,
  onChange,
  kunden,
  kompakt = false
}: {
  wert: string
  onChange: (kunde: string) => void
  kunden: string[]
  /** Kleinere Chips (im Block-Dialog) */
  kompakt?: boolean
}): ReactElement {
  const [neuOffen, setNeuOffen] = useState(false)
  const passtZuChip = kunden.some((k) => schluessel(k) === schluessel(wert))
  const feldSichtbar = neuOffen || (wert.trim() !== '' && !passtZuChip)
  const chip = `flex items-center gap-1.5 rounded-chip transition-colors ${kompakt ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`
  return (
    <div>
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onChange('')
            setNeuOffen(false)
          }}
          className={`${chip} ${wert.trim() === '' ? 'bg-ink text-ground' : 'bg-panel-2 text-mute hover:bg-inaktiv hover:text-ink'}`}
        >
          Kein Kunde
        </button>
        {kunden.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              onChange(k)
              setNeuOffen(false)
            }}
            className={`${chip} ${schluessel(wert) === schluessel(k) ? 'bg-ink text-ground' : 'bg-panel-2 text-ink hover:bg-inaktiv'}`}
          >
            <Building2 size={kompakt ? 12 : 14} strokeWidth={1.5} />
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            onChange('')
            setNeuOffen(true)
          }}
          className={`${chip} border border-dashed ${feldSichtbar ? 'border-ink text-ink' : 'border-mute text-mute hover:border-ink hover:text-ink'}`}
        >
          <Plus size={kompakt ? 12 : 14} strokeWidth={1.5} />
          Neuer Kunde
        </button>
      </div>
      {feldSichtbar && (
        <input
          className={`${FELD} mt-2`}
          value={wert}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Neuer Kunde oder Projekt, z. B. Bäckerei Müller"
          autoFocus
        />
      )}
    </div>
  )
}
