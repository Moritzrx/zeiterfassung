import { useEffect, useState, type ReactElement } from 'react'
import { Check, Lock, X } from 'lucide-react'
import {
  BELOHNUNGEN,
  PUNKTE_JE_LEVEL,
  SEASON_LEVEL_MAX,
  STIMMUNGEN,
  levelSchwelle,
  type Belohnung,
  type Kosmetik,
  type SeasonStand
} from '@shared/spiel'
import { datumVerschieben, datumZuTagesanfang } from '@shared/zeit'
import { Portal } from './Portal'
import { RangAbzeichen } from './RangAbzeichen'
import { hinweisZeigen } from './Hinweis'
import { stimmungAnwenden } from '../kosmetik'
import { fehlerText, kurzDatum } from '../format'
import { useErfassung } from '../erfassung'
import { rang } from '@shared/rang'

interface Props {
  stand: SeasonStand
  onSchliessen: () => void
  onGeaendert: () => void
}

function initialen(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Der Season Pass (22. September 2026): Level und Punkte, der Stand im Team, alle Belohnungen als Leiste und die Wahl
 * der freigeschalteten Kosmetik (Titel, Rahmen, Hintergrund). Titel und Rahmen sehen die anderen, der Hintergrund ist nur hier.
 */
export function SeasonDialog({ stand, onSchliessen, onGeaendert }: Props): ReactElement {
  const status = useErfassung()
  const [kosmetik, setKosmetik] = useState<Kosmetik>(stand.kosmetik)
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  const frei = (b: Belohnung): boolean => b.level <= stand.level
  const aktiv = (b: Belohnung): boolean =>
    (b.art === 'titel' && kosmetik.titel === b.schluessel) || (b.art === 'rahmen' && kosmetik.rahmen === b.schluessel) || (b.art === 'hintergrund' && kosmetik.hintergrund === b.schluessel)

  async function waehlen(art: Belohnung['art'], schluessel: string | null): Promise<void> {
    if (!window.api || laeuft) return
    setLaeuft(true)
    try {
      const neu = await window.api.spiel.kosmetikSetzen(art === 'titel' ? { titel: schluessel } : art === 'rahmen' ? { rahmen: schluessel } : { hintergrund: schluessel ?? 'standard' })
      setKosmetik(neu)
      if (art === 'hintergrund') {
        stimmungAnwenden(neu.hintergrund)
        window.dispatchEvent(new CustomEvent('stimmung-geaendert'))
      }
      onGeaendert()
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    } finally {
      setLaeuft(false)
    }
  }

  const von = levelSchwelle(stand.level)
  const bis = stand.level >= SEASON_LEVEL_MAX ? von : levelSchwelle(stand.level + 1)
  const anteil = stand.level >= SEASON_LEVEL_MAX ? 1 : Math.min(1, (stand.punkte - von) / PUNKTE_JE_LEVEL)
  const tageRest = Math.max(0, Math.round((datumZuTagesanfang(stand.season.ende).getTime() - Date.now()) / 86_400_000))
  const eigenerRang = rang(status.wocheProduktivSekunden)

  return (
    <Portal>
      <div className="animate-aufblenden fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" onClick={onSchliessen}>
        <div onClick={(e) => e.stopPropagation()} className="max-h-[calc(100vh-3rem)] w-full max-w-[720px] overscroll-contain overflow-y-auto rounded-card bg-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl">Season {stand.season.nummer}</h2>
              <p className="mt-1 text-sm text-mute">
                {kurzDatum(stand.season.start)} bis {kurzDatum(datumVerschieben(stand.season.ende, -1))} · noch {tageRest} {tageRest === 1 ? 'Tag' : 'Tage'}. Punkte gibt es für Daily
                Quests, Streaks, besiegte Bosse, gewonnene Duelle und Medaillen. Alle {PUNKTE_JE_LEVEL} Punkte ein Level, {SEASON_LEVEL_MAX} Level je Season.
              </p>
            </div>
            <button type="button" onClick={onSchliessen} className="rounded-chip p-1 text-mute hover:text-ink" title="Schließen">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-5">
            <div className="relative shrink-0">
              <RangAbzeichen rang={eigenerRang} groesse={84} rahmen={kosmetik.rahmen} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-3xl leading-none font-light">
                Level {stand.level} <span className="text-base text-mute">· {stand.punkte} Punkte</span>
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-orange transition-[width] duration-500" style={{ width: `${anteil * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-dim">{stand.level >= SEASON_LEVEL_MAX ? 'Höchstes Level erreicht.' : `Noch ${bis - stand.punkte} Punkte bis Level ${stand.level + 1}.`}</p>
            </div>
          </div>

          {stand.team.length > 0 && (
            <div className="mt-5">
              <p className="text-xs tracking-wide text-mute uppercase">Im Team</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {stand.team.map((p) => (
                  <span key={p.userId} className={`flex items-center gap-2 rounded-chip px-2.5 py-1.5 text-sm ${p.istIch ? 'bg-produktiv/20' : 'bg-panel-2'}`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${p.istIch ? 'bg-produktiv text-ground' : 'bg-panel text-ink'}`}>{initialen(p.name)}</span>
                    {p.name} · Lv {p.level} <span className="text-mute">· {p.punkte} P</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5">
            <p className="text-xs tracking-wide text-mute uppercase">Belohnungen</p>
            <div className="mt-2 divide-y divide-panel-2">
              {BELOHNUNGEN.map((b) => {
                const offen = frei(b)
                const gewaehlt = aktiv(b)
                return (
                  <div key={`${b.art}-${b.schluessel}`} className={`flex items-center gap-4 py-3 ${offen ? '' : 'opacity-55'}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${offen ? 'bg-orange/20 text-orange' : 'bg-panel-2 text-dim'}`}>
                      {offen ? b.level : <Lock size={14} strokeWidth={1.8} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {b.name} <span className="text-xs text-dim">· Level {b.level} · {b.art === 'titel' ? 'Titel' : b.art === 'rahmen' ? 'Wappenrahmen' : b.art === 'hintergrund' ? 'Hintergrund' : 'Symbol'}</span>
                      </p>
                      <p className="text-xs text-mute">{b.text}</p>
                    </div>
                    {b.art !== 'tray' &&
                      (gewaehlt ? (
                        <button
                          type="button"
                          onClick={() => void waehlen(b.art, null)}
                          className="flex items-center gap-1 rounded-chip bg-produktiv/20 px-2.5 py-1 text-xs text-produktiv"
                          title="Wieder abwählen"
                        >
                          <Check size={13} strokeWidth={2} /> Aktiv
                        </button>
                      ) : offen ? (
                        <button type="button" onClick={() => void waehlen(b.art, b.schluessel)} className="rounded-chip bg-panel-2 px-2.5 py-1 text-xs text-ink transition-colors hover:bg-inaktiv">
                          Wählen
                        </button>
                      ) : null)}
                    {b.art === 'tray' && offen && <span className="text-xs text-produktiv">Aktiv</span>}
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-dim">
              Hintergründe: {Object.values(STIMMUNGEN).map((s) => s.name).join(', ')}. Titel und Rahmen sehen die anderen auf dem Team-Screen, der Hintergrund gilt nur auf
              diesem Rechner.
            </p>
          </div>
        </div>
      </div>
    </Portal>
  )
}
