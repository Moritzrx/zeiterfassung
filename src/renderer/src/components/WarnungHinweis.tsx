import { useState, type ReactElement } from 'react'
import { TriangleAlert } from 'lucide-react'
import { useErfassung } from '../erfassung'

/**
 * Die rote Leiste des Wachhunds (15. September 2026): Erfassung, Speichern oder Abgleich haken. Sitzt wie die
 * Update-Leiste zwischen Inhalt und Navigation. "App neu starten" startet die App komplett neu; "Später" blendet die
 * Leiste aus, bis sich der Text ändert.
 */
export function WarnungHinweis(): ReactElement | null {
  const status = useErfassung()
  const [weggeklickt, setWeggeklickt] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  if (!status.warnung || weggeklickt === status.warnung) return null

  return (
    <div className="flex shrink-0 justify-center px-6 pb-2">
      <div className="glas animate-einblenden flex max-w-[800px] items-center gap-3 rounded-card py-2 pr-2 pl-4 text-sm">
        <TriangleAlert size={18} strokeWidth={1.5} className="shrink-0 text-unproduktiv" />
        <span>
          <span className="text-unproduktiv">Die App hakt.</span> {status.warnung} Ein Neustart behebt das meistens.
        </span>
        <button
          type="button"
          disabled={laeuft}
          onClick={() => {
            setLaeuft(true)
            void window.api.system.neustart()
          }}
          className="shrink-0 rounded-chip bg-ink px-3 py-1.5 text-xs text-ground transition-colors hover:bg-white disabled:opacity-60"
        >
          App neu starten
        </button>
        <button type="button" onClick={() => setWeggeklickt(status.warnung)} className="shrink-0 rounded-chip px-2 py-1.5 text-xs text-mute hover:text-ink" title="Später">
          Später
        </button>
      </div>
    </div>
  )
}
