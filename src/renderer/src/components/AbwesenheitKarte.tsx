import { useState, type ReactElement } from 'react'
import { Coffee, Plus, Smartphone } from 'lucide-react'
import type { Abwesenheit } from '@shared/typen'
import { fehlerText, uhrzeit } from '../format'
import { TaetigkeitSymbol } from '../symbole'
import { useTaetigkeiten } from '../taetigkeiten'
import { tonSpielen } from '../toene'
import { hinweisZeigen } from './Hinweis'
import { Karte } from './Karte'

const FELD =
  'rounded-chip bg-panel-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim'
const CHIP = 'flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-sm transition-colors bg-panel-2 text-ink hover:bg-inaktiv'

function minutenText(a: Abwesenheit): string {
  const minuten = Math.round((Date.parse(a.ende) - Date.parse(a.start)) / 60_000)
  if (minuten < 60) return `${minuten} Minuten`
  const h = Math.floor(minuten / 60)
  const m = minuten % 60
  return m ? `${h} Stunde${h > 1 ? 'n' : ''} ${m} Minuten` : `${h} Stunde${h > 1 ? 'n' : ''}`
}

/**
 * Rückfrage nach einer Abwesenheit (11. September 2026, "Abwesenheit ist immer rot"): Zeit ohne Eingabe wurde bisher
 * unproduktiv gebucht, bis man sie unter "Eintragen" nachtrug. Jetzt fragt die App nach der Rückkehr mit einem Klick:
 * Pause (zählt nicht), eine Tätigkeit (produktiver Hand-Block), privat (bleibt rot) oder später.
 */
export function AbwesenheitKarte({ liste }: { liste: Abwesenheit[] }): ReactElement | null {
  const taetigkeiten = useTaetigkeiten()
  if (!liste.length) return null
  return (
    <Karte className="mb-4">
      <p className="text-xs tracking-wide text-mute uppercase">Was war das?</p>
      <div className="mt-2 flex flex-col gap-4">
        {liste.map((a) => (
          <Eintrag key={a.id} abwesenheit={a} taetigkeiten={taetigkeiten} />
        ))}
      </div>
    </Karte>
  )
}

function Eintrag({ abwesenheit: a, taetigkeiten }: { abwesenheit: Abwesenheit; taetigkeiten: string[] }): ReactElement {
  const [neuOffen, setNeuOffen] = useState(false)
  const [neu, setNeu] = useState('')
  const [laeuft, setLaeuft] = useState(false)

  async function ausfuehren(aktion: () => Promise<void>, meldung: string, ton: 'erfolg' | 'schliessen'): Promise<void> {
    if (!window.api || laeuft) return
    setLaeuft(true)
    try {
      await aktion()
      tonSpielen(ton)
      hinweisZeigen(meldung)
    } catch (e) {
      hinweisZeigen(fehlerText(e))
      setLaeuft(false)
    }
  }

  const zuordnen = (t: string): Promise<void> =>
    ausfuehren(() => window.api.abwesenheit.zuordnen(a.id, t, null), `${minutenText(a)} als „${t}“ gebucht, produktiv.`, 'erfolg')

  return (
    <div className={laeuft ? 'opacity-60' : ''}>
      <p className="text-base">
        Du warst {minutenText(a)} weg
        <span className="text-mute">
          {' '}
          ({uhrzeit(a.start)} bis {uhrzeit(a.ende)})
        </span>
        .
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={laeuft}
          onClick={() => void ausfuehren(() => window.api.abwesenheit.pause(a.id), 'Als Pause gebucht, zählt nirgends.', 'schliessen')}
          className={CHIP}
          title="Die Zeit zählt weder als produktiv noch als unproduktiv"
        >
          <Coffee size={14} strokeWidth={1.75} />
          Pause
        </button>
        {taetigkeiten.map((t) => (
          <button key={t} type="button" disabled={laeuft} onClick={() => void zuordnen(t)} className={CHIP} title={`Als „${t}“ buchen, produktiv`}>
            <TaetigkeitSymbol name={t} groesse={14} />
            {t}
          </button>
        ))}
        {neuOffen ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (neu.trim()) void zuordnen(neu.trim())
            }}
          >
            <input className={FELD} value={neu} onChange={(e) => setNeu(e.target.value)} placeholder="Neue Tätigkeit" autoFocus />
            <button type="submit" disabled={!neu.trim() || laeuft} className="knopf-primaer rounded-chip px-3 py-1.5 text-sm disabled:opacity-60">
              Buchen
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setNeuOffen(true)}
            className="flex items-center gap-1.5 rounded-chip border border-dashed border-mute px-3 py-1.5 text-sm text-mute transition-colors hover:border-ink hover:text-ink"
          >
            <Plus size={14} strokeWidth={1.5} />
            Neue Tätigkeit
          </button>
        )}
        <button
          type="button"
          disabled={laeuft}
          onClick={() => void ausfuehren(() => window.api.abwesenheit.privat(a.id), 'Bleibt unproduktiv.', 'schliessen')}
          className={`${CHIP} text-mute`}
          title="Handy, Sofa, privat: bleibt unproduktiv (rot)"
        >
          <Smartphone size={14} strokeWidth={1.75} />
          Privat
        </button>
        <button
          type="button"
          disabled={laeuft}
          onClick={() => void ausfuehren(() => window.api.abwesenheit.spaeter(a.id), 'In der Liste unten bleibt der Block änderbar.', 'schliessen')}
          className="rounded-chip px-3 py-1.5 text-sm text-mute transition-colors hover:text-ink"
          title="Rückfrage ausblenden, der Block bleibt in der Liste änderbar"
        >
          Später
        </button>
      </div>
    </div>
  )
}
