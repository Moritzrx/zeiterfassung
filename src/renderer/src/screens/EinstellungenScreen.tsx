import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { STANDARD_GESAMTZIEL } from '@shared/rang'
import { taetigkeitSchluessel } from '@shared/regeln'
import type { Profil, Regel, RegelBewertung, SymbolInfo, SystemInfo, UpdateStatus, Urlaub, Ziel } from '@shared/typen'
import { hinweisZeigen } from '../components/Hinweis'
import { Karte } from '../components/Karte'
import { KundenVerwaltung } from '../components/KundenVerwaltung'
import { SymbolWahl } from '../components/SymbolWahl'
import { useErfassung } from '../erfassung'
import { kurzDatum, uhrzeit } from '../format'
import { useNutzer } from '../nutzer'
import { SymbolBild, useSymbolZuordnung } from '../symbole'
import { useTaetigkeiten } from '../taetigkeiten'
import { KLICK_ARTEN, klickProbe, tonProbe, tonSpielen, toneEinstellung, toneEinstellungSetzen, type Ton } from '../toene'
import { arbeitstageSetzen, useArbeitstage } from '../arbeitstage'
import { hintergrundArtSetzen, useHintergrundArt } from '../hintergrundart'

const PROBEN: { ton: Ton; label: string }[] = [
  { ton: 'tick', label: 'Klick' },
  { ton: 'wischen', label: 'Wischen' },
  { ton: 'erfolg', label: 'Gespeichert' },
  { ton: 'auszeichnung', label: 'Auszeichnung' },
  { ton: 'aufstieg', label: 'Aufstieg' }
]

const FELD =
  'rounded-chip bg-panel-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim'
const KLEIN = `${FELD} w-24 text-right`

function fehlerText(e: unknown): string {
  return e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(e)
}

