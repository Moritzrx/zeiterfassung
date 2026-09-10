import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import type { Block } from '@shared/typen'
import { berlinDatum, berlinTeile, berlinZuUtc } from '@shared/zeit'
import { zeilenBilden } from '../zeilen'
import { BlockDialog } from '../components/BlockDialog'
import { BlockZeile } from '../components/BlockZeile'
import { hinweisZeigen } from '../components/Hinweis'
import { tonSpielen } from '../toene'
import { Karte } from '../components/Karte'
import { useErfassung } from '../erfassung'
import { dauerText } from '../format'
import { useTaetigkeiten } from '../taetigkeiten'

const FELD =
  'w-full rounded-chip bg-panel-2 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim'

function zweistellig(n: number): string {
  return String(n).padStart(2, '0')
}

/** "HH:MM" um Minuten verschieben, bleibt innerhalb des Tages. */
function zeitPlus(zeit: string, minuten: number): string {
  const [h, m] = zeit.split(':').map(Number)
  const gesamt = Math.min(23 * 60 + 59, h * 60 + m + minuten)
  return `${zweistellig(Math.floor(gesamt / 60))}:${zweistellig(gesamt % 60)}`
}

/** Datum "JJJJ-MM-TT" und "HH:MM" (Berlin) in einen Zeitpunkt umrechnen. */
function zeitpunkt(datum: string, zeit: string): Date | null {
  if (!datum || !zeit) return null
  const [jahr, monat, tag] = datum.split('-').map(Number)
  const [stunde, minute] = zeit.split(':').map(Number)
  if ([jahr, monat, tag, stunde, minute].some((n) => Number.isNaN(n))) return null
  return berlinZuUtc(jahr, monat, tag, stunde, minute)
}

