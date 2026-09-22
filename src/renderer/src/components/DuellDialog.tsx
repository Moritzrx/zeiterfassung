import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import { Swords, X } from 'lucide-react'
import { DUELL_ARTEN, type DuellArt, type SeasonPerson } from '@shared/spiel'
import { berlinDatum, berlinTeile, berlinZuUtc, datumVerschieben, wochentag } from '@shared/zeit'
import { Portal } from './Portal'
import { hinweisZeigen } from './Hinweis'
import { TaetigkeitSymbol } from '../symbole'
import { useTaetigkeiten } from '../taetigkeiten'
import { fehlerText } from '../format'
import { tonSpielen } from '../toene'

interface Props {
  gegner: SeasonPerson[]
  onSchliessen: () => void
  onErstellt: () => void
}

interface Ende {
  schluessel: string
  label: string
  iso: string
}

/** Mögliche Enden: heute Abend, Freitagabend, Sonntag Mitternacht (nur die, die noch in der Zukunft liegen). */
function enden(): Ende[] {
  const jetzt = new Date()
  const heute = berlinDatum(jetzt)
  const [j, m, t] = heute.split('-').map(Number)
  const liste: Ende[] = []
  const heuteAbend = berlinZuUtc(j, m, t, 20, 0)
  if (heuteAbend.getTime() > jetzt.getTime() + 15 * 60_000) liste.push({ schluessel: 'heute', label: 'Heute 20 Uhr', iso: heuteAbend.toISOString() })
  const tag = wochentag(jetzt) // 0 = Sonntag
  const bisFreitag = (5 - (tag === 0 ? 7 : tag) + 7) % 7
  const freitag = datumVerschieben(heute, bisFreitag)
  const [fj, fm, ft] = freitag.split('-').map(Number)
  const freitagAbend = berlinZuUtc(fj, fm, ft, 20, 0)
  if (freitagAbend.getTime() > jetzt.getTime() + 60 * 60_000) liste.push({ schluessel: 'freitag', label: bisFreitag === 0 ? 'Freitag 20 Uhr (heute)' : 'Freitag 20 Uhr', iso: freitagAbend.toISOString() })
  const bisSonntag = (7 - (tag === 0 ? 7 : tag)) % 7
  const montag = datumVerschieben(heute, bisSonntag + 1)
  const [mj, mm, mt] = montag.split('-').map(Number)
  const sonntagNacht = berlinZuUtc(mj, mm, mt, 0, 0)
  liste.push({ schluessel: 'sonntag', label: 'Sonntag 24 Uhr', iso: sonntagNacht.toISOString() })
  return liste
}

