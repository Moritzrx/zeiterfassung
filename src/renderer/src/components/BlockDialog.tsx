import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import { X } from 'lucide-react'
import type { Bewertung, Block, RegelBewertung } from '@shared/typen'
import { musterVorschlag } from '@shared/regeln'
import { berlinDatum, berlinTeile, berlinZuUtc } from '@shared/zeit'
import { datumText, dauerText } from '../format'
import { hinweisZeigen } from './Hinweis'

interface Props {
  block: Block
  /** Mehrere Blöcke desselben Programms auf einmal: die Entscheidung gilt für alle */
  gruppe?: Block[]
  taetigkeiten: string[]
  /** Beim Durchgehen: Nummer und Gesamtzahl */
  fortschritt?: { nummer: number; gesamt: number }
  onSchliessen: () => void
  onGespeichert: () => void
  onUeberspringen?: () => void
}

const BROWSER = ['Google Chrome', 'Microsoft Edge', 'Firefox', 'Safari', 'Opera', 'Brave', 'Arc']
const FELD =
  'w-full rounded-chip bg-panel-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim'

function zweistellig(n: number): string {
  return String(n).padStart(2, '0')
}

function zeitFeld(iso: string): string {
  const t = berlinTeile(new Date(iso))
  return `${zweistellig(t.stunde)}:${zweistellig(t.minute)}`
}

function Wahl({
  aktiv,
  onClick,
  farbe,
  children
}: {
  aktiv: boolean
  onClick: () => void
  farbe: string
  children: string
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-chip px-3 py-2 text-sm transition-colors ${
        aktiv ? 'bg-panel-2 text-ink' : 'text-mute hover:text-ink'
      }`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${farbe}`} />
      {children}
    </button>
  )
}

