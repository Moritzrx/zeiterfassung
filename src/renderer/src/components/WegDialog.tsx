import { useEffect, useState, type ReactElement } from 'react'
import { DoorOpen, X } from 'lucide-react'
import { berlinTeile, berlinZuUtc } from '@shared/zeit'
import { fehlerText, uhrzeit } from '../format'
import { TaetigkeitSymbol } from '../symbole'
import { useTaetigkeiten } from '../taetigkeiten'
import { tonSpielen } from '../toene'
import { hinweisZeigen } from './Hinweis'
import { Portal } from './Portal'

const EREIGNIS = 'weg-dialog'

/** Öffnet den "Ich bin weg"-Dialog von überall (Kopfzeile, Heute-Karte). */
export function wegDialogOeffnen(): void {
  window.dispatchEvent(new CustomEvent(EREIGNIS))
}

/** Hält den Dialog bereit; sitzt einmal in App.tsx. */
export function WegDialogHalter(): ReactElement | null {
  const [offen, setOffen] = useState(false)
  useEffect(() => {
    const h = (): void => setOffen(true)
    window.addEventListener(EREIGNIS, h)
    return () => window.removeEventListener(EREIGNIS, h)
  }, [])
  if (!offen) return null
  return <WegDialog onSchliessen={() => setOffen(false)} />
}

const BEGINN_WAHL: { minuten: number | null; text: string }[] = [
  { minuten: 0, text: 'Jetzt' },
  { minuten: 15, text: 'Vor 15 Minuten' },
  { minuten: 30, text: 'Vor 30 Minuten' },
  { minuten: 60, text: 'Vor 1 Stunde' },
  { minuten: null, text: 'Seit Uhrzeit' }
]

const FELD =
  'w-full rounded-chip bg-panel-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim'

/**
 * "Ich bin weg" (11. September 2026, "ein Klick zu viel bei Terminen"): Bevor man zum Termin, zum Dreh oder ans
 * Telefon geht, einmal die Tätigkeit wählen. Ab dann läuft ein produktiver Block mit dieser Tätigkeit, bis die
 * erste Eingabe am Rechner die Rückkehr meldet. Kein Nachtragen unter "Eintragen", keine rote Zeit.
 */
function WegDialog({ onSchliessen }: { onSchliessen: () => void }): ReactElement {
  const taetigkeiten = useTaetigkeiten()
  const [name, setName] = useState('')
  const [minuten, setMinuten] = useState<number | null>(0)
  const [uhr, setUhr] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  function beginn(): Date | null {
    const jetzt = new Date()
    if (minuten !== null) return new Date(jetzt.getTime() - minuten * 60_000)
    const treffer = /^(\d{1,2}):(\d{2})$/.exec(uhr.trim())
    if (!treffer) return null
    const t = berlinTeile(jetzt)
    return berlinZuUtc(t.jahr, t.monat, t.tag, Number(treffer[1]), Number(treffer[2]))
  }

  async function starten(): Promise<void> {
    const n = name.trim()
    if (!n) {
      setFehler('Bitte eine Tätigkeit antippen oder eintippen.')
      return
    }
    const b = beginn()
    if (!b) {
      setFehler('Bitte eine Uhrzeit wie 14:30 angeben.')
      return
    }
    if (b.getTime() > Date.now()) {
      setFehler('Die Uhrzeit liegt in der Zukunft.')
      return
    }
    if (Date.now() - b.getTime() > 3 * 3_600_000) {
      setFehler('Der Beginn darf höchstens drei Stunden zurückliegen. Ältere Zeiten bitte unter „Eintragen“ nachtragen.')
      return
    }
    if (!window.api) return
    setLaeuft(true)
    try {
      await window.api.weg.starten(n, b.toISOString())
      tonSpielen('erfolg')
      hinweisZeigen(`„${n}“ läuft${minuten === 0 ? '' : ` seit ${uhrzeit(b.toISOString())}`}. Die erste Eingabe am Rechner beendet es.`)
      onSchliessen()
    } catch (e) {
      setFehler(fehlerText(e))
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
                <DoorOpen size={20} strokeWidth={1.5} />
                Ich bin weg
              </h2>
              <p className="mt-1 text-sm text-mute">
                Termin, Dreh, Telefonat, Fahrt: Sag einmal, was du machst. Bis du zurück bist, zählt die Zeit als produktiv
                mit dieser Tätigkeit. Die erste Eingabe am Rechner beendet es von selbst.
              </p>
            </div>
            <button type="button" onClick={onSchliessen} className="rounded-chip p-1 text-mute hover:text-ink" title="Schließen">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="mt-5">
            <p className="text-xs tracking-wide text-mute uppercase">Was machst du?</p>
            {taetigkeiten.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {taetigkeiten.map((t) => (
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
              placeholder={taetigkeiten.length ? 'oder eine neue Tätigkeit eintippen' : 'Tätigkeit, z. B. Kundentermin'}
              value={name}
              autoFocus={taetigkeiten.length === 0}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void starten()
              }}
            />
          </div>

          <div className="mt-5">
            <p className="text-xs tracking-wide text-mute uppercase">Seit wann</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {BEGINN_WAHL.map((w) => (
                <button
                  key={w.text}
                  type="button"
                  onClick={() => setMinuten(w.minuten)}
                  className={`rounded-chip px-3 py-1.5 text-sm transition-colors ${
                    minuten === w.minuten ? 'bg-ink text-ground' : 'bg-panel-2 text-ink hover:bg-inaktiv'
                  }`}
                >
                  {w.text}
                </button>
              ))}
              {minuten === null && (
                <input
                  className={`${FELD} w-28`}
                  placeholder="14:30"
                  value={uhr}
                  autoFocus
                  onChange={(e) => setUhr(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void starten()
                  }}
                />
              )}
            </div>
            <p className="mt-2 text-xs text-dim">
              Rückwirkend heißt: Schon rot gebuchte Zeit ohne Eingabe seit dem Beginn gehört zum Termin. Wer nur eine Pause
              macht, die nicht zählen soll, nimmt oben den Pause-Knopf.
            </p>
          </div>

          {fehler && <p className="mt-4 text-sm text-unproduktiv">{fehler}</p>}

          <div className="mt-6 flex items-center justify-end gap-2">
            <button type="button" onClick={onSchliessen} className="rounded-chip px-4 py-2 text-sm text-mute hover:text-ink">
              Abbrechen
            </button>
            <button
              type="button"
              disabled={laeuft}
              onClick={() => void starten()}
              className="knopf-primaer rounded-chip px-4 py-2 text-sm disabled:opacity-60"
            >
              Los, ich bin weg
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
