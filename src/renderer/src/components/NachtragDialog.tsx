import { useEffect, useState, type ReactElement } from 'react'
import { AlarmClockPlus, X } from 'lucide-react'
import { berlinTeile, berlinZuUtc } from '@shared/zeit'
import { fehlerText, uhrzeit } from '../format'
import { useKunden } from '../kunden'
import { TaetigkeitSymbol } from '../symbole'
import { useTaetigkeitenNachOrt } from '../taetigkeiten'
import { tonSpielen } from '../toene'
import { hinweisZeigen } from './Hinweis'
import { KundenWahl } from './KundenWahl'
import { Portal } from './Portal'

const FELD =
  'w-full rounded-chip bg-panel-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim'

function uhrText(iso: string): string {
  return uhrzeit(iso)
}

/** "09:05" am Kalendertag des Bezugszeitpunkts (Berlin) als UTC-Zeitpunkt, sonst null. */
function uhrZuZeit(bezug: string, text: string): Date | null {
  const treffer = /^(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!treffer) return null
  const t = berlinTeile(new Date(bezug))
  return berlinZuUtc(t.jahr, t.monat, t.tag, Number(treffer[1]), Number(treffer[2]))
}

/**
 * Lücke nachtragen (15. September 2026): Die Tagesliste zeigt Zeiten ohne Aufzeichnung, ein Klick öffnet diesen Dialog
 * mit den Zeiten schon eingetragen. Tätigkeit antippen (Unterwegs-Tätigkeiten zuerst, weil eine Lücke meist heißt,
 * dass man nicht am Rechner war), Kunde optional, Speichern legt einen produktiven Hand-Block an.
 */
export function NachtragDialog({
  start,
  ende,
  onSchliessen,
  onGespeichert
}: {
  start: string
  ende: string
  onSchliessen: () => void
  onGespeichert: () => void
}): ReactElement {
  const { alle, unterwegs, amRechner, eingeordnet } = useTaetigkeitenNachOrt()
  const kunden = useKunden()
  const [name, setName] = useState('')
  const [kunde, setKunde] = useState('')
  const [von, setVon] = useState(uhrText(start))
  const [bis, setBis] = useState(uhrText(ende))
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const reihenfolge = eingeordnet ? [...unterwegs, ...amRechner] : alle

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  async function speichern(): Promise<void> {
    const n = name.trim()
    if (!n) {
      setFehler('Bitte eine Tätigkeit antippen oder eintippen.')
      return
    }
    const s = uhrZuZeit(start, von)
    const e = uhrZuZeit(start, bis)
    if (!s || !e) {
      setFehler('Bitte Uhrzeiten wie 09:05 angeben.')
      return
    }
    if (e.getTime() <= s.getTime()) {
      setFehler('Das Ende muss nach dem Anfang liegen.')
      return
    }
    if (!window.api) return
    setLaeuft(true)
    try {
      await window.api.bloecke.manuellAnlegen({ start: s.toISOString(), ende: e.toISOString(), taetigkeit: n, notiz: null, kunde: kunde.trim() || null })
      tonSpielen('erfolg')
      hinweisZeigen(`${uhrzeit(s.toISOString())} bis ${uhrzeit(e.toISOString())} als „${n}“ nachgetragen, produktiv.`)
      onGespeichert()
    } catch (err) {
      setFehler(fehlerText(err))
      setLaeuft(false)
    }
  }

  return (
    <Portal>
      <div className="animate-aufblenden fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" onClick={onSchliessen}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="glas animate-einblenden max-h-[calc(100vh-3rem)] w-full max-w-[560px] overscroll-contain overflow-y-auto rounded-card p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl">
                <AlarmClockPlus size={20} strokeWidth={1.5} />
                Zeit nachtragen
              </h2>
              <p className="mt-1 text-sm text-mute">Keine Aufzeichnung von {uhrText(start)} bis {uhrText(ende)}. Was war das? Es wird als produktive Zeit gebucht.</p>
            </div>
            <button type="button" onClick={onSchliessen} className="rounded-chip p-1 text-mute hover:text-ink" title="Schließen">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="text-xs text-mute">
              Von
              <input className={`${FELD} mt-1`} value={von} onChange={(e) => setVon(e.target.value)} placeholder="09:05" />
            </label>
            <label className="text-xs text-mute">
              Bis
              <input className={`${FELD} mt-1`} value={bis} onChange={(e) => setBis(e.target.value)} placeholder="10:30" />
            </label>
          </div>

          <div className="mt-5">
            <p className="text-xs tracking-wide text-mute uppercase">Tätigkeit</p>
            {reihenfolge.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {reihenfolge.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setName(t)}
                    className={`flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-sm transition-colors ${
                      name === t ? 'bg-ink text-ground' : 'bg-panel-2 text-ink hover:bg-inaktiv'
                    }`}
                  >
                    <TaetigkeitSymbol name={t} groesse={14} />
                    {t}
                  </button>
                ))}
              </div>
            )}
            <input
              className={`${FELD} mt-2`}
              placeholder="oder eine neue Tätigkeit eintippen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void speichern()
              }}
            />
          </div>

          <div className="mt-5">
            <p className="text-xs tracking-wide text-mute uppercase">Kunde (optional)</p>
            <KundenWahl wert={kunde} onChange={setKunde} kunden={kunden} />
          </div>

          {fehler && <p className="mt-4 text-sm text-unproduktiv">{fehler}</p>}

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onSchliessen} className="rounded-chip px-4 py-2 text-sm text-mute hover:text-ink">
              Abbrechen
            </button>
            <button type="button" disabled={laeuft} onClick={() => void speichern()} className="knopf-primaer rounded-chip px-4 py-2 text-sm disabled:opacity-60">
              Nachtragen
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
