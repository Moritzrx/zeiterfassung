import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { Building2, Swords, X } from 'lucide-react'
import { DUELL_ARTEN, type DuellArt, type SeasonPerson } from '@shared/spiel'
import { berlinDatum, berlinTeile, berlinZuUtc, datumVerschieben, wochentag } from '@shared/zeit'
import { Portal } from './Portal'
import { hinweisZeigen } from './Hinweis'
import { TaetigkeitSymbol } from '../symbole'
import { useTaetigkeiten } from '../taetigkeiten'
import { useKunden } from '../kunden'
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

const ARTEN: DuellArt[] = ['stunden', 'ziel', 'fruehstart']
const ZIELE = [2, 4, 6, 8, 10, 15, 20]

/** Vorschläge fürs Ende: heute Abend, morgen Abend, Freitagabend, Sonntag Mitternacht (nur die in der Zukunft). */
function enden(): Ende[] {
  const jetzt = new Date()
  const heute = berlinDatum(jetzt)
  const um = (datum: string, stunde: number): Date => {
    const [j, m, t] = datum.split('-').map(Number)
    return berlinZuUtc(j, m, t, stunde, 0)
  }
  const liste: Ende[] = []
  const heuteAbend = um(heute, 20)
  if (heuteAbend.getTime() > jetzt.getTime() + 15 * 60_000) liste.push({ schluessel: 'heute', label: 'Heute 20 Uhr', iso: heuteAbend.toISOString() })
  liste.push({ schluessel: 'morgen', label: 'Morgen 20 Uhr', iso: um(datumVerschieben(heute, 1), 20).toISOString() })
  const tag = wochentag(jetzt) // 0 = Sonntag
  const nummer = tag === 0 ? 7 : tag
  const bisFreitag = (5 - nummer + 7) % 7
  const freitagAbend = um(datumVerschieben(heute, bisFreitag), 20)
  if (bisFreitag > 1 && freitagAbend.getTime() > jetzt.getTime() + 60 * 60_000) liste.push({ schluessel: 'freitag', label: 'Freitag 20 Uhr', iso: freitagAbend.toISOString() })
  const bisMontag = (8 - nummer) % 7 || 7
  liste.push({ schluessel: 'sonntag', label: 'Sonntag 24 Uhr', iso: um(datumVerschieben(heute, bisMontag), 0).toISOString() })
  return liste
}

/**
 * Ein Duell anlegen (22. September 2026, zweite Fassung nach "genauer anklicken"): Gegner, Art (Mehr Stunden, Wettlauf,
 * Früher am Start), wahlweise Tätigkeit und Kunde als Filter, Ende als Vorschlag oder auf die Minute genau, Einsatz und
 * eine freie Beschreibung.
 */
