import { useEffect, useState, type ReactElement } from 'react'
import { Sparkles } from 'lucide-react'
import type { KiStatus } from '@shared/typen'
import { fehlerText } from '../format'
import { tonSpielen } from '../toene'
import { assistentOeffnen } from './AssistentDialog'
import { hinweisZeigen } from './Hinweis'
import { Karte } from './Karte'

const FELD =
  'w-full rounded-chip bg-panel-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim'

/**
 * Einstellungen-Karte "KI-Assistent" (16. September 2026): erklärt, woher der Anthropic-Schlüssel kommt, nimmt ihn
 * entgegen (er wird verschlüsselt im Datenordner abgelegt, nie in der Datenbank) und zeigt den Stand.
 */
export function AssistentEinstellungen(): ReactElement {
  const [status, setStatus] = useState<KiStatus | null>(null)
  const [schluessel, setSchluessel] = useState('')
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    if (!window.api) return
    void window.api.ki.status().then(setStatus)
  }, [])

  async function speichern(): Promise<void> {
    if (!window.api || laeuft) return
    setLaeuft(true)
    try {
      const s = await window.api.ki.schluesselSetzen(schluessel)
      setStatus(s)
      setSchluessel('')
      tonSpielen('erfolg')
      hinweisZeigen('Schlüssel gespeichert. Oben rechts auf „Fragen“ klicken und loslegen.')
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    } finally {
      setLaeuft(false)
    }
  }

  async function entfernen(): Promise<void> {
    if (!window.api || laeuft) return
    setLaeuft(true)
    try {
      setStatus(await window.api.ki.schluesselEntfernen())
      hinweisZeigen('Schlüssel entfernt.')
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <Karte>
      <p className="flex items-center gap-2 text-xs tracking-wide text-mute uppercase">
        <Sparkles size={14} strokeWidth={1.5} />
        KI-Assistent
      </p>
      <p className="mt-1 text-xs text-dim">
        Oben rechts unter „Fragen“ beantwortet ein Claude-Modell alle Fragen zur App. Dafür braucht die App einen Anthropic-Schlüssel: auf
        console.anthropic.com anmelden, unter „API Keys“ einen Schlüssel anlegen, hier einfügen. Die Antworten kosten wenige Cent je Frage
        vom Guthaben dieses Kontos. Der Schlüssel bleibt verschlüsselt auf diesem Rechner.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        {status?.eingerichtet ? (
          <>
            <span className="text-sm text-produktiv">Eingerichtet, Modell {status.modell}</span>
            <button type="button" onClick={assistentOeffnen} className="knopf-primaer rounded-chip px-3 py-1.5 text-sm">
              Jetzt fragen
            </button>
            <button type="button" disabled={laeuft} onClick={() => void entfernen()} className="rounded-chip bg-panel-2 px-3 py-1.5 text-sm text-ink hover:bg-inaktiv disabled:opacity-40">
              Schlüssel entfernen
            </button>
          </>
        ) : (
          <>
            <input
              type="password"
              className={`${FELD} sm:max-w-[360px]`}
              placeholder="sk-ant-…"
              value={schluessel}
              autoComplete="off"
              onChange={(e) => setSchluessel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void speichern()
              }}
            />
            <button type="button" disabled={laeuft || !schluessel.trim()} onClick={() => void speichern()} className="knopf-primaer rounded-chip px-3 py-1.5 text-sm disabled:opacity-50">
              Speichern
            </button>
          </>
        )}
      </div>
    </Karte>
  )
}