function Schalter({ an, onChange, disabled = false }: { an: boolean; onChange: (an: boolean) => void; disabled?: boolean }): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      disabled={disabled}
      onClick={() => onChange(!an)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${an ? 'bg-produktiv' : 'bg-inaktiv'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-[left] ${an ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

function Zeile({ titel, hinweis, children }: { titel: string; hinweis?: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <p className="text-sm">{titel}</p>
        {hinweis && <p className="mt-0.5 text-xs text-dim">{hinweis}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

/** Zahlenfeld, das erst beim Verlassen oder mit Enter speichert. */
function Zahl({ wert, onSpeichern, min, max, schritt = 1 }: { wert: number; onSpeichern: (n: number) => void; min: number; max: number; schritt?: number }): ReactElement {
  const [text, setText] = useState(String(wert))
  useEffect(() => setText(String(wert)), [wert])
  function abschicken(): void {
    const n = Number(text.replace(',', '.'))
    if (Number.isNaN(n) || n < min || n > max) {
      setText(String(wert))
      hinweisZeigen(`Bitte einen Wert zwischen ${min} und ${max} eingeben.`)
      return
    }
    if (n !== wert) onSpeichern(n)
  }
  return (
    <input
      className={KLEIN}
      value={text}
      inputMode="decimal"
      step={schritt}
      onChange={(e) => setText(e.target.value)}
      onBlur={abschicken}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

/** Text zur Update-Zeile in den Einstellungen. */
function updateText(u: UpdateStatus | null): string {
  if (!u) return ''
  const wann = u.zuletztGeprueft ? ` Zuletzt geprüft um ${uhrzeit(u.zuletztGeprueft)}.` : ''
  switch (u.zustand) {
    case 'entwicklung':
      return 'In der Entwicklungsversion wird nicht geprüft.'
    case 'unbekannt':
      return 'Noch nicht geprüft. Die App sieht kurz nach dem Start und dann alle vier Stunden nach.'
    case 'prueft':
      return 'Sieht gerade nach …'
    case 'aktuell':
      return `Version ${u.aktuelleVersion} ist die neueste.${wann}`
    case 'verfuegbar':
      return `Version ${u.neueVersion} ist da. Auf dem Mac bitte über die Download-Seite installieren.${wann}`
    case 'laedt':
      return `Version ${u.neueVersion} wird geladen${u.prozent !== null ? ` (${u.prozent} %)` : ''} …`
    case 'bereit':
      return `Version ${u.neueVersion} ist geladen und wird beim nächsten Start eingespielt.`
    case 'fehler':
      return `Prüfung fehlgeschlagen: ${u.fehler ?? 'unbekannter Fehler'}.${wann}`
  }
}

/** Screen 6: Einstellungen. Erfassung, Ziele, Regeln, Symbole, Hochrechnung, System, Konto. */
export function EinstellungenScreen(): ReactElement {
  const { status, neuLaden } = useNutzer()
  const erfassung = useErfassung()
  const taetigkeiten = useTaetigkeiten()
  const zuordnung = useSymbolZuordnung()
  const [profil, setProfil] = useState<Profil | null>(null)
  const [system, setSystem] = useState<SystemInfo | null>(null)
  const [ziele, setZiele] = useState<Ziel[]>([])
  const [regeln, setRegeln] = useState<Regel[]>([])
  const [symbolFuer, setSymbolFuer] = useState<string | null>(null)
  const [toene, setToene] = useState(toneEinstellung)
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const arbeitstageWert = useArbeitstage()
  const hintergrundWert = useHintergrundArt()
  useEffect(() => {
    if (!window.api?.update) return
    void window.api.update.status().then(setUpdate)
    return window.api.update.onStatus(setUpdate)
  }, [])
  const [neuesZiel, setNeuesZiel] = useState({ taetigkeit: '', stunden: '5' })
  const [urlaube, setUrlaube] = useState<Urlaub[]>([])
  const [urlaubFehler, setUrlaubFehler] = useState<string | null>(null)
  const [neuerUrlaub, setNeuerUrlaub] = useState({ von: '', bis: '', notiz: '' })

  const urlaubLaden = useCallback(async () => {
    if (!window.api) return
    try {
      setUrlaube(await window.api.urlaub.eigene())
      setUrlaubFehler(null)
    } catch (e) {
      setUrlaubFehler(fehlerText(e))
    }
  }, [])
  useEffect(() => {
    void urlaubLaden()
  }, [urlaubLaden])

  async function urlaubSpeichern(): Promise<void> {
    if (!window.api) return
    try {
      await window.api.urlaub.anlegen(neuerUrlaub.von, neuerUrlaub.bis || neuerUrlaub.von, neuerUrlaub.notiz || null)
      setNeuerUrlaub({ von: '', bis: '', notiz: '' })
      tonSpielen('erfolg')
      hinweisZeigen('Urlaub eingetragen.')
      await urlaubLaden()
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    }
  }

  async function urlaubLoeschen(id: string): Promise<void> {
    if (!window.api) return
    try {
      await window.api.urlaub.loeschen(id)
      await urlaubLaden()
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    }
  }

  /** Kalendertage einschließlich beider Enden. */
  function urlaubstage(u: Urlaub): number {
    return Math.round((Date.parse(u.bis) - Date.parse(u.von)) / 86_400_000) + 1
  }
  const [neueRegel, setNeueRegel] = useState({ muster: '', feld: 'titel' as 'programm' | 'titel', taetigkeit: '', bewertung: 'produktiv' as RegelBewertung, fuerAlle: false })
  const [loeschenId, setLoeschenId] = useState<string | null>(null)

  const laden = useCallback(async () => {
    if (!window.api) return
    const [p, s, z, r] = await Promise.all([
      window.api.profil.eigenes(),
      window.api.system.info(),
      window.api.ziele.eigene(),
      window.api.regeln.liste()
    ])
    setProfil(p)
    setSystem(s)
    setZiele(z)
    setRegeln(r)
  }, [])

  useEffect(() => {
    void laden()
  }, [laden])

  async function profilSpeichern(aenderung: Partial<Profil>): Promise<void> {
    try {
      setProfil(await window.api.profil.aendern(aenderung))
      tonSpielen('erfolg')
      hinweisZeigen('Gespeichert.')
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    }
  }

  async function zielSpeichern(taetigkeit: string | null, stunden: number): Promise<void> {
    try {
      await window.api.ziele.setzen(taetigkeit, stunden)
      await laden()
      tonSpielen('erfolg')
      hinweisZeigen('Ziel gespeichert.')
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    }
  }

  async function zielLoeschen(id: string): Promise<void> {
    try {
      await window.api.ziele.loeschen(id)
      await laden()
      hinweisZeigen('Ziel entfernt.')
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    }
  }

  async function regelSpeichern(id: string, aenderung: Parameters<typeof window.api.regeln.aendern>[1]): Promise<void> {
    try {
      const { neuBewertet } = await window.api.regeln.aendern(id, aenderung)
      await laden()
      hinweisZeigen(neuBewertet ? `Regel geändert, ${neuBewertet} Blöcke neu bewertet.` : 'Regel geändert.')
    } catch (e) {
      hinweisZeigen(fehlerText(e))
      await laden()
    }
  }

  async function regelLoeschen(id: string): Promise<void> {
    if (loeschenId !== id) {
      setLoeschenId(id)
      return
    }
    setLoeschenId(null)
    try {
      const neuBewertet = await window.api.regeln.loeschen(id)
      await laden()
      hinweisZeigen(neuBewertet ? `Regel gelöscht, ${neuBewertet} Blöcke neu bewertet.` : 'Regel gelöscht.')
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    }
  }

  async function regelAnlegen(): Promise<void> {
    try {
      const { neuBewertet } = await window.api.regeln.anlegen({
        muster: neueRegel.muster,
        feld: neueRegel.feld,
        taetigkeit: neueRegel.taetigkeit.trim() || null,
        bewertung: neueRegel.bewertung,
        fuerAlle: neueRegel.fuerAlle
      })
      setNeueRegel({ muster: '', feld: 'titel', taetigkeit: '', bewertung: 'produktiv', fuerAlle: false })
      await laden()
      tonSpielen('erfolg')
      hinweisZeigen(neuBewertet ? `Regel angelegt, ${neuBewertet} Blöcke neu bewertet.` : 'Regel angelegt.')
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    }
  }

  async function symbolSetzen(name: string, symbol: SymbolInfo): Promise<void> {
    try {
      await window.api.taetigkeiten.symbolSetzen(name, symbol)
      setSymbolFuer(null)
      tonSpielen('erfolg')
      hinweisZeigen('Symbol gespeichert.')
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    }
  }

  async function autostartSetzen(an: boolean): Promise<void> {
    const ergebnis = await window.api.system.autostartSetzen(an)
    setSystem((s) => (s ? { ...s, autostart: ergebnis } : s))
  }

  async function abmelden(): Promise<void> {
    await window.api.auth.abmelden()
    await neuLaden()
  }

  const gesamtziel = ziele.find((z) => z.taetigkeit === null)
  const taetigkeitsZiele = ziele.filter((z) => z.taetigkeit !== null).sort((a, b) => b.stundenProWoche - a.stundenProWoche)
  const sichtbareRegeln = regeln
    .filter((r) => r.giltFuer === null || r.giltFuer === status?.userId)
    .sort((a, b) => (a.giltFuer ? 0 : 1) - (b.giltFuer ? 0 : 1) || a.feld.localeCompare(b.feld) || a.muster.localeCompare(b.muster, 'de'))

  let abgleich = 'Noch kein Abgleich in dieser Sitzung.'
  if (erfassung.syncFehler) abgleich = `Datenbank nicht erreichbar: ${erfassung.syncFehler}`
  else if (erfassung.letzterSync) abgleich = `Zuletzt abgeglichen um ${uhrzeit(erfassung.letzterSync)}.`

  return (
    <div className="flex flex-col gap-4 pt-6">
      <h1 className="text-2xl font-light">Einstellungen</h1>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Erfassung</p>
        <div className="mt-1 divide-y divide-panel-2">
          <Zeile
            titel="Nur im Fokus aufzeichnen"
            hinweis="An: Ohne Fokus nimmt die App nichts auf, und keine Zeit zählt; im Fokus werden Programme und Tabs unter der Fokus-Tätigkeit mitgeschrieben. Aus: wie früher, alles wird durchgehend aufgezeichnet und nach Regeln bewertet, Ungeklärtes muss von Hand zugeordnet werden."
          >
            <Schalter an={erfassung.nurFokus} onChange={(an) => void window.api?.erfassung.nurFokusSetzen(an)} />
          </Zeile>
          <Zeile titel="Untätigkeit nach" hinweis="Minuten ohne Maus und Tastatur, bis die Zeit (im Fokus) als „Nicht am Rechner“ (unproduktiv, rot) zählt. Standard 3. Ab 90 Minuten weg wird daraus „Abwesend“ (blau), zählt gar nicht und beendet den Fokus.">
            {profil && (
              <Zahl
                wert={Math.round(profil.idleSchwelleSekunden / 60)}
                min={1}
                max={60}
                onSpeichern={(n) => void profilSpeichern({ idleSchwelleSekunden: n * 60 })}
              />
            )}
            <span className="text-sm text-mute">min</span>
          </Zeile>
          <Zeile
            titel="Fenstertitel speichern"
            hinweis="Aus: nur der Programmname wird gespeichert. Regeln auf den Fenstertitel greifen dann nicht mehr, Browserzeit landet meist in Ungeklärt."
          >
            <Schalter an={profil?.fenstertitelSpeichern ?? true} onChange={(an) => void profilSpeichern({ fenstertitelSpeichern: an })} />
          </Zeile>
          <Zeile
            titel="Beim Anmelden am Rechner starten"
            hinweis={system?.gepackt ? 'Die App startet versteckt im Symbol.' : 'Nur in der installierten App, nicht in der Entwicklungsversion.'}
          >
            <Schalter an={system?.autostart ?? false} disabled={!system?.gepackt} onChange={(an) => void autostartSetzen(an)} />
          </Zeile>
        </div>
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Wochenziele</p>
        <Zeile
          titel="Arbeitstage pro Woche"
          hinweis="Bestimmt den Tagesrichtwert (Ziel geteilt durch Tage), die Restlaufzeit und die Liga-Vorschau. Ihr arbeitet Montag bis Sonntag, also 7."
        >
          <div className="flex gap-1.5">
            {[5, 6, 7].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => arbeitstageSetzen(n)}
                className={`rounded-chip px-3 py-1.5 text-xs transition-colors ${arbeitstageWert === n ? 'bg-ink text-ground' : 'bg-panel-2 text-ink hover:bg-inaktiv'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </Zeile>
        <div className="mt-1 divide-y divide-panel-2">
          <Zeile titel="Arbeitszeit gesamt" hinweis="Bestimmt, ab welchem Rang die Woche geschafft ist. 50 Stunden sind Rang 10.">
            <Zahl
              wert={gesamtziel?.stundenProWoche ?? STANDARD_GESAMTZIEL}
              min={1}
              max={168}
              schritt={0.5}
              onSpeichern={(n) => void zielSpeichern(null, n)}
            />
            <span className="text-sm text-mute">h</span>
          </Zeile>
          {taetigkeitsZiele.map((z) => (
            <Zeile key={z.id} titel={z.taetigkeit ?? ''}>
              <Zahl wert={z.stundenProWoche} min={0.5} max={168} schritt={0.5} onSpeichern={(n) => void zielSpeichern(z.taetigkeit, n)} />
              <span className="text-sm text-mute">h</span>
              <button type="button" onClick={() => void zielLoeschen(z.id)} className="rounded-chip p-1.5 text-mute hover:text-unproduktiv" title="Ziel entfernen">
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            </Zeile>
          ))}
          <div className="flex flex-wrap items-center gap-2 py-3">
            <input
              className={`${FELD} min-w-0 flex-1`}
              list="taetigkeiten-ziele"
              placeholder="Neues Ziel: Tätigkeit"
              value={neuesZiel.taetigkeit}
              onChange={(e) => setNeuesZiel((z) => ({ ...z, taetigkeit: e.target.value }))}
            />
            <datalist id="taetigkeiten-ziele">
              {taetigkeiten.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <input className={KLEIN} value={neuesZiel.stunden} onChange={(e) => setNeuesZiel((z) => ({ ...z, stunden: e.target.value }))} />
            <span className="text-sm text-mute">h</span>
            <button
              type="button"
              disabled={!neuesZiel.taetigkeit.trim() || !(Number(neuesZiel.stunden.replace(',', '.')) > 0)}
              onClick={() => {
                void zielSpeichern(neuesZiel.taetigkeit.trim(), Number(neuesZiel.stunden.replace(',', '.')))
                setNeuesZiel({ taetigkeit: '', stunden: '5' })
              }}
              className="rounded-chip bg-ink px-3 py-2 text-sm text-ground disabled:opacity-40"
            >
              Hinzufügen
            </button>
          </div>
        </div>
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Urlaub</p>
        <p className="mt-1 text-xs text-dim">
          Hinterlegte Urlaubstage (Montag bis Freitag) senken in der Liga die Erwartung der Woche anteilig. Eine ganze Urlaubswoche
          kostet keine Trophäen. Zählt auch für Feiertage und Krankheit.
        </p>
        {urlaubFehler && <p className="mt-2 text-sm text-mute">{urlaubFehler}</p>}
        <div className="mt-1 divide-y divide-panel-2">
          {urlaube.map((u) => (
            <Zeile
              key={u.id}
              titel={u.von === u.bis ? kurzDatum(u.von) : `${kurzDatum(u.von)} bis ${kurzDatum(u.bis)}`}
              hinweis={`${urlaubstage(u)} ${urlaubstage(u) === 1 ? 'Tag' : 'Tage'}${u.notiz ? ` · ${u.notiz}` : ''}`}
            >
              <button type="button" onClick={() => void urlaubLoeschen(u.id)} className="rounded-chip p-1.5 text-mute hover:text-unproduktiv" title="Urlaub entfernen">
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            </Zeile>
          ))}
          {urlaube.length === 0 && !urlaubFehler && <p className="py-3 text-sm text-dim">Noch kein Urlaub hinterlegt.</p>}
          <div className="flex flex-wrap items-center gap-2 py-3">
            <span className="text-sm text-mute">Von</span>
            <input type="date" className={FELD} value={neuerUrlaub.von} onChange={(e) => setNeuerUrlaub((u) => ({ ...u, von: e.target.value }))} />
            <span className="text-sm text-mute">bis</span>
            <input type="date" className={FELD} value={neuerUrlaub.bis} min={neuerUrlaub.von || undefined} onChange={(e) => setNeuerUrlaub((u) => ({ ...u, bis: e.target.value }))} />
            <input
              className={`${FELD} min-w-0 flex-1`}
              placeholder="Notiz, z. B. Sommerurlaub"
              value={neuerUrlaub.notiz}
              onChange={(e) => setNeuerUrlaub((u) => ({ ...u, notiz: e.target.value }))}
            />
            <button
              type="button"
              disabled={!neuerUrlaub.von || (!!neuerUrlaub.bis && neuerUrlaub.bis < neuerUrlaub.von)}
              onClick={() => void urlaubSpeichern()}
              className="rounded-chip bg-ink px-3 py-2 text-sm text-ground disabled:opacity-40"
            >
              Eintragen
            </button>
          </div>
        </div>
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Regeln</p>
        <p className="mt-1 text-xs text-dim">
          Erst wird das Programm geprüft, dann der Fenstertitel. Persönliche Regeln gewinnen gegen Team-Regeln. Änderungen wirken
          sofort auf alle nicht von Hand geprüften Blöcke.
          {erfassung.nurFokus && ' Solange „Nur im Fokus aufzeichnen“ an ist, entstehen keine Blöcke nach Regeln; sie gelten dann nur noch für alte Blöcke.'}
        </p>
        <div className="mt-2 divide-y divide-panel-2">
          {sichtbareRegeln.map((r) => (
            <div key={r.id} className={`py-3 ${r.aktiv ? '' : 'opacity-50'}`}>
              <div className="flex items-center gap-2">
                <select className={`${FELD} w-36 shrink-0`} value={r.feld} onChange={(e) => void regelSpeichern(r.id, { feld: e.target.value as 'programm' | 'titel' })}>
                  <option value="programm">Programm</option>
                  <option value="titel">Titel enthält</option>
                </select>
                <input
                  className={`${FELD} min-w-0 flex-1`}
                  defaultValue={r.muster}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== r.muster) void regelSpeichern(r.id, { muster: e.target.value })
                  }}
                />
                <Schalter an={r.aktiv} onChange={(an) => void regelSpeichern(r.id, { aktiv: an })} />
                <button
                  type="button"
                  onClick={() => void regelLoeschen(r.id)}
                  className={`shrink-0 rounded-chip px-2 py-1.5 text-xs ${loeschenId === r.id ? 'bg-unproduktiv text-ink' : 'text-mute hover:text-unproduktiv'}`}
                  title="Regel löschen"
                >
                  {loeschenId === r.id ? 'Wirklich?' : <Trash2 size={16} strokeWidth={1.5} />}
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 pl-[9.5rem]">
                <span className="text-xs text-dim">→</span>
                <input
                  className={`${FELD} min-w-0 flex-1`}
                  list="taetigkeiten-regeln"
                  placeholder="Tätigkeit (leer bei unproduktiv oder ungeklärt)"
                  defaultValue={r.taetigkeit ?? ''}
                  onBlur={(e) => {
                    if ((e.target.value.trim() || null) !== r.taetigkeit) void regelSpeichern(r.id, { taetigkeit: e.target.value.trim() || null })
                  }}
                />
                <select className={`${FELD} w-32 shrink-0`} value={r.bewertung} onChange={(e) => void regelSpeichern(r.id, { bewertung: e.target.value as RegelBewertung })}>
                  <option value="produktiv">produktiv</option>
                  <option value="unproduktiv">unproduktiv</option>
                  <option value="ungeklaert">ungeklärt</option>
                </select>
                <select className={`${FELD} w-28 shrink-0`} value={r.giltFuer ? 'ich' : 'alle'} onChange={(e) => void regelSpeichern(r.id, { fuerAlle: e.target.value === 'alle' })}>
                  <option value="alle">alle drei</option>
                  <option value="ich">nur ich</option>
                </select>
              </div>
            </div>
          ))}
          <datalist id="taetigkeiten-regeln">
            {taetigkeiten.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <div className="py-3">
            <p className="mb-2 text-xs tracking-wide text-mute uppercase">Neue Regel</p>
            <div className="flex items-center gap-2">
              <select className={`${FELD} w-36 shrink-0`} value={neueRegel.feld} onChange={(e) => setNeueRegel((n) => ({ ...n, feld: e.target.value as 'programm' | 'titel' }))}>
                <option value="programm">Programm</option>
                <option value="titel">Titel enthält</option>
              </select>
              <input
                className={`${FELD} min-w-0 flex-1`}
                placeholder="Muster, z. B. Asana oder Adobe Premiere Pro"
                value={neueRegel.muster}
                onChange={(e) => setNeueRegel((n) => ({ ...n, muster: e.target.value }))}
              />
            </div>
            <div className="mt-2 flex items-center gap-2 pl-[9.5rem]">
              <span className="text-xs text-dim">→</span>
              <input
                className={`${FELD} min-w-0 flex-1`}
                list="taetigkeiten-regeln"
                placeholder="Tätigkeit"
                value={neueRegel.taetigkeit}
                onChange={(e) => setNeueRegel((n) => ({ ...n, taetigkeit: e.target.value }))}
              />
              <select className={`${FELD} w-32 shrink-0`} value={neueRegel.bewertung} onChange={(e) => setNeueRegel((n) => ({ ...n, bewertung: e.target.value as RegelBewertung }))}>
                <option value="produktiv">produktiv</option>
                <option value="unproduktiv">unproduktiv</option>
                <option value="ungeklaert">ungeklärt</option>
              </select>
              <select className={`${FELD} w-28 shrink-0`} value={neueRegel.fuerAlle ? 'alle' : 'ich'} onChange={(e) => setNeueRegel((n) => ({ ...n, fuerAlle: e.target.value === 'alle' }))}>
                <option value="ich">nur ich</option>
                <option value="alle">alle drei</option>
              </select>
              <button
                type="button"
                disabled={!neueRegel.muster.trim()}
                onClick={() => void regelAnlegen()}
                className="shrink-0 rounded-chip bg-ink px-3 py-2 text-sm text-ground disabled:opacity-40"
              >
                Anlegen
              </button>
            </div>
          </div>
        </div>
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Tätigkeiten und Symbole</p>
        <p className="mt-1 text-xs text-dim">Auf ein Symbol klicken, um es zu ändern. Gilt für alle drei.</p>
        <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {taetigkeiten.map((t) => {
            const symbol = zuordnung[taetigkeitSchluessel(t)] ?? { typ: 'lucide', name: 'tag' }
            return (
              <button
                key={t}
                type="button"
                onClick={() => setSymbolFuer(t)}
                className="flex items-center gap-3 rounded-chip px-2 py-2 text-left text-sm transition-colors hover:bg-panel-2"
              >
                <SymbolBild symbol={symbol} groesse={18} />
                <span className="truncate">{t}</span>
              </button>
            )
          })}
        </div>
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Hochrechnung</p>
        <div className="mt-1">
          <Zeile titel="Urlaubswochen pro Jahr" hinweis="Jahr = Wochenwert mal (52 minus Urlaubswochen). Standard 6.">
            {profil && <Zahl wert={profil.urlaubswochen} min={0} max={52} onSpeichern={(n) => void profilSpeichern({ urlaubswochen: n })} />}
            <span className="text-sm text-mute">Wochen</span>
          </Zeile>
        </div>
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Darstellung</p>
        <Zeile
          titel="Hintergrund"
          hinweis="Logo: die wessamedia-Wortmarke als Wasserzeichen mit dem Linienmuster und orangenen Lichtketten. Klassisch: Raster, Zifferblätter und farbige Lichtbahnen."
        >
          <div className="flex gap-1.5">
            {(
              [
                ['logo', 'Logo'],
                ['klassisch', 'Klassisch']
              ] as const
            ).map(([art, name]) => (
              <button
                key={art}
                type="button"
                onClick={() => hintergrundArtSetzen(art)}
                className={`rounded-chip px-3 py-1.5 text-xs transition-colors ${hintergrundWert === art ? 'bg-ink text-ground' : 'bg-panel-2 text-ink hover:bg-inaktiv'}`}
              >
                {name}
              </button>
            ))}
          </div>
        </Zeile>
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Töne</p>
        <div className="mt-1 divide-y divide-panel-2">
          <Zeile
            titel="Töne abspielen"
            hinweis="Leiser Klick bei Knöpfen, ein Wischen beim Screen-Wechsel, Klänge bei Aufstieg und Auszeichnungen. Alle Töne entstehen in der App selbst."
          >
            <Schalter an={toene.an} onChange={(an) => setToene(toneEinstellungSetzen({ an }))} />
          </Zeile>
          <Zeile titel="Lautstärke" hinweis={`${Math.round(toene.lautstaerke * 100)} %`}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(toene.lautstaerke * 100)}
              onChange={(e) => setToene(toneEinstellungSetzen({ lautstaerke: Number(e.target.value) / 100 }))}
              onPointerUp={() => tonProbe('erfolg', toene.lautstaerke)}
              data-stumm
              className="w-40 accent-produktiv"
              aria-label="Lautstärke"
            />
          </Zeile>
          <div className="py-3">
            <p className="text-sm">Klick-Art</p>
            <p className="mt-0.5 text-xs text-dim">Antippen spielt die Art vor und wählt sie aus.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {KLICK_ARTEN.map((k) => {
                const gewaehlt = toene.klick === k.art
                return (
                  <button
                    key={k.art}
                    type="button"
                    data-stumm
                    title={k.hinweis}
                    onClick={() => {
                      klickProbe(k.art, toene.lautstaerke)
                      setToene(toneEinstellungSetzen({ klick: k.art }))
                    }}
                    className={`rounded-chip px-3 py-1.5 text-xs transition-colors ${
                      gewaehlt ? 'bg-ink text-ground' : 'bg-panel-2 text-ink hover:bg-inaktiv'
                    }`}
                  >
                    {k.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-xs text-dim">{KLICK_ARTEN.find((k) => k.art === toene.klick)?.hinweis}</p>
          </div>
          <Zeile titel="Probehören">
            <div className="flex flex-wrap justify-end gap-1.5">
              {PROBEN.map((p) => (
                <button
                  key={p.ton}
                  type="button"
                  data-stumm
                  onClick={() => tonProbe(p.ton, toene.lautstaerke)}
                  className="rounded-chip bg-panel-2 px-3 py-1.5 text-xs text-ink transition-colors hover:bg-inaktiv"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Zeile>
        </div>
      </Karte>

      <KundenVerwaltung />

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">System</p>
        <div className="mt-1 divide-y divide-panel-2">
          {/*
            Mac: Fenstertitel (YouTube, Sheets, Instagram) gibt es nur mit der Berechtigung "Bildschirmaufnahme".
            Seit 11. September 2026 gewollt (vorher bewusst weggelassen). macOS fragt einmal; danach muss die App neu
            gestartet werden. Nach einem Update kann macOS die Berechtigung erneut verlangen (die App ist nicht von Apple signiert).
          */}
          <Zeile
            titel={system?.plattform === 'mac' ? 'Fenstertitel (Bildschirmaufnahme)' : 'Systemrechte'}
            hinweis={
              system?.plattform !== 'mac'
                ? 'Unter Windows sind keine Sonderrechte nötig.'
                : system.bildschirmrecht === 'erteilt'
                  ? 'Berechtigung erteilt: Die App sieht, welche Seite im Browser offen ist (YouTube, Sheets, Instagram). Sie nimmt nichts auf.'
                  : 'Ohne die Berechtigung „Bildschirmaufnahme“ sieht die App nur Programmnamen, keine Seiten. Anfragen, in den Systemeinstellungen einschalten, dann die App neu starten. Nach einem Update kann macOS erneut fragen.'
            }
          >
            {system?.plattform !== 'mac' || system.bildschirmrecht === 'erteilt' ? (
              <span className="text-sm text-produktiv">in Ordnung</span>
            ) : (
              <>
                <span className="text-sm text-unproduktiv">{system.bildschirmrecht === 'offen' ? 'noch nicht erteilt' : 'fehlt'}</span>
                <button
                  type="button"
                  onClick={() => {
                    void window.api.system.bildschirmrechtAnfragen().then((stand) => {
                      setSystem((s) => (s ? { ...s, bildschirmrecht: stand } : s))
                      hinweisZeigen(
                        stand === 'erteilt'
                          ? 'Berechtigung erteilt. Ab dem nächsten Start sieht die App die Fenstertitel.'
                          : 'In den Systemeinstellungen „wessamedia Zeit“ bei Bildschirmaufnahme einschalten, dann die App neu starten.'
                      )
                    })
                  }}
                  className="knopf-primaer rounded-chip px-3 py-1.5 text-sm"
                >
                  Berechtigung anfragen
                </button>
              </>
            )}
          </Zeile>
          <Zeile titel="Datenbank" hinweis={abgleich}>
            <span className="text-sm text-mute">
              {erfassung.unsynchronisiert === 0 ? 'alles übertragen' : `${erfassung.unsynchronisiert} warten`}
            </span>
          </Zeile>
          <Zeile titel="Version" hinweis={system ? `${system.plattform === 'mac' ? 'Mac' : system.plattform === 'windows' ? 'Windows' : 'Linux'} · ${system.gepackt ? 'installierte App' : 'Entwicklungsversion'}` : undefined}>
            <span className="text-sm text-mute">{system?.version ?? ''}</span>
          </Zeile>
          <Zeile titel="Diagnose" hinweis="Wenn etwas hakt: kopiert Stand und letzte Fehler als Text. Den Text einfach in den Chat einfügen. Keine Blockinhalte, keine Fenstertitel.">
            <button
              type="button"
              onClick={() => {
                void window.api.system
                  .diagnose()
                  .then((text) => navigator.clipboard.writeText(text))
                  .then(() => hinweisZeigen('Diagnose in die Zwischenablage kopiert. Einfach in den Chat einfügen.'))
                  .catch(() => hinweisZeigen('Kopieren hat nicht geklappt.'))
              }}
              className="rounded-chip bg-panel-2 px-3 py-1.5 text-sm text-ink hover:bg-inaktiv"
            >
              Diagnose kopieren
            </button>
          </Zeile>
          <Zeile titel="Updates" hinweis={updateText(update)}>
            {update && update.zustand !== 'entwicklung' && (
              <button
                type="button"
                disabled={update.zustand === 'prueft' || update.zustand === 'laedt'}
                onClick={() => {
                  if (update.zustand === 'bereit' || update.zustand === 'verfuegbar') void window.api.update.installieren()
                  else void window.api.update.pruefen().then(setUpdate)
                }}
                className="rounded-chip bg-panel-2 px-3 py-1.5 text-xs text-ink transition-colors hover:bg-inaktiv disabled:opacity-40"
              >
                {update.zustand === 'bereit' ? 'Jetzt neu starten' : update.zustand === 'verfuegbar' ? 'Download öffnen' : 'Jetzt prüfen'}
              </button>
            )}
          </Zeile>
        </div>
      </Karte>

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Konto</p>
        <p className="mt-2 text-sm">{status?.name ?? 'Unbekannt'}</p>
        <p className="text-sm text-mute">{status?.email ?? ''}</p>
        <button type="button" onClick={abmelden} className="mt-4 rounded-chip bg-panel-2 px-4 py-2 text-sm text-ink transition-colors hover:bg-inaktiv">
          Abmelden
        </button>
      </Karte>

      {symbolFuer && (
        <SymbolWahl
          name={symbolFuer}
          aktuell={zuordnung[taetigkeitSchluessel(symbolFuer)] ?? { typ: 'lucide', name: 'tag' }}
          onWahl={(s) => void symbolSetzen(symbolFuer, s)}
          onSchliessen={() => setSymbolFuer(null)}
        />
      )}
    </div>
  )
}
