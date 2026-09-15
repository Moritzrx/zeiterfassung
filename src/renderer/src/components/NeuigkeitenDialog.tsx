import { useEffect, useState, type ReactElement } from 'react'
import { Sparkles, X } from 'lucide-react'
import { AENDERUNGEN, neueAenderungen, versionNeuer, type Aenderung } from '@shared/aenderungen'
import { kurzDatum } from '../format'
import { tonSpielen } from '../toene'
import { Portal } from './Portal'

const GESEHEN_SCHLUESSEL = 'version.gesehen'
const EREIGNIS = 'neuigkeiten-dialog'

/** Öffnet die Änderungsliste von Hand (Einstellungen → System → "Was ist neu"). */
export function neuigkeitenZeigen(): void {
  window.dispatchEvent(new CustomEvent(EREIGNIS))
}

function gesehen(): string | null {
  try {
    return localStorage.getItem(GESEHEN_SCHLUESSEL)
  } catch {
    return null
  }
}

function merken(version: string): void {
  try {
    localStorage.setItem(GESEHEN_SCHLUESSEL, version)
  } catch {
    // Merken ist optional
  }
}

/**
 * Update-News (15. September 2026, "die Jungs sollen nach einem Update sehen, was es alles beinhaltet"): Beim ersten
 * Start einer neuen Version erscheint einmal ein Fenster mit allen Einträgen seit der zuletzt gesehenen Version
 * (aus aenderungen.json; wer Versionen überspringt, sieht alle dazwischen). Danach ist die Version gemerkt
 * (localStorage `version.gesehen`). Von Hand jederzeit über neuigkeitenZeigen() (dann die letzten Einträge).
 */
export function NeuigkeitenHalter(): ReactElement | null {
  const [eintraege, setEintraege] = useState<Aenderung[] | null>(null)
  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    if (!window.api) return
    let aktiv = true
    void window.api.system.info().then((info) => {
      if (!aktiv) return
      setVersion(info.version)
      const zuletzt = gesehen()
      if (zuletzt === info.version) return
      const neu = neueAenderungen(info.version, zuletzt)
      if (neu.length === 0) {
        merken(info.version)
        return
      }
      setEintraege(neu)
      tonSpielen('oeffnen')
    })
    // Von Hand geöffnet: die letzten drei Einträge bis zur laufenden Version.
    const h = (): void => {
      const passend = version ? AENDERUNGEN.filter((a) => !versionNeuer(a.version, version)) : AENDERUNGEN
      setEintraege(passend.slice(0, 3))
    }
    window.addEventListener(EREIGNIS, h)
    return () => {
      aktiv = false
      window.removeEventListener(EREIGNIS, h)
    }
  }, [version])

  if (!eintraege) return null
  const schliessen = (): void => {
    if (version) merken(version)
    setEintraege(null)
  }
  return (
    <Portal>
      <div className="animate-aufblenden fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" onClick={schliessen}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="glas animate-einblenden max-h-[calc(100vh-3rem)] w-full max-w-[600px] overflow-y-auto overscroll-contain rounded-card p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl">
                <Sparkles size={20} strokeWidth={1.5} />
                {eintraege.length === 1 ? `Neu in Version ${eintraege[0].version}` : 'Was seit deinem letzten Update neu ist'}
              </h2>
              <p className="mt-1 text-sm text-mute">
                {eintraege.length === 1
                  ? 'Das Update ist eingespielt. Das hat sich geändert:'
                  : `${eintraege.length} Versionen, neueste zuerst. Das hat sich geändert:`}
              </p>
            </div>
            <button type="button" onClick={schliessen} className="rounded-chip p-1 text-mute hover:text-ink" title="Schließen">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-5">
            {eintraege.map((a) => (
              <div key={a.version}>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">Version {a.version}</span>
                  <span className="text-xs text-dim">{kurzDatum(a.datum)}</span>
                </div>
                <p className="mt-0.5 text-sm text-mute">{a.titel}</p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {a.punkte.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-produktiv" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button type="button" onClick={schliessen} className="knopf-primaer rounded-chip px-4 py-2 text-sm">
              Alles klar
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
