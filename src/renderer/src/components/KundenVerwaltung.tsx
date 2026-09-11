import { useState, type ReactElement } from 'react'
import { Building2, Check, Pencil, Trash2, X } from 'lucide-react'
import { fehlerText } from '../format'
import { useKunden } from '../kunden'
import { tonSpielen } from '../toene'
import { hinweisZeigen } from './Hinweis'
import { Karte } from './Karte'

const FELD =
  'rounded-chip bg-panel-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim'

/**
 * Kundenverwaltung in den Einstellungen (11. September 2026): alle Kunden des Teams, umbenennen (heißt ein anderer
 * schon so, werden beide zusammengelegt) und löschen. Wirkt über die Datenbankfunktionen aus Skript 15 auf die
 * Blöcke aller Personen; die Kollegen sehen es nach ihrem nächsten Abgleich.
 */
export function KundenVerwaltung(): ReactElement {
  const kunden = useKunden()
  const [bearbeitet, setBearbeitet] = useState<string | null>(null)
  const [neu, setNeu] = useState('')
  const [loeschenFrage, setLoeschenFrage] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  async function umbenennen(alt: string): Promise<void> {
    const ziel = neu.trim()
    if (!ziel || ziel === alt || laeuft) return
    setLaeuft(true)
    try {
      const n = await window.api.kunden.umbenennen(alt, ziel)
      tonSpielen('erfolg')
      const zusammengelegt = kunden.some((k) => k !== alt && k.toLowerCase() === ziel.toLowerCase())
      hinweisZeigen(zusammengelegt ? `„${alt}“ und „${ziel}“ zusammengelegt, ${n} Blöcke umgestellt.` : `„${alt}“ heißt jetzt „${ziel}“, ${n} Blöcke umgestellt.`)
      setBearbeitet(null)
      setNeu('')
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    } finally {
      setLaeuft(false)
    }
  }

  async function loeschen(name: string): Promise<void> {
    if (laeuft) return
    setLaeuft(true)
    try {
      const n = await window.api.kunden.loeschen(name)
      tonSpielen('schliessen')
      hinweisZeigen(`„${name}“ gelöscht, ${n} Blöcke sind jetzt ohne Kunden.`)
      setLoeschenFrage(null)
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <Karte>
      <p className="text-xs tracking-wide text-mute uppercase">Kunden</p>
      <p className="mt-1 text-xs text-dim">
        Die Liste gilt für das ganze Team. Umbenennen ändert den Namen in allen Blöcken; ein Name, den es schon gibt, legt beide
        Kunden zusammen. Neue Kunden legst du direkt im Block-Dialog, im Fokus, bei „Ich bin weg“ oder beim Eintragen an.
      </p>
      {kunden.length === 0 ? (
        <p className="mt-3 text-sm text-dim">Noch keine Kunden. Beim nächsten Block unter „Kunde (optional)“ auf „+ Neuer Kunde“.</p>
      ) : (
        <div className="mt-2 divide-y divide-panel-2">
          {kunden.map((k) => (
            <div key={k} className="flex items-center justify-between gap-4 py-2.5">
              {bearbeitet === k ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void umbenennen(k)
                  }}
                >
                  <input className={`${FELD} flex-1`} value={neu} onChange={(e) => setNeu(e.target.value)} autoFocus placeholder={k} />
                  <button type="submit" disabled={laeuft || !neu.trim()} className="knopf-primaer flex items-center gap-1 rounded-chip px-3 py-1.5 text-sm disabled:opacity-60">
                    <Check size={14} strokeWidth={2} />
                    Speichern
                  </button>
                  <button type="button" onClick={() => setBearbeitet(null)} className="rounded-chip p-1.5 text-mute hover:text-ink" title="Abbrechen">
                    <X size={16} strokeWidth={1.5} />
                  </button>
                </form>
              ) : (
                <>
                  <div className="flex min-w-0 items-center gap-2">
                    <Building2 size={14} strokeWidth={1.5} className="shrink-0 text-mute" />
                    <span className="truncate text-sm">{k}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {loeschenFrage === k ? (
                      <>
                        <span className="text-xs text-mute">Aus allen Blöcken entfernen?</span>
                        <button type="button" disabled={laeuft} onClick={() => void loeschen(k)} className="rounded-chip px-3 py-1.5 text-sm text-unproduktiv hover:bg-panel-2">
                          Ja, löschen
                        </button>
                        <button type="button" onClick={() => setLoeschenFrage(null)} className="rounded-chip px-3 py-1.5 text-sm text-mute hover:text-ink">
                          Nein
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setBearbeitet(k)
                            setNeu(k)
                            setLoeschenFrage(null)
                          }}
                          className="flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-sm text-mute hover:bg-panel-2 hover:text-ink"
                        >
                          <Pencil size={14} strokeWidth={1.5} />
                          Umbenennen
                        </button>
                        <button type="button" onClick={() => setLoeschenFrage(k)} className="rounded-chip p-1.5 text-mute hover:text-unproduktiv" title="Löschen">
                          <Trash2 size={16} strokeWidth={1.5} />
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Karte>
  )
}
