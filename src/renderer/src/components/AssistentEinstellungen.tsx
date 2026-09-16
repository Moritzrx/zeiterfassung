import { useEffect, useState, type ReactElement } from 'react'
import { Sparkles } from 'lucide-react'
import type { KiStatus, Wissen } from '@shared/typen'
import { fehlerText, kurzDatum, uhrzeit } from '../format'
import { tonSpielen } from '../toene'
import { assistentOeffnen } from './AssistentDialog'
import { hinweisZeigen } from './Hinweis'
import { Karte } from './Karte'

const FELD =
  'w-full rounded-chip bg-panel-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim'

/** Die beiden festen Wissenseinträge; weitere Einträge aus der Tabelle erscheinen darunter. */
const FESTE: Array<{ schluessel: string; titel: string; platzhalter: string }> = [
  {
    schluessel: 'firma',
    titel: 'Über wessamedia',
    platzhalter:
      'Was wessamedia ist, wer was macht, welche Leistungen ihr anbietet, wie ihr arbeitet (Vertriebstage, Teamcalls, Regeln), welche Werkzeuge ihr nutzt …'
  },
  {
    schluessel: 'kunden',
    titel: 'Kunden und Projekte',
    platzhalter: 'Je Kunde ein paar Zeilen: was ihr für ihn macht, Ansprechpartner, Besonderheiten, laufende Projekte …'
  }
]

/**
 * Einstellungen-Karte "KI-Assistent" (16. September 2026): erklärt, woher der Anthropic-Schlüssel kommt, nimmt ihn
 * entgegen (verschlüsselt im Datenordner, nie in der Datenbank) und pflegt das gemeinsame Wissen über wessamedia
 * (Tabelle wissen, Skript 20), das der Assistent zusätzlich zur Anleitung kennt.
 */