/** Screen 5: Eintragen. Zeiten von Hand für alles, was nicht am Rechner passiert. */
export function EintragenScreen(): ReactElement {
  const status = useErfassung()
  const taetigkeiten = useTaetigkeiten()
  const [datum, setDatum] = useState(() => berlinDatum(new Date()))
  const [von, setVon] = useState('09:00')
  const [bis, setBis] = useState('10:00')
  const [taetigkeit, setTaetigkeit] = useState('')
  const [notiz, setNotiz] = useState('')
  const [ueberschneidungen, setUeberschneidungen] = useState<Block[]>([])
  const [loeschen, setLoeschen] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [zuletzt, setZuletzt] = useState<Block[]>([])
  const [bearbeiten, setBearbeiten] = useState<Block | null>(null)

  const start = useMemo(() => zeitpunkt(datum, von), [datum, von])
  const ende = useMemo(() => zeitpunkt(datum, bis), [datum, bis])
  const gueltig = !!start && !!ende && ende > start
  const dauer = gueltig ? (ende.getTime() - start.getTime()) / 1000 : 0

  const listeLaden = useCallback(async () => {
    if (!window.api) return
    setZuletzt(await window.api.bloecke.manuelleListe(10))
  }, [])

  useEffect(() => {
    void listeLaden()
    if (!window.api) return
    return window.api.bloecke.onAenderung(() => void listeLaden())
  }, [listeLaden])

  // Überschneidung mit automatischen Blöcken prüfen, sobald sich die Zeiten ändern.
  useEffect(() => {
    if (!window.api || !gueltig || !start || !ende) {
      setUeberschneidungen([])
      return
    }
    let aktuell = true
    const timer = setTimeout(async () => {
      const bloecke = await window.api.bloecke.zeitraum(start.toISOString(), ende.toISOString())
      if (!aktuell) return
      setUeberschneidungen(bloecke.filter((b) => b.quelle === 'auto' && b.id !== status.laufenderBlock?.id))
    }, 300)
    return () => {
      aktuell = false
      clearTimeout(timer)
    }
  }, [gueltig, start, ende, status.laufenderBlock?.id])

  async function speichern(ereignis: FormEvent, naechster: boolean): Promise<void> {
    ereignis.preventDefault()
    if (!window.api || !start || !ende) return
    setLaeuft(true)
    setFehler(null)
    try {
      const block = await window.api.bloecke.manuellAnlegen({
        start: start.toISOString(),
        ende: ende.toISOString(),
        taetigkeit,
        notiz: notiz || null
      })
      let zusatz = ''
      if (loeschen && ueberschneidungen.length > 0) {
        const n = await window.api.bloecke.mehrereAendern(
          ueberschneidungen.map((b) => b.id),
          { loeschen: true }
        )
        zusatz = `, ${n} automatische Blöcke gelöscht`
      }
      tonSpielen('erfolg')
      hinweisZeigen(`Eingetragen: ${block.taetigkeit}, ${dauerText(dauer)}${zusatz}.`)
      setTaetigkeit('')
      setNotiz('')
      setLoeschen(false)
      if (naechster) {
        // Der nächste Eintrag beginnt, wo dieser aufhört.
        setVon(bis)
        setBis(zeitPlus(bis, 60))
      }
    } catch (e) {
      setFehler(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(e))
    } finally {
      setLaeuft(false)
    }
  }

  const ueberschneidungsSekunden = ueberschneidungen.reduce((s, b) => {
    if (!start || !ende) return s
    const a = Math.max(Date.parse(b.start), start.getTime())
    const z = Math.min(Date.parse(b.ende), ende.getTime())
    return z > a ? s + (z - a) / 1000 : s
  }, 0)

  // Die überschneidenden Blöcke als Liste (zusammenhängende Abschnitte gebündelt), damit man sieht, was der
  // Rechner in der Zeit aufgezeichnet hat, z. B. "Nicht am Rechner 12:10 bis 12:30" während des Telefonats.
  const ueberschneidungZeilen = useMemo(
    () => zeilenBilden([...ueberschneidungen].sort((a, b) => a.start.localeCompare(b.start)), null),
    [ueberschneidungen]
  )

  /** Zeiten eines Blocks in die Felder übernehmen (Uhrzeit in Berliner Zeit, auf den Tag begrenzt). */
  function zeitenUebernehmen(startIso: string, endeIso: string): void {
    const a = berlinTeile(new Date(startIso))
    const z = berlinTeile(new Date(endeIso))
    const gleicherTag = berlinDatum(new Date(endeIso)) === datum
    setVon(`${zweistellig(a.stunde)}:${zweistellig(a.minute)}`)
    setBis(gleicherTag ? `${zweistellig(z.stunde)}:${zweistellig(z.minute)}` : '23:59')
  }

  return (
    <div className="flex flex-col gap-4 pt-6">
      <h1 className="text-2xl font-light">Eintragen</h1>
      <p className="text-sm text-mute">Für alles, was nicht am Rechner passiert: Drehs, Kundentermine, Telefonate, Fahrten.</p>

      <form onSubmit={(e) => void speichern(e, false)} className="mt-2">
        <Karte>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-mute">
              Datum
              <input className={FELD} type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-xs text-mute">
              Von
              <input className={FELD} type="time" value={von} onChange={(e) => setVon(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-xs text-mute">
              Bis
              <input className={FELD} type="time" value={bis} onChange={(e) => setBis(e.target.value)} required />
            </label>
          </div>
          <p className={`mt-2 text-xs ${gueltig ? 'text-mute' : 'text-unproduktiv'}`}>
            {gueltig ? `Dauer ${dauerText(dauer)}` : 'Das Ende muss nach dem Anfang liegen.'}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-mute">
              Tätigkeit
              <input
                className={FELD}
                list="taetigkeiten-eintragen"
                value={taetigkeit}
                onChange={(e) => setTaetigkeit(e.target.value)}
                placeholder="z. B. Dreh, Kundentermin, Fahrt"
                required
              />
              <datalist id="taetigkeiten-eintragen">
                {taetigkeiten.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-xs text-mute">
              Notiz
              <input className={FELD} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="optional, z. B. Kunde oder Ort" />
            </label>
          </div>

          {ueberschneidungen.length > 0 && (
            <div className="mt-4 rounded-card bg-panel-2/60 p-4 text-sm">
              <p>
                Überschneidet sich mit {ueberschneidungen.length}{' '}
                {ueberschneidungen.length === 1 ? 'automatischen Block' : 'automatischen Blöcken'} (
                {dauerText(ueberschneidungsSekunden)}). Der Rechner lief in dieser Zeit mit. Das hat er aufgezeichnet:
              </p>
              <div className="mt-2 divide-y divide-panel-2">
                {ueberschneidungZeilen.map((z) => (
                  <BlockZeile
                    key={z.id}
                    block={z.block}
                    abschnitte={z.bloecke.length}
                    sekunden={z.sekunden}
                    onClick={() => zeitenUebernehmen(z.block.start, z.block.ende)}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-dim">Zeile antippen: Von und Bis übernehmen, etwa für ein Telefonat, das genau in „Nicht am Rechner“ fällt.</p>
              <label className="mt-3 flex cursor-pointer items-center gap-3 text-mute">
                <input type="checkbox" checked={loeschen} onChange={(e) => setLoeschen(e.target.checked)} className="h-4 w-4" />
                Diese automatischen Blöcke löschen, damit die Zeit nicht doppelt zählt
              </label>
            </div>
          )}

          {fehler && <p className="mt-3 text-sm text-unproduktiv">{fehler}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={laeuft || !gueltig || !taetigkeit.trim()}
              onClick={(e) => void speichern(e, true)}
              className="rounded-chip px-4 py-2 text-sm text-mute transition-colors hover:bg-panel-2 hover:text-ink disabled:opacity-40"
            >
              Speichern und nächsten
            </button>
            <button
              type="submit"
              disabled={laeuft || !gueltig || !taetigkeit.trim()}
              className="rounded-chip bg-ink px-4 py-2 text-sm font-medium text-ground transition-opacity disabled:opacity-40"
            >
              Speichern
            </button>
          </div>
        </Karte>
      </form>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Zuletzt eingetragen</p>
        {zuletzt.length === 0 ? (
          <p className="mt-2 text-sm text-dim">Noch nichts von Hand eingetragen.</p>
        ) : (
          <div className="mt-1 divide-y divide-panel-2">
            {zuletzt.map((b) => (
              <BlockZeile key={b.id} block={b} onClick={() => setBearbeiten(b)} />
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-dim">Zum Ändern oder Löschen auf einen Eintrag klicken.</p>
      </Karte>

      {bearbeiten && (
        <BlockDialog
          key={bearbeiten.id}
          block={bearbeiten}
          taetigkeiten={taetigkeiten}
          onSchliessen={() => setBearbeiten(null)}
          onGespeichert={() => {
            setBearbeiten(null)
            void listeLaden()
          }}
        />
      )}
    </div>
  )
}
