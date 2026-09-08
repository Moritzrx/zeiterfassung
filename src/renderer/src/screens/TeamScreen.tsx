import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { STANDARD_GESAMTZIEL, level } from '@shared/level'
import type { TeamMitglied, Ziel } from '@shared/typen'
import { Karte } from '../components/Karte'
import { TeamBalken, type Teamwert } from '../components/TeamBalken'
import { useErfassung } from '../erfassung'
import { stundenText, uhrzeit } from '../format'

function initialen(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? '')
    .join('')
}

/** Screen 4: Team. Alle drei nebeneinander, sortiert nach Level, plus der Vergleich als Balken. Kein Firlefanz. */
export function TeamScreen(): ReactElement {
  const status = useErfassung()
  const [mitglieder, setMitglieder] = useState<TeamMitglied[]>([])
  const [ziele, setZiele] = useState<Ziel[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const [stand, setStand] = useState<string | null>(null)

  const laden = useCallback(async () => {
    if (!window.api) return
    try {
      const [team, alleZiele] = await Promise.all([window.api.team.stand(), window.api.ziele.alle()])
      setMitglieder(team)
      setZiele(alleZiele)
      setFehler(null)
      setStand(new Date().toISOString())
    } catch (e) {
      setFehler(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(e))
    }
  }, [])

  useEffect(() => {
    void laden()
    const timer = setInterval(() => void laden(), 60_000)
    return () => clearInterval(timer)
  }, [laden])

  const zeilen = useMemo(() => {
    return mitglieder
      .map((m) => {
        const sekunden = m.istIch ? status.wocheProduktivSekunden : m.produktiveSekunden
        const gesamtziel =
          ziele.find((z) => z.userId === m.userId && z.taetigkeit === null)?.stundenProWoche ?? STANDARD_GESAMTZIEL
        return { ...m, sekunden, level: level(sekunden), gesamtziel }
      })
      .sort((a, b) => b.level - a.level || b.sekunden - a.sekunden)
  }, [mitglieder, ziele, status.wocheProduktivSekunden])

  const balken: Teamwert[] = zeilen.map((z) => ({
    name: z.name,
    titel: z.name,
    stunden: z.sekunden / 3600,
    ziel: z.gesamtziel,
    istIch: z.istIch
  }))

  return (
    <div className="flex flex-col gap-4 pt-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-light">Team</h1>
        {stand && <p className="text-xs text-dim">Stand {uhrzeit(stand)}, Abgleich alle 60 Sekunden</p>}
      </div>

      {fehler && <p className="rounded-card bg-panel p-4 text-sm text-mute">{fehler}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {zeilen.map((z) => {
          const anteil = Math.min(1, z.sekunden / (z.gesamtziel * 3600))
          const geschafft = z.sekunden >= z.gesamtziel * 3600
          return (
            <Karte key={z.userId} className="flex flex-col items-center text-center">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full text-lg ${
                  z.istIch ? 'bg-ink text-ground' : 'bg-panel-2 text-ink'
                }`}
              >
                {initialen(z.name)}
              </div>
              <p className="mt-3 text-base">{z.name}</p>
              <p className="mt-3 text-[40px] leading-none font-light">{z.level}</p>
              <p className="text-xs text-mute">Level</p>
              <p className="mt-3 text-sm">
                {stundenText(z.sekunden)} h <span className="text-mute">von {stundenText(z.gesamtziel * 3600)} h</span>
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-panel-2">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${geschafft ? 'bg-produktiv' : 'bg-ink'}`}
                  style={{ width: `${anteil * 100}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-dim">
                {z.istIch ? 'live' : z.zuletztSync ? `zuletzt gemeldet ${uhrzeit(z.zuletztSync)}` : 'noch nichts gemeldet'}
              </p>
            </Karte>
          )
        })}
      </div>

      {zeilen.length > 0 && (
        <Karte>
          <p className="text-xs tracking-wide text-mute uppercase">Wochenstunden im Vergleich</p>
          <div className="mt-3">
            <TeamBalken werte={balken} />
          </div>
        </Karte>
      )}
    </div>
  )
}
