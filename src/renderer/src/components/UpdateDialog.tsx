import { useEffect, useState, type ReactElement } from 'react'
import { Download, Sparkles } from 'lucide-react'
import type { UpdateStatus } from '@shared/typen'
import { Portal } from './Portal'
import { tonSpielen } from '../toene'

/**
 * Das Update-Fenster (22. September 2026, Auftraggeber: "sobald wir veröffentlichen, soll es bei Filipo und Leon direkt
 * aufploppen, damit sie sofort updaten und danach sehen, was neu ist"): erscheint mitten in der App, sobald eine neue
 * Version geladen ist (Windows und Mac mit Selbst-Einspielen) bzw. gefunden wurde (Mac ohne), mit der Liste der
 * Neuerungen und dem großen Knopf "Jetzt aktualisieren". "Später" schließt es für diese Sitzung, die Leiste über der
 * Navigation bleibt. Nach dem Neustart zeigt NeuigkeitenDialog die Änderungen der neuen Version noch einmal.
 */
export function UpdateDialog(): ReactElement | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [spaeter, setSpaeter] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    if (!window.api?.update) return
    void window.api.update.status().then(setStatus)
    return window.api.update.onStatus(setStatus)
  }, [])

  const zeigen =
    !!status &&
    !!status.neueVersion &&
    spaeter !== status.neueVersion &&
    (status.zustand === 'bereit' || (status.zustand === 'verfuegbar' && !status.selbstInstallierend))

  useEffect(() => {
    if (zeigen) tonSpielen('oeffnen')
  }, [zeigen])

  if (!zeigen || !status) return null

  const punkte = (status.neuigkeiten ?? '')
    .split('\n')
    .map((z) => z.replace(/^-\s*/, '').trim())
    .filter(Boolean)
  const selbst = status.zustand === 'bereit'

  function aktualisieren(): void {
    if (!window.api || laeuft) return
    setLaeuft(true)
    void window.api.update.installieren()
  }

  return (
    <Portal>
      <div className="animate-aufblenden fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
        <div className="animate-einblenden max-h-[calc(100vh-3rem)] w-full max-w-[520px] overscroll-contain overflow-y-auto rounded-card bg-panel p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-produktiv/20 text-produktiv">
              <Sparkles size={22} strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-xl">Version {status.neueVersion} ist da</h2>
              <p className="text-sm text-mute">
                {selbst ? 'Schon geladen. Ein Klick, die App startet neu und alles Neue ist drin.' : 'Zum Einspielen die Download-Seite öffnen und die App in den Ordner Programme ziehen.'}
              </p>
            </div>
          </div>

          {punkte.length > 0 && (
            <div className="mt-5">
              <p className="text-xs tracking-wide text-mute uppercase">Das ist neu</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {punkte.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-produktiv" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setSpaeter(status.neueVersion)} className="rounded-chip bg-panel-2 px-4 py-2 text-sm text-ink transition-colors hover:bg-inaktiv">
              Später
            </button>
            <button type="button" onClick={aktualisieren} disabled={laeuft} className="knopf-primaer flex items-center gap-2 rounded-chip px-4 py-2 text-sm disabled:opacity-50">
              <Download size={16} strokeWidth={2} />
              {laeuft ? 'Wird eingespielt …' : selbst ? 'Jetzt aktualisieren und neu starten' : 'Download öffnen'}
            </button>
          </div>
          <p className="mt-3 text-xs text-dim">Dein laufender Fokus bleibt beim Neustart erhalten.</p>
        </div>
      </div>
    </Portal>
  )
}
