import { useState, type ReactElement } from 'react'
import { Coffee, Swords } from 'lucide-react'
import { DUELL_ARTEN, type Duell, type SeasonPerson } from '@shared/spiel'
import { Karte } from './Karte'
import { DuellDialog } from './DuellDialog'
import { hinweisZeigen } from './Hinweis'
import { useDuelle } from '../spiel'
import { useNutzer } from '../nutzer'
import { fehlerText, kurzDatum, stundenText, uhrzeit } from '../format'
import { berlinDatum } from '@shared/zeit'
import { tonSpielen } from '../toene'

interface Props {
  team: SeasonPerson[]
}

function wertText(d: Duell, wert: number | null): string {
  if (d.art === 'fruehstart') {
    if (wert === null) return 'noch nichts'
    const h = Math.floor(wert / 3600)
    const m = Math.floor((wert % 3600) / 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} Uhr`
  }
  return `${stundenText(wert ?? 0)} h`
}

function endeText(iso: string): string {
  const heute = berlinDatum(new Date())
  const tag = berlinDatum(new Date(iso))
  return tag === heute ? `heute ${uhrzeit(iso)}` : `${kurzDatum(tag)} ${uhrzeit(iso)}`
}

/**
 * Duelle auf dem Team-Screen (22. September 2026): Herausforderungen annehmen, laufende Duelle live, erledigte mit
 * Sieger und offenem Einsatz ("schuldet einen Kaffee", per Klick eingelöst).
 */
export function DuellKarte({ team }: Props): ReactElement {
  const { duelle, fehler, neuLaden } = useDuelle()
  const { status } = useNutzer()
  const ich = status?.userId ?? ''
  const [offen, setOffen] = useState(false)

  async function antworten(id: string, annehmen: boolean): Promise<void> {
    if (!window.api) return
    try {
      await window.api.spiel.duellAntworten(id, annehmen)
      tonSpielen(annehmen ? 'erfolg' : 'schliessen')
      await neuLaden()
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    }
  }

  async function einloesen(id: string): Promise<void> {
    if (!window.api) return
    try {
      await window.api.spiel.duellEinloesen(id)
      await neuLaden()
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    }
  }

  const anfragen = duelle.filter((d) => d.status === 'offen' && d.anUser === ich)
  const wartend = duelle.filter((d) => d.status === 'offen' && d.vonUser === ich)
  const laufend = duelle.filter((d) => d.status === 'angenommen')
  const erledigt = duelle.filter((d) => d.status === 'beendet' || d.status === 'abgelehnt').slice(0, 6)
  const schulden = duelle.filter((d) => d.status === 'beendet' && d.gewinner && !d.eingeloestAm)

  const name = (d: Duell, userId: string): string => (userId === d.vonUser ? d.vonName : d.anName)
  const verlierer = (d: Duell): string | null => (d.gewinner ? (d.gewinner === d.vonUser ? d.anUser : d.vonUser) : null)

  return (
    <Karte>
      {offen && <DuellDialog gegner={team.filter((p) => !p.istIch)} onSchliessen={() => setOffen(false)} onErstellt={() => void neuLaden()} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs tracking-wide text-mute uppercase">Duelle</p>
        <button type="button" onClick={() => setOffen(true)} className="knopf-primaer flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-sm">
          <Swords size={14} strokeWidth={2} />
          Herausfordern
        </button>
      </div>
      {fehler && <p className="mt-3 text-sm text-mute">{fehler}</p>}
      {!fehler && duelle.length === 0 && (
        <p className="mt-3 text-sm text-dim">Noch kein Duell. Fordere jemanden heraus: mehr Stunden bis Freitag, mehr Schnitt-Stunden, oder wer morgen früher am Start ist.</p>
      )}

      {anfragen.length > 0 && (
        <div className="mt-3 space-y-2">
          {anfragen.map((d) => (
            <div key={d.id} className="rounded-chip bg-orange/15 p-3">
              <p className="text-sm">
                <span className="text-orange">{d.vonName}</span> fordert dich heraus: {DUELL_ARTEN[d.art].name}
                {d.taetigkeit ? ` „${d.taetigkeit}“` : ''}, bis {endeText(d.bis)}. Einsatz: {d.einsatz}.
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => void antworten(d.id, true)} className="knopf-primaer rounded-chip px-3 py-1 text-sm">
                  Annehmen
                </button>
                <button type="button" onClick={() => void antworten(d.id, false)} className="rounded-chip bg-panel-2 px-3 py-1 text-sm text-ink transition-colors hover:bg-inaktiv">
                  Ablehnen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {laufend.length > 0 && (
        <div className="mt-3 space-y-3">
          {laufend.map((d) => {
            const a = d.vonWert ?? 0
            const b = d.anWert ?? 0
            const max = Math.max(a, b, 1)
            const fuehrt = d.art === 'fruehstart' ? null : a === b ? null : a > b ? d.vonUser : d.anUser
            return (
              <div key={d.id}>
                <p className="text-sm">
                  {d.vonName} gegen {d.anName} <span className="text-mute">· {DUELL_ARTEN[d.art].name}{d.taetigkeit ? ` „${d.taetigkeit}“` : ''} · bis {endeText(d.bis)} · Einsatz {d.einsatz}</span>
                </p>
                {[
                  { user: d.vonUser, wert: d.vonWert },
                  { user: d.anUser, wert: d.anWert }
                ].map((s) => (
                  <div key={s.user} className="mt-1.5 flex items-center gap-3">
                    <span className={`w-20 shrink-0 truncate text-sm ${s.user === ich ? 'text-produktiv' : ''}`}>{name(d, s.user)}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                      {d.art !== 'fruehstart' && (
                        <div className={`h-full rounded-full transition-[width] duration-500 ${fuehrt === s.user ? 'bg-produktiv' : 'bg-ink/60'}`} style={{ width: `${((s.wert ?? 0) / max) * 100}%` }} />
                      )}
                    </div>
                    <span className="w-24 shrink-0 text-right text-sm tabular-nums">{wertText(d, s.wert)}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {wartend.length > 0 && (
        <p className="mt-3 text-xs text-dim">
          Wartet auf Antwort: {wartend.map((d) => `${d.anName} (${DUELL_ARTEN[d.art].name})`).join(', ')}
        </p>
      )}

      {schulden.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {schulden.map((d) => {
            const v = verlierer(d)
            return (
              <div key={d.id} className="flex items-center gap-2 text-sm">
                <Coffee size={14} strokeWidth={1.8} className="shrink-0 text-orange" />
                <span className="flex-1">
                  {v ? name(d, v) : '?'} schuldet {d.gewinner ? name(d, d.gewinner) : '?'} {d.einsatz}.
                </span>
                {(d.gewinner === ich || v === ich) && (
                  <button type="button" onClick={() => void einloesen(d.id)} className="rounded-chip bg-panel-2 px-2.5 py-1 text-xs text-ink transition-colors hover:bg-inaktiv">
                    Eingelöst
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {erledigt.length > 0 && (
        <div className="mt-3 divide-y divide-panel-2 text-xs text-mute">
          {erledigt.map((d) => (
            <p key={d.id} className="py-1.5">
              {d.status === 'abgelehnt'
                ? `${d.anName} hat das Duell von ${d.vonName} abgelehnt.`
                : d.unentschieden
                  ? `Unentschieden: ${d.vonName} gegen ${d.anName} (${DUELL_ARTEN[d.art].name}).`
                  : `${d.gewinner ? name(d, d.gewinner) : '?'} hat gegen ${verlierer(d) ? name(d, verlierer(d)!) : '?'} gewonnen (${DUELL_ARTEN[d.art].name}${d.taetigkeit ? ` „${d.taetigkeit}“` : ''}, ${wertText(d, d.vonWert)} zu ${wertText(d, d.anWert)}).`}
            </p>
          ))}
        </div>
      )}
    </Karte>
  )
}
