import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { STANDARD_GESAMTZIEL, rang, rangName, zielRang } from '@shared/rang'
import type { TeamMitglied, TeamWoche, Ziel } from '@shared/typen'
import { berlinDatum, datumVerschieben, datumZuTagesanfang, kalenderwoche, wochenanfang } from '@shared/zeit'
import { Karte } from '../components/Karte'
import { LigaRangliste } from '../components/LigaRangliste'
import { RangAbzeichen } from '../components/RangAbzeichen'
import { RangUebersicht } from '../components/RangUebersicht'
import { TeamBalken, type Teamwert } from '../components/TeamBalken'
import { TeamVerlauf, type Verlaufsperson, type Verlaufswoche } from '../components/TeamVerlauf'
import { useErfassung } from '../erfassung'
import { kurzDatum, stundenText, uhrzeit } from '../format'

const ZEITRAEUME = [
  { wochen: 4, label: '4 Wochen' },
  { wochen: 12, label: '12 Wochen' },
  { wochen: 26, label: '6 Monate' },
  { wochen: 52, label: '12 Monate' }
] as const
const SPEICHER_SCHLUESSEL = 'team.zeitraum'
/** Die eigene Linie ist grün, die der anderen blau und lila. */
const EIGENE_FARBE = '#00C076'
const FARBEN = ['#38BDF8', '#A78BFA', '#FBBF24', '#FB7185']

function initialen(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? '')
    .join('')
}

function gespeicherterZeitraum(): number {
  try {
    const wert = Number(localStorage.getItem(SPEICHER_SCHLUESSEL))
    return ZEITRAEUME.some((z) => z.wochen === wert) ? wert : 12
  } catch {
    return 12
  }
}

