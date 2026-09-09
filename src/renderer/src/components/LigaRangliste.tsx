import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { URLAUB_WOCHENTAGE, deltaText, liga, wirksamesDelta, wochenPrognose } from '@shared/liga'
import { STANDARD_GESAMTZIEL } from '@shared/rang'
import type { LigaStand, TeamMitglied, Urlaub, Ziel } from '@shared/typen'
import { fehlerText, zahlText } from '../format'
import { Karte } from './Karte'
import { LigaAbzeichen } from './LigaAbzeichen'
import { useArbeitstage } from '../arbeitstage'

/**
 * Die Liga-Rangliste des Teams: wer steht mit wie vielen Trophäen in welcher Liga, dazu je Person
 * die Hochrechnung der laufenden Woche (gleiche Formel wie auf der eigenen Liga-Karte, mit den
 * Wochenstunden aus team_stand, dem persönlichen Ziel und den hinterlegten Urlauben).
 */
export function LigaRangliste(): ReactElement {
  const [stand, setStand] = useState<LigaStand[]>([])
  const [team, setTeam] = useState<TeamMitglied[]>([])
  const [ziele, setZiele] = useState<Ziel[]>([])
  const [urlaube, setUrlaube] = useState<Urlaub[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const arbeitstageWert = useArbeitstage()

  const laden = useCallback(async () => {
    if (!window.api) return
    try {
      const [s, t, z, u] = await Promise.all([
        window.api.liga.stand(),
        window.api.team.stand().catch(() => [] as TeamMitglied[]),
        window.api.ziele.alle().catch(() => [] as Ziel[]),
        window.api.urlaub.alle().catch(() => [] as Urlaub[])
      ])
      setStand(s)
      setTeam(t)
      setZiele(z)
      setUrlaube(u)
      setFehler(null)
    } catch (e) {
      setFehler(fehlerText(e))
    }
  }, [])

  useEffect(() => {
    void laden()
    const timer = setInterval(() => void laden(), 5 * 60_000)
    return () => clearInterval(timer)
  }, [laden])

  const sortiert = [...stand].sort((a, b) => b.trophaeen - a.trophaeen || a.name.localeCompare(b.name))

  /** Hochrechnung dieser Woche für eine Person: Text und Farbe. */
  function prognose(s: LigaStand): { text: string; farbe: string } {
    const sekunden = team.find((m) => m.userId === s.userId)?.produktiveSekunden ?? 0
    const gesamtziel = ziele.find((z) => z.userId === s.userId && !z.taetigkeit)?.stundenProWoche ?? STANDARD_GESAMTZIEL
    const eigene = urlaube.filter((u) => u.userId === s.userId)
    // Für alle gilt die Einstellung dieses Rechners (das Team arbeitet gleich lang).
    const p = wochenPrognose(sekunden, gesamtziel, eigene, new Date(), null, arbeitstageWert)
    if (p.urlaubstage >= URLAUB_WOCHENTAGE) return { text: 'diese Woche Urlaub', farbe: 'text-dim' }
    if (p.art === 'zu-frueh') return { text: 'Prognose ab Montagmittag', farbe: 'text-dim' }
    const wirksam = wirksamesDelta(s.trophaeen, p.delta)
    const wort = p.art === 'stand' ? 'diese Woche' : 'voraussichtlich'
    return { text: `${wort} ${deltaText(wirksam)}`, farbe: wirksam > 0 ? 'text-produktiv' : wirksam < 0 ? 'text-unproduktiv' : 'text-mute' }
  }

  return (
    <Karte>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs tracking-wide text-mute uppercase">Liga</p>
        <p className="text-xs text-dim">Trophäen aus allen abgeschlossenen Wochen</p>
      </div>
      {fehler && <p className="mt-3 text-sm text-mute">{fehler}</p>}
      <div className="mt-3 flex flex-col gap-1">
        {sortiert.map((s, i) => {
          const l = liga(s.trophaeen)
          const p = prognose(s)
          return (
            <div
              key={s.userId}
              className={`flex items-center gap-4 rounded-chip px-3 py-2.5 ${s.istIch ? 'bg-panel-2' : ''}`}
            >
              <span className="w-5 text-sm text-mute">{i + 1}.</span>
              <LigaAbzeichen liga={l} groesse={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {s.name}
                  {s.istIch && <span className="text-mute"> · du</span>}
                  {s.imUrlaub && <span className="ml-2 rounded-chip bg-panel-2 px-1.5 py-0.5 text-xs text-mute">im Urlaub</span>}
                </p>
                <p className="text-xs text-mute">{l.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">{zahlText(s.trophaeen, 0)}</p>
                <p className={`text-xs ${p.farbe}`}>{p.text}</p>
                <p className="text-xs text-dim">
                  {s.letztesDelta === null ? 'noch keine Woche gezählt' : `letzte Woche ${deltaText(s.letztesWirksam ?? s.letztesDelta)}`}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </Karte>
  )
}
