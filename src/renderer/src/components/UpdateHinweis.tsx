import { useEffect, useState, type ReactElement } from 'react'
import { X } from 'lucide-react'
import type { UpdateStatus } from '@shared/typen'

/**
 * Die Leiste über der Navigation, wenn eine neue Version bereitliegt: unter Windows ist sie schon
 * geladen und wird mit einem Klick eingespielt, auf dem Mac öffnet der Klick die Download-Seite.
 * Sitzt im Seitenaufbau zwischen Inhalt und Navigation (nicht schwebend), damit sie nichts verdeckt.
 * Lässt sich für die laufende Sitzung wegklicken.
 */
export function UpdateHinweis(): ReactElement | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [weggeklickt, setWeggeklickt] = useState<string | null>(null)
  const [offen, setOffen] = useState(false)

  useEffect(() => {
    if (!window.api?.update) return
    void window.api.update.status().then(setStatus)
    return window.api.update.onStatus(setStatus)
  }, [])

  if (!status || !status.neueVersion || weggeklickt === status.neueVersion) return null
  if (status.zustand !== 'bereit' && status.zustand !== 'installiert' && !(status.zustand === 'verfuegbar' && !status.selbstInstallierend)) return null

  // Was die neue Version bringt (aus der GitHub-Veröffentlichung), ausklappbar (15. September 2026).
  const punkte = (status.neuigkeiten ?? '')
    .split('\n')
    .map((z) => z.replace(/^-\s*/, '').trim())
    .filter(Boolean)

  return (
    <div className="flex shrink-0 justify-center px-6 pb-2">
      <div className="glas animate-einblenden flex max-w-[800px] flex-col gap-2 rounded-card py-2 pr-2 pl-4 text-sm">
        <div className="flex items-center gap-3">
          <span>
            Version {status.neueVersion}{' '}
            {status.zustand === 'installiert'
              ? 'wird eingespielt, die App startet gleich neu.'
              : status.zustand === 'bereit'
                ? 'ist geladen und wird beim Neustart eingespielt.'
                : 'ist da.'}
          </span>
          {punkte.length > 0 && (
            <button type="button" onClick={() => setOffen((o) => !o)} className="rounded-chip px-2 py-1 text-xs text-mute transition-colors hover:text-ink">
              {offen ? 'Weniger' : 'Was ist neu?'}
            </button>
          )}
          {status.zustand !== 'installiert' && (
            <button
              type="button"
              onClick={() => void window.api.update.installieren()}
              className="ml-auto shrink-0 rounded-chip bg-ink px-3 py-1.5 text-xs text-ground transition-colors hover:bg-white"
            >
              {status.zustand === 'bereit' ? 'Jetzt neu starten' : 'Download öffnen'}
            </button>
          )}
          <button type="button" onClick={() => setWeggeklickt(status.neueVersion)} className="shrink-0 rounded-chip p-1.5 text-mute hover:text-ink" title="Später">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        {offen && punkte.length > 0 && (
          <ul className="flex flex-col gap-1 pb-1 pr-2">
            {punkte.map((p, i) => (
              <li key={i} className="flex gap-2 text-xs text-mute">
                <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-produktiv" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