export function DuellDialog({ gegner, onSchliessen, onErstellt }: Props): ReactElement {
  const taetigkeiten = useTaetigkeiten()
  const kunden = useKunden()
  const [anUser, setAnUser] = useState<string>(gegner[0]?.userId ?? '')
  const [art, setArt] = useState<DuellArt>('stunden')
  const [taetigkeit, setTaetigkeit] = useState<string | null>(null)
  const [kunde, setKunde] = useState<string | null>(null)
  const [zielStunden, setZielStunden] = useState(10)
  const [endeListe] = useState(enden)
  const [ende, setEnde] = useState<string>(endeListe[0]?.schluessel ?? 'sonntag')
  const morgen = useMemo(() => datumVerschieben(berlinDatum(new Date()), 1), [])
  const [genauDatum, setGenauDatum] = useState(morgen)
  const [genauZeit, setGenauZeit] = useState('18:00')
  const [tag, setTag] = useState(morgen)
  const [einsatz, setEinsatz] = useState('einen Kaffee')
  const [beschreibung, setBeschreibung] = useState('')
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  const genauIso = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(genauDatum) || !/^\d{2}:\d{2}$/.test(genauZeit)) return null
    const [j, m, t] = genauDatum.split('-').map(Number)
    const [h, min] = genauZeit.split(':').map(Number)
    return berlinZuUtc(j, m, t, h, min).toISOString()
  }, [genauDatum, genauZeit])

  async function absenden(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!window.api || laeuft || !anUser) return
    let bis: string
    if (art === 'fruehstart') bis = tag
    else if (ende === 'genau') {
      if (!genauIso) {
        hinweisZeigen('Bitte Datum und Uhrzeit für das Ende angeben.')
        return
      }
      bis = genauIso
    } else bis = endeListe.find((x) => x.schluessel === ende)?.iso ?? endeListe[endeListe.length - 1].iso
    setLaeuft(true)
    try {
      await window.api.spiel.duellErstellen({
        anUser,
        art,
        taetigkeit: art === 'fruehstart' ? null : taetigkeit,
        kunde: art === 'fruehstart' ? null : kunde,
        bis,
        einsatz,
        zielStunden: art === 'ziel' ? zielStunden : null,
        beschreibung: beschreibung.trim() || null
      })
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

  const chip = (aktiv: boolean): string => `rounded-chip px-3 py-1.5 text-sm transition-colors ${aktiv ? 'bg-ink text-ground' : 'bg-panel-2 text-ink hover:bg-inaktiv'}`
  const feld = 'rounded-chip bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-dim'
  const tagTeile = berlinTeile(new Date(Date.parse(`${tag}T12:00:00Z`)))

  return (
    <Portal>
      <div className="animate-aufblenden fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" onClick={onSchliessen}>
        <form onSubmit={(e) => void absenden(e)} onClick={(e) => e.stopPropagation()} className="animate-einblenden max-h-[calc(100vh-3rem)] w-full max-w-[600px] overscroll-contain overflow-y-auto rounded-card bg-panel p-6">
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
            {ARTEN.map((a) => (
              <button key={a} type="button" onClick={() => setArt(a)} className={chip(art === a)}>
                {DUELL_ARTEN[a].name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-dim">{DUELL_ARTEN[art].text}</p>

          {art === 'ziel' && (
            <>
              <p className="mt-4 text-xs tracking-wide text-mute uppercase">Wer zuerst … Stunden hat</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {ZIELE.map((z) => (
                  <button key={z} type="button" onClick={() => setZielStunden(z)} className={chip(zielStunden === z)}>
                    {z} h
                  </button>
                ))}
                <input
                  className={`${feld} w-24`}
                  type="number"
                  min={0.5}
                  max={200}
                  step={0.5}
                  value={zielStunden}
                  onChange={(e) => setZielStunden(Math.max(0.5, Number(e.target.value) || 0.5))}
                  title="Eigene Stundenzahl"
                />
              </div>
            </>
          )}

          {art !== 'fruehstart' && (
            <>
              <p className="mt-4 text-xs tracking-wide text-mute uppercase">Nur eine Tätigkeit? (optional)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setTaetigkeit(null)} className={chip(taetigkeit === null)}>
                  Alle Tätigkeiten
                </button>
                {taetigkeiten.map((t) => (
                  <button key={t} type="button" onClick={() => setTaetigkeit(t)} className={`flex items-center gap-1.5 ${chip(taetigkeit === t)}`}>
                    <TaetigkeitSymbol name={t} groesse={14} />
                    {t}
                  </button>
                ))}
              </div>
              {kunden.length > 0 && (
                <>
                  <p className="mt-4 text-xs tracking-wide text-mute uppercase">Nur ein Kunde? (optional)</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setKunde(null)} className={chip(kunde === null)}>
                      Alle Kunden
                    </button>
                    {kunden.map((k) => (
                      <button key={k} type="button" onClick={() => setKunde(k)} className={`flex items-center gap-1.5 ${chip(kunde === k)}`}>
                        <Building2 size={14} strokeWidth={1.8} />
                        {k}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {art === 'fruehstart' ? (
            <>
              <p className="mt-4 text-xs tracking-wide text-mute uppercase">An welchem Tag</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setTag(morgen)} className={chip(tag === morgen)}>
                  Morgen
                </button>
                <input className={feld} type="date" min={morgen} value={tag} onChange={(e) => setTag(e.target.value || morgen)} />
                <span className="text-xs text-dim">
                  {tagTeile.tag}.{tagTeile.monat}.{tagTeile.jahr}
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-xs tracking-wide text-mute uppercase">Bis wann</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {endeListe.map((x) => (
                  <button key={x.schluessel} type="button" onClick={() => setEnde(x.schluessel)} className={chip(ende === x.schluessel)}>
                    {x.label}
                  </button>
                ))}
                <button type="button" onClick={() => setEnde('genau')} className={chip(ende === 'genau')}>
                  Genau …
                </button>
              </div>
              {ende === 'genau' && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input className={feld} type="date" min={berlinDatum(new Date())} value={genauDatum} onChange={(e) => setGenauDatum(e.target.value)} />
                  <input className={feld} type="time" value={genauZeit} onChange={(e) => setGenauZeit(e.target.value)} />
                  <span className="text-xs text-dim">Berliner Zeit</span>
                </div>
              )}
            </>
          )}

          <p className="mt-4 text-xs tracking-wide text-mute uppercase">Einsatz</p>
          <input className={`${feld} mt-2 w-full`} value={einsatz} maxLength={60} onChange={(e) => setEinsatz(e.target.value)} placeholder="einen Kaffee" />

          <p className="mt-4 text-xs tracking-wide text-mute uppercase">Beschreibung (optional)</p>
          <input
            className={`${feld} mt-2 w-full`}
            value={beschreibung}
            maxLength={120}
            onChange={(e) => setBeschreibung(e.target.value)}
            placeholder="z. B. Wer schneidet diese Woche mehr Reels?"
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
