import { useEffect, useState, type ReactElement } from 'react'
import { X } from 'lucide-react'
import type { UpdateStatus } from '@shared/typen'

/**
 * Die Leiste über der Navigation, wenn eine neue Version bereitliegt: unter Windows ist sie schon
 * geladen und wird mit einem Klick eingespielt, auf dem Mac öffnet der Klick die Download-Seite.
 * Lässt sich für die laufende Sitzung wegklicken.
 */
export function UpdateHinweis(): ReactElement | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [weggeklickt, setWeggeklickt] = useState<string | null>(null)

  useEffect(() => {
    if (!window.api?.update) return
    void window.api.update.status().then(setStatus)
    return window.api.update.onStatus(setStatus)
  }, [])

  if (!status || !status.neueVersion || weggeklickt === status.neueVersion) return null
  if (status.zustand !== 'bereit' && status.zustand !== 'verfuegbar') return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-6">
      <div className="glas animate-einblenden pointer-events-auto flex items-center gap-3 rounded-card py-2 pr-2 pl-4 text-sm">
        <span>
          Version {status.neueVersion} {status.zustand === 'bereit' ? 'ist geladen und wird beim Neustart eingespielt.' : 'ist da.'}
        </span>
        <button
          type="button"
          onClick={() => void window.api.update.installieren()}
          className="rounded-chip bg-ink px-3 py-1.5 text-xs text-ground transition-colors hover:bg-white"
        >
          {status.zustand === 'bereit' ? 'Jetzt neu starten' : 'Download öffnen'}
        </button>
        <button type="button" onClick={() => setWeggeklickt(status.neueVersion)} className="rounded-chip p-1.5 text-mute hover:text-ink" title="Später">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
