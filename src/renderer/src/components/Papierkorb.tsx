import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import type { Block } from '@shared/typen'
import { anzeigeName } from '@shared/fenster'
import { ruheName } from '@shared/ruhe'
import { fehlerText, dauerText, kurzDatum, uhrzeit } from '../format'
import { TaetigkeitSymbol } from '../symbole'
import { tonSpielen } from '../toene'
import { hinweisZeigen } from './Hinweis'
import { Karte } from './Karte'

/**
 * Papierkorb (15. September 2026, "gelöschte Blöcke sind nur ausgeblendet, aber niemand kann sie zurückholen"):
 * die in den letzten 30 Tagen gelöschten Blöcke mit "Wiederherstellen". Fenstertitel und Notiz sind beim Löschen
 * entfernt worden und kommen nicht zurück (bewusst, Datenschutz).
 */
export function Papierkorb(): ReactElement {
  const [liste, setListe] = useState<Block[] | null>(null)
  const [laeuft, setLaeuft] = useState<string | null>(null)

  const laden = useCallback(async () => {
    if (!window.api) return
    try {
      setListe(await window.api.bloecke.geloeschte())
    } catch (e) {
      hinweisZeigen(fehlerText(e))
      setListe([])
    }
  }, [])

  useEffect(() => {
    void laden()
    if (!window.api) return
    return window.api.bloecke.onAenderung(() => void laden())
  }, [laden])

  async function wiederherstellen(b: Block): Promise<void> {
    if (!window.api || laeuft) return
    setLaeuft(b.id)
    try {
      const ergebnis = await window.api.bloecke.wiederherstellen(b.id)
      if (ergebnis) {
        tonSpielen('erfolg')
        hinweisZeigen(`Block vom ${kurzDatum(b.start.slice(0, 10))} wiederhergestellt.`)
      } else {
        hinweisZeigen('Der Block ist nicht mehr da.')
      }
      await laden()
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    } finally {
      setLaeuft(null)
    }
  }

  return (
    <Karte>
      <p className="flex items-center gap-2 text-xs tracking-wide text-mute uppercase">
        <Trash2 size={14} strokeWidth={1.5} />
        Papierkorb
      </p>
      <p className="mt-1 text-xs text-dim">
        Gelöschte Blöcke der letzten 30 Tage. Wiederherstellen holt sie in die Liste zurück; der Fenstertitel wurde beim Löschen entfernt
        und bleibt leer.
      </p>
      {liste === null ? (
        <p className="mt-3 text-sm text-dim">Lädt …</p>
      ) : liste.length === 0 ? (
        <p className="mt-3 text-sm text-dim">Nichts im Papierkorb.</p>
      ) : (
        <div className="mt-2 divide-y divide-panel-2">
          {liste.map((b) => {
            const name = anzeigeName(b.programm, b.fenstertitel)
            const sekunden = (Date.parse(b.ende) - Date.parse(b.start)) / 1000
            const was = b.bewertung === 'inaktiv' ? ruheName(b) : (b.taetigkeit ?? name.haupt ?? (b.quelle === 'manuell' ? 'Hand-Eintrag' : 'Block'))
            return (
              <div key={b.id} className="flex items-center gap-3 py-2.5">
                <div className="w-28 shrink-0 text-sm tabular-nums text-mute">
                  {kurzDatum(b.start.slice(0, 10))}
                  <span className="block text-xs text-dim">
                    {uhrzeit(b.start)} – {uhrzeit(b.ende)}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                  {b.taetigkeit && <TaetigkeitSymbol name={b.taetigkeit} groesse={14} />}
                  <span className="truncate">{was}</span>
                  {b.kunde && <span className="shrink-0 rounded-chip bg-panel-2 px-1.5 py-0.5 text-xs text-mute">{b.kunde}</span>}
                </div>
                <div className="w-16 shrink-0 text-right text-sm tabular-nums text-mute">{dauerText(sekunden)}</div>
                <div className="hidden w-24 shrink-0 text-right text-xs text-dim sm:block">
                  {b.geloeschtAm ? `gelöscht ${kurzDatum(b.geloeschtAm.slice(0, 10))} ${uhrzeit(b.geloeschtAm)}` : ''}
                </div>
                <button
                  type="button"
                  disabled={laeuft !== null}
                  onClick={() => void wiederherstellen(b)}
                  className="flex shrink-0 items-center gap-1 rounded-chip bg-panel-2 px-2.5 py-1 text-xs text-ink transition-colors hover:bg-inaktiv disabled:opacity-40"
                  title="Diesen Block zurückholen"
                >
                  <RotateCcw size={12} strokeWidth={2} />
                  Wiederherstellen
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Karte>
  )
}