/** Ein Duell anlegen (22. September 2026): Gegner, Art, Tätigkeit, Ende, Einsatz. */
export function DuellDialog({ gegner, onSchliessen, onErstellt }: Props): ReactElement {
  const taetigkeiten = useTaetigkeiten()
  const [anUser, setAnUser] = useState<string>(gegner[0]?.userId ?? '')
  const [art, setArt] = useState<DuellArt>('stunden')
  const [taetigkeit, setTaetigkeit] = useState<string>('')
  const [endeListe] = useState(enden)
  const [ende, setEnde] = useState<string>(endeListe[0]?.schluessel ?? 'sonntag')
  const [einsatz, setEinsatz] = useState('einen Kaffee')
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  const morgen = datumVerschieben(berlinDatum(new Date()), 1)
  const morgenTeile = berlinTeile(new Date(Date.parse(`${morgen}T12:00:00Z`)))

  async function absenden(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!window.api || laeuft || !anUser) return
    if (art === 'taetigkeit' && !taetigkeit) {
      hinweisZeigen('Bitte eine Tätigkeit wählen.')
      return
    }
    setLaeuft(true)
    try {
      const bis = endeListe.find((x) => x.schluessel === ende)?.iso ?? endeListe[endeListe.length - 1].iso
      await window.api.spiel.duellErstellen(anUser, art, art === 'taetigkeit' ? taetigkeit : null, bis, einsatz)
      tonSpielen('erfolg')
      hinweisZeigen('Herausforderung ist raus. Sobald sie angenommen wird, zählt es.')
      onErstellt()
      onSchliessen()
    } catch (fehler) {
      hinweisZeigen(fehlerText(fehler))
    } finally {
      setLaeuft(false)
    }
  }

  const chip = (aktiv: boolean): string =>
    `rounded-chip px-3 py-1.5 text-sm transition-colors ${aktiv ? 'bg-ink text-ground' : 'bg-panel-2 text-ink hover:bg-inaktiv'}`

  return (
    <Portal>
      <div className="animate-aufblenden fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" onClick={onSchliessen}>
        <form onSubmit={(e) => void absenden(e)} onClick={(e) => e.stopPropagation()} className="animate-einblenden max-h-[calc(100vh-3rem)] w-full max-w-[560px] overscroll-contain overflow-y-auto rounded-card bg-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl">
                <Swords size={20} strokeWidth={1.6} /> Duell
              </h2>
              <p className="mt-1 text-sm text-mute">Wer gewinnt, bekommt 40 Season-Punkte. Wer verliert, schuldet den Einsatz.</p>
            </div>
            <button type="button" onClick={onSchliessen} className="rounded-chip p-1 text-mute hover:text-ink" title="Schließen">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <p className="mt-5 text-xs tracking-wide text-mute uppercase">Gegen wen</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {gegner.map((g) => (
              <button key={g.userId} type="button" onClick={() => setAnUser(g.userId)} className={chip(anUser === g.userId)}>
                {g.name}
              </button>
            ))}
            {gegner.length === 0 && <p className="text-sm text-dim">Niemand da, den man herausfordern könnte.</p>}
          </div>

          <p className="mt-5 text-xs tracking-wide text-mute uppercase">Worum es geht</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(DUELL_ARTEN) as DuellArt[]).map((a) => (
              <button key={a} type="button" onClick={() => setArt(a)} className={chip(art === a)}>
                {DUELL_ARTEN[a].name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-dim">
            {art === 'fruehstart' ? `${DUELL_ARTEN[art].text} Gilt für morgen, ${morgenTeile.tag}.${morgenTeile.monat}.` : DUELL_ARTEN[art].text}
          </p>

          {art === 'taetigkeit' && (
            <>
              <p className="mt-5 text-xs tracking-wide text-mute uppercase">Tätigkeit</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {taetigkeiten.map((t) => (
                  <button key={t} type="button" onClick={() => setTaetigkeit(t)} className={`flex items-center gap-1.5 ${chip(taetigkeit === t)}`}>
                    <TaetigkeitSymbol name={t} groesse={14} />
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}

          {art !== 'fruehstart' && (
            <>
              <p className="mt-5 text-xs tracking-wide text-mute uppercase">Bis wann</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {endeListe.map((x) => (
                  <button key={x.schluessel} type="button" onClick={() => setEnde(x.schluessel)} className={chip(ende === x.schluessel)}>
                    {x.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="mt-5 text-xs tracking-wide text-mute uppercase">Einsatz</p>
          <input
            className="mt-2 w-full rounded-chip bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-dim"
            value={einsatz}
            maxLength={60}
            onChange={(e) => setEinsatz(e.target.value)}
            placeholder="einen Kaffee"
          />

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onSchliessen} className="rounded-chip bg-panel-2 px-4 py-2 text-sm text-ink transition-colors hover:bg-inaktiv">
              Abbrechen
            </button>
            <button type="submit" disabled={laeuft || !anUser} className="knopf-primaer rounded-chip px-4 py-2 text-sm disabled:opacity-40">
              Herausfordern
            </button>
          </div>
        </form>
      </div>
    </Portal>
  )
}