/** Dialog zum Bearbeiten eines Blocks: Tätigkeit, Bewertung, Zeiten, Notiz, Löschen, Regel anlegen. */
export function BlockDialog({
  block,
  gruppe,
  taetigkeiten,
  fortschritt,
  onSchliessen,
  onGespeichert,
  onUeberspringen
}: Props): ReactElement {
  const istInaktiv = block.bewertung === 'inaktiv'
  const istManuell = block.quelle === 'manuell'
  const istBrowser = BROWSER.includes(block.programm ?? '')
  const istGruppe = !!gruppe && gruppe.length > 1
  const gruppeIds = (gruppe ?? [block]).map((b) => b.id)
  const gruppeSekunden = (gruppe ?? [block]).reduce((s, b) => s + (Date.parse(b.ende) - Date.parse(b.start)) / 1000, 0)
  const gruppeTitel = [...new Set((gruppe ?? []).map((b) => b.fenstertitel).filter((t): t is string => !!t))]
  const [taetigkeit, setTaetigkeit] = useState(block.taetigkeit ?? '')
  const [bewertung, setBewertung] = useState<Bewertung>(
    block.bewertung === 'ungeklaert' ? 'produktiv' : block.bewertung
  )
  const [von, setVon] = useState(zeitFeld(block.start))
  const [bis, setBis] = useState(zeitFeld(block.ende))
  const [notiz, setNotiz] = useState(block.notiz ?? '')
  const [immer, setImmer] = useState(false)
  const [feld, setFeld] = useState<'programm' | 'titel'>(block.fenstertitel && istBrowser && !istGruppe ? 'titel' : 'programm')
  const [muster, setMuster] = useState(musterVorschlag(block.fenstertitel))
  const [fuerAlle, setFuerAlle] = useState(false)
  const [loeschenBestaetigen, setLoeschenBestaetigen] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  const regelMoeglich = !istManuell && !!block.programm && bewertung !== 'inaktiv'

  async function speichern(ereignis: FormEvent): Promise<void> {
    ereignis.preventDefault()
    if (!window.api) return
    setLaeuft(true)
    setFehler(null)
    try {
      const aenderung: Parameters<typeof window.api.bloecke.aendern>[1] = {
        taetigkeit: taetigkeit.trim() || null,
        bewertung,
        notiz
      }
      if (istGruppe) {
        // Für die ganze Gruppe: Zeiten bleiben, die Notiz nur, wenn eine eingetragen wurde.
        const fuerAlle: typeof aenderung = { taetigkeit: aenderung.taetigkeit, bewertung }
        if (notiz.trim()) fuerAlle.notiz = notiz
        const n = await window.api.bloecke.mehrereAendern(gruppeIds, fuerAlle)
        hinweisZeigen(`${n} Blöcke zugeordnet.`)
      } else if (von !== zeitFeld(block.start) || bis !== zeitFeld(block.ende)) {
        const [jahr, monat, tag] = berlinDatum(new Date(block.start)).split('-').map(Number)
        const [vh, vm] = von.split(':').map(Number)
        const [bh, bm] = bis.split(':').map(Number)
        const start = berlinZuUtc(jahr, monat, tag, vh, vm)
        let ende = berlinZuUtc(jahr, monat, tag, bh, bm)
        if (ende <= start) ende = berlinZuUtc(jahr, monat, tag + 1, bh, bm)
        aenderung.start = start.toISOString()
        aenderung.ende = ende.toISOString()
      }
      if (!istGruppe) await window.api.bloecke.aendern(block.id, aenderung)

      if (immer && regelMoeglich) {
        const ergebnis = await window.api.regeln.anlegen({
          muster: feld === 'programm' ? (block.programm ?? '') : muster,
          feld,
          taetigkeit: taetigkeit.trim() || null,
          bewertung: bewertung as RegelBewertung,
          fuerAlle
        })
        hinweisZeigen(
          ergebnis.neuBewertet === 0
            ? 'Regel angelegt.'
            : `Regel angelegt, ${ergebnis.neuBewertet} weitere Blöcke neu bewertet.`
        )
      }
      onGespeichert()
    } catch (e) {
      setFehler(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(e))
    } finally {
      setLaeuft(false)
    }
  }

  async function loeschen(): Promise<void> {
    if (!loeschenBestaetigen) {
      setLoeschenBestaetigen(true)
      return
    }
    if (!window.api) return
    if (istGruppe) {
      const n = await window.api.bloecke.mehrereAendern(gruppeIds, { loeschen: true })
      hinweisZeigen(`${n} Blöcke gelöscht.`)
    } else {
      await window.api.bloecke.aendern(block.id, { loeschen: true })
      hinweisZeigen('Block gelöscht.')
    }
    onGespeichert()
  }

  const titel = istGruppe
    ? `${block.programm ?? 'Unbekanntes Programm'} · ${gruppeIds.length} Blöcke`
    : istInaktiv
      ? 'Inaktive Zeit'
      : istManuell
        ? (block.taetigkeit ?? 'Von Hand eingetragen')
        : (block.programm ?? 'Block')

  return (
    <div className="animate-aufblenden fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onSchliessen}>
      <form
        onSubmit={speichern}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[720px] overflow-y-auto rounded-t-card bg-panel p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {fortschritt && (
              <p className="text-xs tracking-wide text-mute uppercase">
                Block {fortschritt.nummer} von {fortschritt.gesamt}
              </p>
            )}
            <h2 className="truncate text-xl">{titel}</h2>
            {istGruppe ? (
              <>
                <p className="text-sm text-mute">
                  zusammen {dauerText(gruppeSekunden)} · die Zuordnung gilt für alle {gruppeIds.length} Blöcke
                </p>
                {gruppeTitel.length > 0 && (
                  <p className="mt-1 truncate text-xs text-dim">
                    {gruppeTitel.slice(0, 3).join(' · ')}
                    {gruppeTitel.length > 3 && ` · und ${gruppeTitel.length - 3} weitere`}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-mute">
                  {datumText(berlinDatum(new Date(block.start)))} · {zeitFeld(block.start)} bis {zeitFeld(block.ende)}
                </p>
                {block.fenstertitel && <p className="mt-1 truncate text-xs text-dim">{block.fenstertitel}</p>}
              </>
            )}
          </div>
          <button type="button" onClick={onSchliessen} className="rounded-chip p-1 text-mute hover:text-ink" title="Schließen">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-mute">
            Tätigkeit
            <input
              className={FELD}
              list="taetigkeiten-liste"
              value={taetigkeit}
              onChange={(e) => setTaetigkeit(e.target.value)}
              placeholder="z. B. KI Learning"
              autoFocus
            />
            <datalist id="taetigkeiten-liste">
              {taetigkeiten.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>

          <div className="flex flex-col gap-1 text-xs text-mute">
            Bewertung
            <div className="flex gap-1">
              <Wahl aktiv={bewertung === 'produktiv'} onClick={() => setBewertung('produktiv')} farbe="bg-produktiv">
                produktiv
              </Wahl>
              {istInaktiv ? (
                <Wahl aktiv={bewertung === 'inaktiv'} onClick={() => setBewertung('inaktiv')} farbe="bg-inaktiv">
                  inaktiv
                </Wahl>
              ) : (
                <Wahl
                  aktiv={bewertung === 'unproduktiv'}
                  onClick={() => setBewertung('unproduktiv')}
                  farbe="bg-unproduktiv"
                >
                  unproduktiv
                </Wahl>
              )}
            </div>
          </div>

          {!istGruppe && (
            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1 text-xs text-mute">
                Von
                <input className={FELD} type="time" value={von} onChange={(e) => setVon(e.target.value)} required />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-xs text-mute">
                Bis
                <input className={FELD} type="time" value={bis} onChange={(e) => setBis(e.target.value)} required />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1 text-xs text-mute">
            Notiz
            <input className={FELD} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="optional" />
          </label>
        </div>

        {regelMoeglich && (
          <div className="mt-5 rounded-card bg-panel-2/60 p-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" checked={immer} onChange={(e) => setImmer(e.target.checked)} className="h-4 w-4" />
              Diese Zuordnung künftig immer anwenden?
            </label>
            {immer && (
              <div className="mt-3 flex flex-col gap-2 pl-7 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" checked={feld === 'programm'} onChange={() => setFeld('programm')} />
                  <span>
                    Immer wenn das Programm <span className="text-ink">{block.programm}</span> ist
                    {istBrowser && (
                      <span className="ml-2 text-xs text-unproduktiv">
                        Vorsicht: damit würde alles im Browser so eingeordnet
                      </span>
                    )}
                  </span>
                </label>
                {block.fenstertitel && !istGruppe && (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" checked={feld === 'titel'} onChange={() => setFeld('titel')} />
                    <span className="shrink-0">Immer wenn der Fenstertitel enthält</span>
                    <input
                      className={`${FELD} max-w-[220px]`}
                      value={muster}
                      onChange={(e) => setMuster(e.target.value)}
                      onFocus={() => setFeld('titel')}
                    />
                  </label>
                )}
                <label className="mt-1 flex cursor-pointer items-center gap-2 text-mute">
                  <input type="checkbox" checked={fuerAlle} onChange={(e) => setFuerAlle(e.target.checked)} />
                  Für alle drei gelten lassen, nicht nur für mich
                </label>
              </div>
            )}
          </div>
        )}

        {fehler && <p className="mt-3 text-sm text-unproduktiv">{fehler}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={loeschen}
            className={`rounded-chip px-3 py-2 text-sm transition-colors ${
              loeschenBestaetigen ? 'bg-unproduktiv text-ink' : 'text-unproduktiv hover:bg-panel-2'
            }`}
          >
            {loeschenBestaetigen ? 'Wirklich löschen?' : 'Löschen'}
          </button>
          <div className="flex gap-2">
            {onUeberspringen && (
              <button
                type="button"
                onClick={onUeberspringen}
                className="rounded-chip px-4 py-2 text-sm text-mute transition-colors hover:bg-panel-2 hover:text-ink"
              >
                Überspringen
              </button>
            )}
            <button
              type="button"
              onClick={onSchliessen}
              className="rounded-chip px-4 py-2 text-sm text-mute transition-colors hover:bg-panel-2 hover:text-ink"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={laeuft}
              className="rounded-chip bg-ink px-4 py-2 text-sm font-medium text-ground transition-opacity disabled:opacity-40"
            >
              {istGruppe ? `Für alle ${gruppeIds.length} übernehmen` : fortschritt ? 'Speichern und weiter' : 'Speichern'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
