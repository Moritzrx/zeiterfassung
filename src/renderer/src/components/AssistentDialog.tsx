import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Send, X, Zap } from 'lucide-react'
import type { KiNachricht, KiStatus } from '@shared/typen'
import { fehlerText } from '../format'
import { tonSpielen } from '../toene'
import { Portal } from './Portal'

const EREIGNIS = 'assistent-dialog'

/** Der Name des KI-Assistenten in der App (16. September 2026, Auftraggeber wollte einen coolen Namen). */
export const ASSISTENT_NAME = 'Tempo'

/** Öffnet den KI-Assistenten von überall (Kopfzeile "Fragen"). */
export function assistentOeffnen(): void {
  window.dispatchEvent(new CustomEvent(EREIGNIS))
}

const VORSCHLAEGE = [
  'Wie trage ich einen Termin nach, den ich vergessen habe?',
  'Wie trage ich einen Kundentermin oder Dreh ein?',
  'Wie funktioniert die Liga?',
  'Warum zählt meine Zeit gerade nicht?'
]

const BEGRUESSUNG: KiNachricht = {
  rolle: 'assistent',
  text: 'Hi, ich bin Tempo. Ich kenne die App in- und auswendig und weiß, was ihr über wessamedia eingetragen habt. Frag mich, was du wissen willst.'
}

/** Hält den Dialog samt Gesprächsverlauf für die laufende Sitzung; sitzt einmal in App.tsx. */
export function AssistentHalter(): ReactElement | null {
  const [offen, setOffen] = useState(false)
  const [verlauf, setVerlauf] = useState<KiNachricht[]>([BEGRUESSUNG])
  useEffect(() => {
    const h = (): void => setOffen(true)
    window.addEventListener(EREIGNIS, h)
    return () => window.removeEventListener(EREIGNIS, h)
  }, [])
  if (!offen) return null
  return <AssistentDialog verlauf={verlauf} setVerlauf={setVerlauf} onSchliessen={() => setOffen(false)} />
}

interface Props {
  verlauf: KiNachricht[]
  setVerlauf: (v: KiNachricht[] | ((alt: KiNachricht[]) => KiNachricht[])) => void
  onSchliessen: () => void
}

/**
 * Tempo, der KI-Assistent (16. September 2026): ein Gespräch mit dem Modell, das die Anleitung und den aktuellen Stand der App
 * kennt. Antworten kommen aus dem Hintergrundprozess (api.ki.fragen), der Schlüssel liegt dort.
 */
function AssistentDialog({ verlauf, setVerlauf, onSchliessen }: Props): ReactElement {
  const [status, setStatus] = useState<KiStatus | null>(null)
  const [eingabe, setEingabe] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const ende = useRef<HTMLDivElement>(null)
  const feld = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!window.api) return
    void window.api.ki.status().then(setStatus)
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  useEffect(() => {
    ende.current?.scrollIntoView({ block: 'end' })
  }, [verlauf, laeuft])

  async function senden(text: string): Promise<void> {
    const frage = text.trim()
    if (!frage || laeuft || !window.api) return
    setFehler(null)
    setEingabe('')
    const neu: KiNachricht[] = [...verlauf, { rolle: 'nutzer', text: frage }]
    setVerlauf(neu)
    setLaeuft(true)
    try {
      // Die Begrüßung ist nur Anzeige, sie geht nicht mit.
      const antwort = await window.api.ki.fragen(neu.filter((n) => n !== BEGRUESSUNG))
      setVerlauf((alt) => [...alt, { rolle: 'assistent', text: antwort }])
      tonSpielen('erfolg')
    } catch (e) {
      setFehler(fehlerText(e))
    } finally {
      setLaeuft(false)
      feld.current?.focus()
    }
  }

  const eingerichtet = status?.eingerichtet ?? true

  return (
    <Portal>
      <div className="animate-aufblenden fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" onClick={onSchliessen}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="glas animate-einblenden flex h-[min(680px,calc(100vh-3rem))] w-full max-w-[640px] flex-col overflow-hidden rounded-card"
        >
          <div className="flex items-start justify-between gap-4 p-6 pb-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl">
                <Zap size={20} strokeWidth={1.5} className="text-produktiv" />
                {ASSISTENT_NAME}
              </h2>
              <p className="mt-1 text-sm text-mute">Dein Assistent für die App und für wessamedia. Kennt die ganze Anleitung, alle Spielregeln, das Team-Wissen und deinen aktuellen Stand, aber keine einzelnen Blöcke.</p>
            </div>
            <button type="button" onClick={onSchliessen} className="rounded-chip p-1 text-mute hover:text-ink" title="Schließen">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-6">
            {!eingerichtet && (
              <div className="mb-3 rounded-chip bg-panel-2 p-3 text-sm">
                <p>Tempo braucht einmalig einen Anthropic-Schlüssel.</p>
                <p className="mt-1 text-xs text-mute">Einstellungen → Tempo: dort steht, wie du ihn bekommst und wo du ihn einfügst. Danach kannst du hier fragen.</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {verlauf.map((n, i) => (
                <div key={i} className={`flex ${n.rolle === 'nutzer' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-card px-3.5 py-2.5 text-sm ${
                      n.rolle === 'nutzer' ? 'bg-produktiv/15 text-ink' : 'bg-panel-2 text-ink'
                    }`}
                  >
                    {n.text}
                  </div>
                </div>
              ))}
              {laeuft && (
                <div className="flex justify-start">
                  <div className="rounded-card bg-panel-2 px-3.5 py-2.5 text-sm text-mute">Denkt nach …</div>
                </div>
              )}
              {fehler && <p className="text-sm text-unproduktiv">{fehler}</p>}
            </div>
            {verlauf.length <= 1 && eingerichtet && (
              <div className="mt-4 flex flex-wrap gap-2">
                {VORSCHLAEGE.map((v) => (
                  <button key={v} type="button" onClick={() => void senden(v)} className="rounded-chip bg-panel-2 px-3 py-1.5 text-xs text-ink transition-colors hover:bg-inaktiv">
                    {v}
                  </button>
                ))}
              </div>
            )}
            <div ref={ende} className="h-4" />
          </div>

          <div className="flex items-end gap-2 p-4 pt-2">
            <textarea
              ref={feld}
              autoFocus
              rows={2}
              value={eingabe}
              disabled={!eingerichtet || laeuft}
              onChange={(e) => setEingabe(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void senden(eingabe)
                }
              }}
              placeholder={eingerichtet ? 'Deine Frage … (Enter sendet, Umschalt+Enter macht eine neue Zeile)' : 'Erst den Schlüssel unter Einstellungen → Tempo einfügen'}
              className="min-h-[44px] flex-1 resize-none rounded-chip bg-panel-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim disabled:opacity-60"
            />
            <button
              type="button"
              disabled={!eingerichtet || laeuft || !eingabe.trim()}
              onClick={() => void senden(eingabe)}
              className="knopf-primaer flex h-[44px] items-center gap-1.5 rounded-chip px-4 text-sm disabled:opacity-50"
              title="Senden"
            >
              <Send size={15} strokeWidth={2} />
              Senden
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
