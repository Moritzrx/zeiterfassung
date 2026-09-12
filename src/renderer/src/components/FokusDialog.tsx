import { useEffect, useState, type ReactElement } from 'react'
import { Crosshair, X } from 'lucide-react'
import { berlinTeile, berlinZuUtc } from '@shared/zeit'
import { useErfassung } from '../erfassung'
import { fehlerText, uhrzeit } from '../format'
import { TaetigkeitSymbol } from '../symbole'
import { useTaetigkeitenNachOrt } from '../taetigkeiten'
import { useKunden } from '../kunden'
import { tonSpielen } from '../toene'
import { hinweisZeigen } from './Hinweis'
import { KundenWahl } from './KundenWahl'
import { Portal } from './Portal'

const EREIGNIS = 'fokus-dialog'

/** Öffnet den Fokus-Dialog von überall (Kopfzeile, Heute-Karte, Strg+F). */
export function fokusDialogOeffnen(): void {
  window.dispatchEvent(new CustomEvent(EREIGNIS))
}

/** Hält den Dialog bereit; sitzt einmal in App.tsx. */
export function FokusDialogHalter(): ReactElement | null {
  const [offen, setOffen] = useState(false)
  useEffect(() => {
    const h = (): void => setOffen(true)
    window.addEventListener(EREIGNIS, h)
    return () => window.removeEventListener(EREIGNIS, h)
  }, [])
  if (!offen) return null
  return <FokusDialog onSchliessen={() => setOffen(false)} />
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
 * Der Dialog zum Starten eines Fokus: eine Tätigkeit wählen, den Beginn wählen (jetzt oder rückwirkend),
 * fertig. Ab dann zählt alles als produktiv mit dieser Tätigkeit, egal welches Programm vorne ist.
 */
function FokusDialog({ onSchliessen }: { onSchliessen: () => void }): ReactElement {
  // Nur Tätigkeiten am Rechner: Dreh, Fahrt und Kundentermin gehören zu "Ich bin weg" (12. September 2026).
  const { amRechner: taetigkeiten, eingeordnet } = useTaetigkeitenNachOrt()
  const kunden = useKunden()
  const nurFokus = useErfassung().nurFokus
  const [name, setName] = useState('')
  const [kunde, setKunde] = useState('')
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
    if (!window.api) return
    setLaeuft(true)
    try {
      await window.api.fokus.starten(n, b.toISOString(), kunde.trim() || null)
      tonSpielen('erfolg')
      hinweisZeigen(`Fokus „${n}“${kunde.trim() ? ` für ${kunde.trim()}` : ''} läuft${minuten === 0 ? '' : ` seit ${uhrzeit(b.toISOString())}`}. Alles zählt jetzt dazu.`)
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
                <Crosshair size={20} strokeWidth={1.5} />
                Fokus starten
              </h2>
              <p className="mt-1 text-sm text-mute">
                Woran arbeitest du gerade? Bis du den Fokus beendest, zählt alles als produktiv mit dieser Tätigkeit,
                egal ob du in Claude, Instagram, YouTube oder sonst wo bist. Regeln sind so lange ausgeschaltet.
              </p>
            </div>
            <button type="button" onClick={onSchliessen} className="rounded-chip p-1 text-mute hover:text-ink" title="Schließen">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="mt-5">
            <p className="text-xs tracking-wide text-mute uppercase">Tätigkeit</p>
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
              placeholder={taetigkeiten.length ? 'oder eine neue Tätigkeit eintippen' : 'Tätigkeit, z. B. Instagram Learning'}
              value={name}
              autoFocus={taetigkeiten.length === 0}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void starten()
              }}
            />
            {eingeordnet && <p className="mt-2 text-xs text-dim">Dreh, Fahrt, Kundentermin und andere Unterwegs-Tätigkeiten findest du unter „Ich bin weg“.</p>}
          </div>

          <div className="mt-5">
            <p className="text-xs tracking-wide text-mute uppercase">Kunde (optional)</p>
            <KundenWahl wert={kunde} onChange={setKunde} kunden={kunden} />
          </div>

          <div className="mt-5">
            <p className="text-xs tracking-wide text-mute uppercase">Beginn</p>
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
              {nurFokus
                ? 'Rückwirkend heißt: Die Zeit seit dem Beginn wird als ein Block mit dieser Tätigkeit nachgetragen.'
                : 'Rückwirkend heißt: Die Blöcke seit dem Beginn bekommen die Tätigkeit sofort, auch schon bewertete.'}{' '}
              Der Fokus endet von selbst um Mitternacht oder wenn du länger als 90 Minuten nichts tust. Was eine Regel als unproduktiv
              einstuft (etwa Netflix), bleibt auch im Fokus rot.
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
              Fokus starten
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