export function AssistentEinstellungen(): ReactElement {
  const [status, setStatus] = useState<KiStatus | null>(null)
  const [schluessel, setSchluessel] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [wissen, setWissen] = useState<Wissen[] | null>(null)
  const [wissenFehler, setWissenFehler] = useState<string | null>(null)
  const [entwurf, setEntwurf] = useState<Record<string, string>>({})
  const [speichert, setSpeichert] = useState<string | null>(null)

  // Wissen laden; erneut, wenn das Fenster wieder sichtbar wird oder jemand in ein Feld klickt (die Screens bleiben
  // dauerhaft aufgebaut, sonst sähe man Änderungen der Kollegen erst nach einem Neustart). Eigene Entwürfe bleiben stehen.
  function wissenLaden(): void {
    if (!window.api) return
    window.api.ki
      .wissen()
      .then((liste) => {
        setWissen(liste)
        setEntwurf((alt) => {
          const neu = { ...alt }
          for (const w of liste) if (!(w.schluessel in neu) || neu[w.schluessel] === (wissen?.find((x) => x.schluessel === w.schluessel)?.inhalt ?? '')) neu[w.schluessel] = w.inhalt
          return neu
        })
        setWissenFehler(null)
      })
      .catch((e) => {
        setWissen((alt) => alt ?? [])
        setWissenFehler(fehlerText(e))
      })
  }

  useEffect(() => {
    if (!window.api) return
    void window.api.ki.status().then(setStatus)
    wissenLaden()
    const sichtbar = (): void => {
      if (document.visibilityState === 'visible') wissenLaden()
    }
    document.addEventListener('visibilitychange', sichtbar)
    return () => document.removeEventListener('visibilitychange', sichtbar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function speichern(): Promise<void> {
    if (!window.api || laeuft) return
    setLaeuft(true)
    try {
      const s = await window.api.ki.schluesselSetzen(schluessel)
      setStatus(s)
      setSchluessel('')
      tonSpielen('erfolg')
      hinweisZeigen('Schlüssel gespeichert. Oben rechts auf „Fragen“ klicken und loslegen.')
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    } finally {
      setLaeuft(false)
    }
  }

  async function entfernen(): Promise<void> {
    if (!window.api || laeuft) return
    setLaeuft(true)
    try {
      setStatus(await window.api.ki.schluesselEntfernen())
      hinweisZeigen('Schlüssel entfernt.')
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    } finally {
      setLaeuft(false)
    }
  }

  async function wissenSpeichern(schluesselEintrag: string, titel: string): Promise<void> {
    if (!window.api || speichert) return
    setSpeichert(schluesselEintrag)
    try {
      const liste = await window.api.ki.wissenSetzen(schluesselEintrag, titel, entwurf[schluesselEintrag] ?? '')
      setWissen(liste)
      setEntwurf(Object.fromEntries(liste.map((w) => [w.schluessel, w.inhalt])))
      tonSpielen('erfolg')
      hinweisZeigen(`„${titel}“ gespeichert. Der Assistent kennt es ab der nächsten Frage, bei allen dreien.`)
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    } finally {
      setSpeichert(null)
    }
  }

  // Feste Einträge zuerst, dann alles Weitere aus der Tabelle.
  const eintraege = [
    ...FESTE.map((f) => ({ ...f, gespeichert: wissen?.find((w) => w.schluessel === f.schluessel) ?? null })),
    ...(wissen ?? [])
      .filter((w) => !FESTE.some((f) => f.schluessel === w.schluessel))
      .map((w) => ({ schluessel: w.schluessel, titel: w.titel, platzhalter: '', gespeichert: w }))
  ]

  return (
    <Karte>
      <p className="flex items-center gap-2 text-xs tracking-wide text-mute uppercase">
        <Sparkles size={14} strokeWidth={1.5} />
        KI-Assistent
      </p>
      <p className="mt-1 text-xs text-dim">
        Oben rechts unter „Fragen“ beantwortet ein Claude-Modell alle Fragen zur App und zu wessamedia. Dafür braucht die App einen
        Anthropic-Schlüssel: auf console.anthropic.com anmelden, unter „API Keys“ einen Schlüssel anlegen, hier einfügen. Die Antworten kosten
        wenige Cent je Frage vom Guthaben dieses Kontos. Der Schlüssel bleibt verschlüsselt auf diesem Rechner.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        {status?.eingerichtet ? (
          <>
            <span className="text-sm text-produktiv">Eingerichtet, Modell {status.modell}</span>
            <button type="button" onClick={assistentOeffnen} className="knopf-primaer rounded-chip px-3 py-1.5 text-sm">
              Jetzt fragen
            </button>
            <button type="button" disabled={laeuft} onClick={() => void entfernen()} className="rounded-chip bg-panel-2 px-3 py-1.5 text-sm text-ink hover:bg-inaktiv disabled:opacity-40">
              Schlüssel entfernen
            </button>
          </>
        ) : (
          <>
            <input
              type="password"
              className={`${FELD} sm:max-w-[360px]`}
              placeholder="sk-ant-…"
              value={schluessel}
              autoComplete="off"
              onChange={(e) => setSchluessel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void speichern()
              }}
            />
            <button type="button" disabled={laeuft || !schluessel.trim()} onClick={() => void speichern()} className="knopf-primaer rounded-chip px-3 py-1.5 text-sm disabled:opacity-50">
              Speichern
            </button>
          </>
        )}
      </div>

      <div className="mt-5 border-t border-panel-2 pt-4">
        <p className="text-sm">Wissen über wessamedia</p>
        <p className="mt-0.5 text-xs text-dim">
          Was hier steht, weiß der Assistent zusätzlich zur Anleitung, bei allen dreien. Einfach als Text hineinschreiben, wie du es einem neuen
          Kollegen erklären würdest. Fragen zur Firma oder zu Kunden beantwortet er nur aus diesen Texten, er erfindet nichts.
        </p>
        {wissenFehler && <p className="mt-2 text-sm text-unproduktiv">{wissenFehler}</p>}
        {wissen === null && !wissenFehler && <p className="mt-2 text-sm text-dim">Lädt …</p>}
        {wissen !== null && !wissenFehler && (
          <div className="mt-3 flex flex-col gap-4">
            {eintraege.map((e) => {
              const geaendert = (entwurf[e.schluessel] ?? '') !== (e.gespeichert?.inhalt ?? '')
              return (
                <div key={e.schluessel}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm text-mute">{e.titel}</p>
                    {e.gespeichert?.inhalt && (
                      <span className="text-xs text-dim">
                        zuletzt geändert {kurzDatum(e.gespeichert.geaendertAm.slice(0, 10))} {uhrzeit(e.gespeichert.geaendertAm)}
                      </span>
                    )}
                  </div>
                  <textarea
                    className={`${FELD} mt-1 min-h-[120px] resize-y`}
                    placeholder={e.platzhalter}
                    value={entwurf[e.schluessel] ?? ''}
                    onFocus={() => {
                      if (!geaendert) wissenLaden()
                    }}
                    onChange={(ev) => setEntwurf((alt) => ({ ...alt, [e.schluessel]: ev.target.value }))}
                  />
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-xs text-dim">{(entwurf[e.schluessel] ?? '').length} Zeichen</span>
                    <button
                      type="button"
                      disabled={!geaendert || speichert !== null}
                      onClick={() => void wissenSpeichern(e.schluessel, e.titel)}
                      className="rounded-chip bg-ink px-3 py-1.5 text-xs text-ground transition-colors hover:bg-white disabled:opacity-40"
                    >
                      {speichert === e.schluessel ? 'Speichert …' : 'Speichern'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Karte>
  )
}
