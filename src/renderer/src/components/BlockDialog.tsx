import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import { Portal } from './Portal'
import { Plus, X } from 'lucide-react'
import type { Bewertung, Block, RegelBewertung } from '@shared/typen'
import { anzeigeName, fensterInfo } from '@shared/fenster'
import { ABWESEND_NAME, RUHE_NAME, istRuhe } from '@shared/ruhe'
import { musterVorschlag } from '@shared/regeln'
import { berlinDatum, berlinTeile, berlinZuUtc } from '@shared/zeit'
import { datumText, dauerText } from '../format'
import { hinweisZeigen } from './Hinweis'
import { tonSpielen } from '../toene'
import { TaetigkeitSymbol } from '../symbole'

/** Vergleich von Tätigkeitsnamen wie beim Speichern: ohne Groß/Klein, Leerzeichen und Bindestriche. */
const schluessel = (name: string): string => name.toLowerCase().replace(/[\s-]/g, '')

/** Editierabstand zweier Schlüssel (Levenshtein), für den Hinweis "Meintest du …?" bei Tippfehlern. */
function abstand(a: string, b: string): number {
  const zeile = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = zeile[0]
    zeile[0] = i
    for (let j = 1; j <= b.length; j++) {
      const oben = zeile[j]
      zeile[j] = Math.min(zeile[j] + 1, zeile[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = oben
    }
  }
  return zeile[b.length]
}

/**
 * Was aus einem eingetippten Namen wird: die vorhandene Schreibweise (gleicher Schlüssel), ein Vorschlag bei einem
 * nahen Namen (Tippfehler, höchstens 2 Zeichen Abstand, oder der eine beginnt mit dem anderen) oder wirklich neu.
 */
function namenPruefen(eingabe: string, bekannt: string[]): { art: 'leer' | 'vorhanden' | 'aehnlich' | 'neu'; name?: string } {
  const s = schluessel(eingabe.trim())
  if (!s) return { art: 'leer' }
  const gleich = bekannt.find((t) => schluessel(t) === s)
  if (gleich) return { art: 'vorhanden', name: gleich }
  if (s.length >= 4) {
    const nah = bekannt.find((t) => {
      const k = schluessel(t)
      return (k.length >= 4 && (k.startsWith(s) || s.startsWith(k))) || abstand(s, k) <= 2
    })
    if (nah) return { art: 'aehnlich', name: nah }
  }
  return { art: 'neu' }
}

interface Props {
  block: Block
  /** Mehrere Blöcke desselben Programms auf einmal: die Entscheidung gilt für alle */
  gruppe?: Block[]
  /** Erkannte Seite der Gruppe (z. B. "YouTube"); dann bietet der Dialog eine Regel nach Fenstertitel an */
  gruppeMuster?: string | null
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
  gruppeMuster = null,
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
  const gruppeTitel = [
    ...new Set((gruppe ?? []).map((b) => fensterInfo(b.programm, b.fenstertitel).titel || b.fenstertitel).filter((t): t is string => !!t))
  ]
  const [taetigkeit, setTaetigkeit] = useState(block.taetigkeit ?? '')
  const [bewertung, setBewertung] = useState<Bewertung>(
    block.bewertung === 'ungeklaert' ? 'produktiv' : block.bewertung
  )
  const [von, setVon] = useState(zeitFeld(block.start))
  const [bis, setBis] = useState(zeitFeld(block.ende))
  const [notiz, setNotiz] = useState(block.notiz ?? '')
  // Feld für eine neue Tätigkeit: offen nach Klick auf "+ Neue Tätigkeit" oder wenn der Name zu keinem Chip passt.
  const [neuOffen, setNeuOffen] = useState(false)
  const pruefung = namenPruefen(taetigkeit, taetigkeiten)
  const neuFeldSichtbar = neuOffen || taetigkeiten.length === 0 || (taetigkeit.trim() !== '' && pruefung.art !== 'vorhanden')
  // In der Gruppe: je Block eine eigene Bewertung oder Tätigkeit, sonst gilt die Vorgabe oben.
  const [einzeln, setEinzeln] = useState<Record<string, { bewertung?: Bewertung; taetigkeit?: string }>>({})
  const [immer, setImmer] = useState(false)
  const [feld, setFeld] = useState<'programm' | 'titel'>(
    (istGruppe && gruppeMuster) || (block.fenstertitel && istBrowser && !istGruppe) ? 'titel' : 'programm'
  )
  const [muster, setMuster] = useState(istGruppe ? (gruppeMuster ?? '') : musterVorschlag(block.fenstertitel))
  const fenster = fensterInfo(block.programm, block.fenstertitel)
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
        // Für die Gruppe: Vorgabe oben, einzelne Blöcke dürfen abweichen. Zeiten bleiben,
        // die Notiz nur, wenn eine eingetragen wurde.
        const buendel = new Map<string, { ids: string[]; taetigkeit: string | null; bewertung: Bewertung }>()
        for (const b of gruppe ?? []) {
          const e = einzeln[b.id] ?? {}
          const t = (e.taetigkeit?.trim() || taetigkeit.trim()) || null
          const bw = e.bewertung ?? bewertung
          const schluessel = `${t ?? ''}|${bw}`
          const eintrag = buendel.get(schluessel) ?? { ids: [], taetigkeit: t, bewertung: bw }
          eintrag.ids.push(b.id)
          buendel.set(schluessel, eintrag)
        }
        let n = 0
        for (const e of buendel.values()) {
          const fuerAlle: typeof aenderung = { taetigkeit: e.taetigkeit, bewertung: e.bewertung }
          if (notiz.trim()) fuerAlle.notiz = notiz
          n += await window.api.bloecke.mehrereAendern(e.ids, fuerAlle)
        }
        tonSpielen('erfolg')
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

  // Im Browser steht die Seite vorne ("YouTube · Google Chrome"), sonst das Programm.
  const name = anzeigeName(block.programm, block.fenstertitel)
  const titel = istGruppe
    ? `${gruppeMuster ? `${gruppeMuster} · ` : ''}${block.programm ?? 'Unbekanntes Programm'} · ${gruppeIds.length} Blöcke`
    : istInaktiv
      ? ABWESEND_NAME
      : istManuell
        ? (block.taetigkeit ?? 'Von Hand eingetragen')
        : istRuhe(block)
          ? RUHE_NAME
          : name.neben
            ? `${name.haupt} · ${name.neben}`
            : (block.programm ?? 'Block')

  return (
    <Portal>
    <div className="animate-aufblenden fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onSchliessen}>
      <form
        onSubmit={speichern}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[720px] overscroll-contain overflow-y-auto rounded-t-card bg-panel p-6"
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
                  zusammen {dauerText(gruppeSekunden)} · Vorgabe für alle, unten je Block anpassbar
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
                  {fenster.seite && <span className="ml-2 rounded-chip bg-panel-2 px-1.5 py-0.5 text-xs">{fenster.seite}</span>}
                </p>
                {block.fenstertitel && (
                  <p className="mt-1 text-xs break-words text-dim" title={block.fenstertitel}>
                    {fenster.titel || block.fenstertitel}
                  </p>
                )}
              </>
            )}
          </div>
          <button type="button" onClick={onSchliessen} className="rounded-chip p-1 text-mute hover:text-ink" title="Schließen">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/*
            Tätigkeit als Chips zum Antippen (11. September 2026, "ich kann die Tätigkeit gar nicht ändern"): das reine
            Eingabefeld mit Vorschlagsliste zeigte die anderen Tätigkeiten erst beim Tippen, das fiel nicht auf.
            Gleiche Darstellung wie im Fokus-Dialog; das Feld darunter bleibt für neue Namen.
          */}
          <div className="flex flex-col gap-1 text-xs text-mute sm:col-span-2">
            Tätigkeit
            <div className="mt-1 flex flex-wrap gap-2">
              {taetigkeiten.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTaetigkeit(t)
                    setNeuOffen(false)
                  }}
                  className={`flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-sm transition-colors ${
                    schluessel(taetigkeit) === schluessel(t) ? 'bg-ink text-ground' : 'bg-panel-2 text-ink hover:bg-inaktiv'
                  }`}
                >
                  <TaetigkeitSymbol name={t} groesse={14} />
                  {t}
                </button>
              ))}
              {/* Eigene Tätigkeit anlegen: leeres Feld statt des vorbelegten Namens, damit klar ist, dass hier Neues entsteht. */}
              <button
                type="button"
                onClick={() => {
                  setTaetigkeit('')
                  setNeuOffen(true)
                }}
                className={`flex items-center gap-1.5 rounded-chip border border-dashed px-3 py-1.5 text-sm transition-colors ${
                  neuFeldSichtbar ? 'border-ink text-ink' : 'border-mute text-mute hover:border-ink hover:text-ink'
                }`}
              >
                <Plus size={14} strokeWidth={1.5} />
                Neue Tätigkeit
              </button>
            </div>
            {neuFeldSichtbar && (
              <>
                <input
                  className={`${FELD} mt-1`}
                  value={taetigkeit}
                  onChange={(e) => setTaetigkeit(e.target.value)}
                  placeholder="Neue Tätigkeit, z. B. Managing"
                  autoFocus
                />
                {pruefung.art === 'vorhanden' && (
                  <p className="text-xs text-mute">
                    Gibt es schon, wird als <span className="text-ink">{pruefung.name}</span> gespeichert.
                  </p>
                )}
                {pruefung.art === 'aehnlich' && (
                  <p className="text-xs text-mute">
                    Meintest du{' '}
                    <button type="button" onClick={() => setTaetigkeit(pruefung.name ?? '')} className="rounded-chip bg-panel-2 px-2 py-0.5 text-ink hover:bg-inaktiv">
                      {pruefung.name}
                    </button>
                    ? Sonst wird <span className="text-ink">{taetigkeit.trim()}</span> als neue Tätigkeit angelegt.
                  </p>
                )}
                {pruefung.art === 'neu' && (
                  <p className="text-xs text-mute">
                    Neue Tätigkeit: steht ab dem Speichern für alle als Chip zur Auswahl. Symbol unter Einstellungen → Tätigkeiten und Symbole.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-1 text-xs text-mute">
            Bewertung
            <div className="flex gap-1">
              <Wahl aktiv={bewertung === 'produktiv'} onClick={() => setBewertung('produktiv')} farbe="bg-produktiv">
                produktiv
              </Wahl>
              {istInaktiv ? (
                <Wahl aktiv={bewertung === 'inaktiv'} onClick={() => setBewertung('inaktiv')} farbe="bg-abwesend">
                  abwesend
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

        {istGruppe && (
          <div className="mt-5">
            <p className="text-xs tracking-wide text-mute uppercase">Die {gruppeIds.length} Blöcke im Einzelnen</p>
            <p className="mt-1 text-xs text-dim">
              Oben steht die Vorgabe für alle. Wer bei einem Block etwas anderes wählt, überstimmt sie nur für diesen Block.
            </p>
            <div className="mt-2 divide-y divide-panel-2">
              {(gruppe ?? []).map((b) => {
                const e = einzeln[b.id] ?? {}
                const sekunden = (Date.parse(b.ende) - Date.parse(b.start)) / 1000
                const setzen = (aenderung: { bewertung?: Bewertung; taetigkeit?: string }): void =>
                  setEinzeln((alt) => ({ ...alt, [b.id]: { ...alt[b.id], ...aenderung } }))
                return (
                  <div key={b.id} className="py-3">
                    <div className="flex items-baseline gap-3 text-sm">
                      <span className="shrink-0 text-mute">
                        {datumText(berlinDatum(new Date(b.start)))} · {zeitFeld(b.start)} bis {zeitFeld(b.ende)}
                      </span>
                      <span className="shrink-0 text-dim">{dauerText(sekunden)}</span>
                    </div>
                    {(() => {
                      const f = fensterInfo(b.programm, b.fenstertitel)
                      return (
                        <p className="mt-0.5 text-sm break-words text-ink" title={b.fenstertitel ?? undefined}>
                          {f.seite && <span className="mr-2 rounded-chip bg-panel-2 px-1.5 py-0.5 text-xs text-mute">{f.seite}</span>}
                          {f.titel || b.fenstertitel || b.programm || 'ohne Fenstertitel'}
                        </p>
                      )
                    })()}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="flex gap-1">
                        <Wahl aktiv={e.bewertung === undefined} onClick={() => setzen({ bewertung: undefined })} farbe="bg-inaktiv">
                          wie oben
                        </Wahl>
                        <Wahl aktiv={e.bewertung === 'produktiv'} onClick={() => setzen({ bewertung: 'produktiv' })} farbe="bg-produktiv">
                          produktiv
                        </Wahl>
                        <Wahl aktiv={e.bewertung === 'unproduktiv'} onClick={() => setzen({ bewertung: 'unproduktiv' })} farbe="bg-unproduktiv">
                          unproduktiv
                        </Wahl>
                      </div>
                      <input
                        className={`${FELD} max-w-[220px]`}
                        list="taetigkeiten-liste"
                        value={e.taetigkeit ?? ''}
                        onChange={(ev) => setzen({ taetigkeit: ev.target.value })}
                        placeholder="Tätigkeit wie oben"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {regelMoeglich && (
          <div className="mt-5 rounded-card bg-panel-2/60 p-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" checked={immer} onChange={(e) => setImmer(e.target.checked)} className="h-4 w-4" />
              {istGruppe ? `Alle künftigen Blöcke von ${block.programm} so wie die Vorgabe oben einordnen?` : 'Diese Zuordnung künftig immer anwenden?'}
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
                {((block.fenstertitel && !istGruppe) || (istGruppe && gruppeMuster)) && (
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
              {istGruppe ? `${gruppeIds.length} Blöcke speichern` : fortschritt ? 'Speichern und weiter' : 'Speichern'}
            </button>
          </div>
        </div>
      </form>
    </div>
    </Portal>
  )
}