/** Screen 4: Team. Stand der laufenden Woche mit Rang-Abzeichen, dazu Verlauf und Rangliste über einen wählbaren Zeitraum. */
export function TeamScreen(): ReactElement {
  const status = useErfassung()
  const [mitglieder, setMitglieder] = useState<TeamMitglied[]>([])
  const [ziele, setZiele] = useState<Ziel[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const [stand, setStand] = useState<string | null>(null)
  const [wochenAnzahl, setWochenAnzahl] = useState<number>(gespeicherterZeitraum)
  const [teamWochen, setTeamWochen] = useState<TeamWoche[]>([])
  const [verlaufFehler, setVerlaufFehler] = useState<string | null>(null)
  const [uebersichtOffen, setUebersichtOffen] = useState(false)

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

  const verlaufLaden = useCallback(async () => {
    if (!window.api) return
    const heute = berlinDatum(new Date())
    const von = datumVerschieben(berlinDatum(wochenanfang(new Date())), -7 * (wochenAnzahl - 1))
    try {
      setTeamWochen(await window.api.team.wochen(von, heute))
      setVerlaufFehler(null)
    } catch (e) {
      setTeamWochen([])
      setVerlaufFehler(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(e))
    }
  }, [wochenAnzahl])

  useEffect(() => {
    void laden()
    const timer = setInterval(() => void laden(), 60_000)
    return () => clearInterval(timer)
  }, [laden])

  useEffect(() => {
    void verlaufLaden()
    const timer = setInterval(() => void verlaufLaden(), 5 * 60_000)
    return () => clearInterval(timer)
  }, [verlaufLaden])

  function zeitraumWaehlen(neu: number): void {
    setWochenAnzahl(neu)
    try {
      localStorage.setItem(SPEICHER_SCHLUESSEL, String(neu))
    } catch {
      // Merken ist optional
    }
  }

  const zeilen = useMemo(() => {
    return mitglieder
      .map((m) => {
        const sekunden = m.istIch ? status.wocheProduktivSekunden : m.produktiveSekunden
        const gesamtziel =
          ziele.find((z) => z.userId === m.userId && z.taetigkeit === null)?.stundenProWoche ?? STANDARD_GESAMTZIEL
        return { ...m, sekunden, rang: rang(sekunden), gesamtziel }
      })
      .sort((a, b) => b.rang - a.rang || b.sekunden - a.sekunden)
  }, [mitglieder, ziele, status.wocheProduktivSekunden])

  const balken: Teamwert[] = zeilen.map((z) => ({
    name: z.name,
    titel: z.name,
    stunden: z.sekunden / 3600,
    ziel: z.gesamtziel,
    istIch: z.istIch
  }))

  // Verlauf: eine Zeile je Woche, Spalten je Person; Rangliste über den Zeitraum
  const { verlauf, personen, rangliste } = useMemo(() => {
    const namen = new Map<string, { name: string; istIch: boolean; gesamt: number; zielWochen: number }>()
    const eigeneId = mitglieder.find((m) => m.istIch)?.userId
    for (const w of teamWochen) {
      const e = namen.get(w.userId) ?? { name: w.name, istIch: w.userId === eigeneId, gesamt: 0, zielWochen: 0 }
      e.gesamt += w.produktiveSekunden
      const gesamtziel = ziele.find((z) => z.userId === w.userId && z.taetigkeit === null)?.stundenProWoche ?? STANDARD_GESAMTZIEL
      if (rang(w.produktiveSekunden) >= zielRang(gesamtziel)) e.zielWochen++
      namen.set(w.userId, e)
    }
    const personenListe: Verlaufsperson[] = []
    let farbe = 0
    for (const e of namen.values()) {
      personenListe.push({ name: e.name, istIch: e.istIch, farbe: e.istIch ? EIGENE_FARBE : FARBEN[farbe++ % FARBEN.length] })
    }
    const wochenMap = new Map<string, Verlaufswoche>()
    for (const w of teamWochen) {
      const kw = kalenderwoche(datumZuTagesanfang(w.wocheStart))
      const zeile =
        wochenMap.get(w.wocheStart) ??
        ({
          label: `KW ${kw}`,
          titel: `KW ${kw} · ${kurzDatum(w.wocheStart)} bis ${kurzDatum(datumVerschieben(w.wocheStart, 6))}`
        } as Verlaufswoche)
      zeile[w.name] = w.produktiveSekunden / 3600
      wochenMap.set(w.wocheStart, zeile)
    }
    const verlaufListe = [...wochenMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map((e) => e[1])
    const rangListe = [...namen.values()].sort((a, b) => b.gesamt - a.gesamt)
    return { verlauf: verlaufListe, personen: personenListe, rangliste: rangListe }
  }, [teamWochen, mitglieder, ziele])

  const anzahlWochen = verlauf.length
  const zielStunden = zeilen[0]?.gesamtziel ?? STANDARD_GESAMTZIEL
  const zeitraumLabel = ZEITRAEUME.find((z) => z.wochen === wochenAnzahl)?.label ?? `${wochenAnzahl} Wochen`

  return (
    <div className="flex flex-col gap-4 pt-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-light">Team</h1>
        <div className="flex items-baseline gap-4">
          <button
            type="button"
            onClick={() => setUebersichtOffen(true)}
            className="knopf-primaer rounded-chip px-4 py-2 text-sm"
          >
            Alle Ränge
          </button>
          {stand && <p className="text-xs text-dim">Stand {uhrzeit(stand)}, Abgleich alle 60 Sekunden</p>}
        </div>
      </div>

      {fehler && <p className="rounded-card bg-panel p-4 text-sm text-mute">{fehler}</p>}

      {uebersichtOffen && (
        <RangUebersicht aktuellerRang={rang(status.wocheProduktivSekunden)} onSchliessen={() => setUebersichtOffen(false)} />
      )}

      <LigaRangliste />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {zeilen.map((z) => {
          const anteil = Math.min(1, z.sekunden / (z.gesamtziel * 3600))
          const geschafft = z.sekunden >= z.gesamtziel * 3600
          return (
            <Karte key={z.userId} className="flex flex-col items-center text-center">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full text-base ${
                  z.istIch ? 'bg-produktiv text-ground' : 'bg-panel-2 text-ink'
                }`}
              >
                {initialen(z.name)}
              </div>
              <p className="mt-2 text-base">{z.name}</p>
              <div className="mt-3">
                <RangAbzeichen rang={z.rang} groesse={64} />
              </div>
              <p className="mt-2 text-sm">
                Rang {z.rang} <span className="text-mute">· {rangName(z.rang)}</span>
              </p>
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
          <p className="text-xs tracking-wide text-mute uppercase">Diese Woche im Vergleich</p>
          <div className="mt-3">
            <TeamBalken werte={balken} />
          </div>
        </Karte>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-light">Verlauf und Rangliste</h2>
        <div className="flex gap-1 rounded-chip bg-panel p-1">
          {ZEITRAEUME.map((z) => (
            <button
              key={z.wochen}
              type="button"
              onClick={() => zeitraumWaehlen(z.wochen)}
              className={`rounded-chip px-3 py-1.5 text-sm transition-colors ${
                wochenAnzahl === z.wochen ? 'bg-panel-2 text-ink' : 'text-mute hover:text-ink'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      {verlaufFehler ? (
        <p className="rounded-card bg-panel p-4 text-sm text-mute">{verlaufFehler}</p>
      ) : (
        <>
          <Karte>
            <p className="text-xs tracking-wide text-mute uppercase">Produktive Stunden je Woche, letzte {zeitraumLabel}</p>
            <div className="mt-3">
              <TeamVerlauf wochen={verlauf} personen={personen} ziel={zielStunden} />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-mute">
              {personen.map((p) => (
                <span key={p.name} className="flex items-center gap-2">
                  <span className="inline-block h-2 w-4 rounded-full" style={{ background: p.farbe }} />
                  {p.name}
                </span>
              ))}
            </div>
          </Karte>

          <Karte>
            <p className="text-xs tracking-wide text-mute uppercase">Rangliste, letzte {zeitraumLabel}</p>
            <div className="mt-2 divide-y divide-panel-2">
              {rangliste.map((r, i) => (
                <div key={r.name} className="flex items-center gap-4 py-3">
                  <span className={`w-6 text-lg font-light ${i === 0 ? 'text-orange' : 'text-mute'}`}>{i + 1}.</span>
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                      r.istIch ? 'bg-produktiv text-ground' : 'bg-panel-2 text-ink'
                    }`}
                  >
                    {initialen(r.name)}
                  </span>
                  <span className="flex-1 text-sm">{r.name}</span>
                  <span className="text-sm text-mute">
                    {r.zielWochen} von {anzahlWochen} Wochen auf Ziel
                  </span>
                  <span className="w-24 text-right text-sm">{stundenText(r.gesamt)} h</span>
                </div>
              ))}
            </div>
          </Karte>
        </>
      )}
    </div>
  )
}
