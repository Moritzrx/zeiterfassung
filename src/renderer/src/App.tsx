import { memo, startTransition, useEffect, useRef, useState, type ReactElement } from 'react'
import { AUSZEICHNUNGEN } from '@shared/auszeichnungen'
import { Fehlerschutz } from './components/Fehlerschutz'
import { FokusDialogHalter, fokusDialogOeffnen } from './components/FokusDialog'
import { WegDialogHalter } from './components/WegDialog'
import { Hinweise, hinweisZeigen } from './components/Hinweis'
import { UpdateHinweis } from './components/UpdateHinweis'
import { Wochenrueckblick } from './components/Wochenrueckblick'
import { Hintergrund } from './components/Hintergrund'
import { Kopfzeile } from './components/Kopfzeile'
import { Navigation, SCREEN_REIHENFOLGE, type ScreenId } from './components/Navigation'
import { RangAufstieg } from './components/RangAufstieg'
import { NutzerProvider, useNutzer } from './nutzer'
import { SymbolProvider } from './symbole'
import { klickToeneEinrichten, tonSpielen } from './toene'
import { LoginScreen } from './screens/LoginScreen'
import { HeuteScreen } from './screens/HeuteScreen'
import { WocheScreen } from './screens/WocheScreen'
import { AuswertungScreen } from './screens/AuswertungScreen'
import { TeamScreen } from './screens/TeamScreen'
import { EintragenScreen } from './screens/EintragenScreen'
import { EinstellungenScreen } from './screens/EinstellungenScreen'

const SCREENS: Record<ScreenId, () => ReactElement> = {
  heute: HeuteScreen,
  woche: WocheScreen,
  auswertung: AuswertungScreen,
  team: TeamScreen,
  eintragen: EintragenScreen,
  einstellungen: EinstellungenScreen
}

const SCREEN_NAMEN: Record<ScreenId, string> = {
  heute: 'Heute',
  woche: 'Woche',
  auswertung: 'Auswertung',
  team: 'Team',
  eintragen: 'Eintragen',
  einstellungen: 'Einstellungen'
}

/** Wie lange der alte Screen beim Wechsel noch sichtbar hinausgleitet (passend zu styles.css). */
const RAUS_MS = 180

/**
 * Der Inhalt eines Screens, vom Wechsel abgekoppelt: `memo` sorgt dafür, dass ein Klick in der
 * Navigation nur die Hüllen neu rendert und nicht alle sechs Screens samt Diagrammen.
 */
const ScreenInhalt = memo(function ScreenInhalt({ id }: { id: ScreenId }): ReactElement {
  const Screen = SCREENS[id]
  return <Screen />
})

/**
 * Screens bleiben nach dem ersten Besuch geladen und behalten ihre Scroll-Position.
 * Nicht aktive Screens werden nur unsichtbar (Deckkraft 0, `inert`), nicht aus dem Layout
 * genommen: so bleiben sie als fertige Ebene im Grafikspeicher, und ein Wechsel ist reines
 * Gleiten und Überblenden auf dem Compositor, ohne Layout, Neuzeichnen oder React-Arbeit.
 */
function Oberflaeche(): ReactElement {
  const [aktiv, setAktiv] = useState<ScreenId>('heute')
  const [besucht, setBesucht] = useState<ScreenId[]>(['heute'])
  const [richtung, setRichtung] = useState<1 | -1>(1)
  const [abgang, setAbgang] = useState<ScreenId | null>(null)
  const zaehler = useRef(0)

  function wechseln(ziel: ScreenId): void {
    if (ziel === aktiv) return
    tonSpielen('wischen')
    const r: 1 | -1 = SCREEN_REIHENFOLGE.indexOf(ziel) > SCREEN_REIHENFOLGE.indexOf(aktiv) ? 1 : -1
    setRichtung(r)
    setAbgang(aktiv)
    setAktiv(ziel)
    zaehler.current++
    if (!besucht.includes(ziel)) {
      // Neuer Screen: mit niedriger Priorität aufbauen, damit die Reaktion sofort kommt.
      startTransition(() => setBesucht((alte) => [...alte, ziel]))
    }
  }

  // Den verabschiedeten Screen nach der Animation verstecken.
  useEffect(() => {
    if (!abgang) return
    const timer = window.setTimeout(() => setAbgang(null), RAUS_MS)
    return () => window.clearTimeout(timer)
  }, [abgang, aktiv])

  // Klick-Ton für alle Knöpfe und klickbaren Zeilen.
  useEffect(() => klickToeneEinrichten(), [])

  // Tastenkürzel: Strg+1 bis Strg+6 (Mac: Cmd) wechseln den Screen, Leertaste pausiert die Erfassung
  // oder setzt sie fort, aber nur, wenn gerade kein Eingabefeld oder Knopf den Fokus hat.
  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      const ziel = e.target as HTMLElement | null
      const imFeld = !!ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA' || ziel.tagName === 'SELECT' || ziel.isContentEditable)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && /^[1-6]$/.test(e.key)) {
        e.preventDefault()
        wechselnRef.current(SCREEN_REIHENFOLGE[Number(e.key) - 1])
        return
      }
      // Strg+F (Mac: Cmd+F) öffnet den Fokus-Dialog.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        fokusDialogOeffnen()
        return
      }
      if (e.key === ' ' && !imFeld && (!ziel || ziel === document.body) && window.api) {
        e.preventDefault()
        void window.api.erfassung.status().then((s) => (s.zustand === 'pausiert' ? window.api.erfassung.fortsetzen() : window.api.erfassung.pause()))
      }
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [])
  // Der Hintergrundprozess öffnet den Fokus-Dialog aus dem Symbol-Menü oder nach der Erinnerung "Kein Fokus".
  useEffect(() => {
    if (!window.api) return
    return window.api.fokus.onDialogOeffnen(() => fokusDialogOeffnen())
  }, [])
  const wechselnRef = useRef(wechseln)
  wechselnRef.current = wechseln

  // Die übrigen Screens kurz nach dem Start im Hintergrund aufbauen (einer nach dem anderen, mit
  // niedriger Priorität), damit auch der erste Klick auf einen Screen ohne Aufbau-Ruckler gleitet.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setBesucht((alte) => {
        const naechster = SCREEN_REIHENFOLGE.find((id) => !alte.includes(id))
        if (!naechster) {
          window.clearInterval(timer)
          return alte
        }
        return [...alte, naechster]
      })
    }, 900)
    return () => window.clearInterval(timer)
  }, [])

  // Neue Auszeichnungen kurz unten einblenden, egal auf welchem Screen.
  useEffect(() => {
    if (!window.api) return
    return window.api.auszeichnungen.onNeu((neue) => {
      if (!neue.length) return
      const titel = neue.map((a) => AUSZEICHNUNGEN[a.typ].titel).join(', ')
      tonSpielen('auszeichnung')
      hinweisZeigen(`Auszeichnung freigeschaltet: ${titel}`)
    })
  }, [])

  return (
    <div className="flex h-full flex-col">
      <Hintergrund gedimmt={aktiv !== 'heute'} />
      <Kopfzeile />
      <main className="relative flex-1 overflow-hidden">
        {SCREEN_REIHENFOLGE.filter((id) => besucht.includes(id)).map((id) => {
          const zustand = id === aktiv ? 'rein' : id === abgang ? 'raus' : 'versteckt'
          const klasse =
            zustand === 'rein'
              ? richtung === 1
                ? 'screen-rein-rechts'
                : 'screen-rein-links'
              : zustand === 'raus'
                ? richtung === 1
                  ? 'screen-raus-links'
                  : 'screen-raus-rechts'
                : 'screen-versteckt'
          return (
            <div
              key={id}
              inert={zustand === 'versteckt'}
              aria-hidden={zustand !== 'rein' || undefined}
              className={`screen-ebene absolute inset-0 overflow-y-auto ${klasse} ${zustand === 'raus' ? 'pointer-events-none' : ''}`}
            >
              <div className="mx-auto w-full max-w-[800px] px-6 pt-4 pb-10">
                <Fehlerschutz bereich={SCREEN_NAMEN[id]}>
                  <ScreenInhalt id={id} />
                </Fehlerschutz>
              </div>
            </div>
          )
        })}
      </main>
      <UpdateHinweis />
      <Navigation aktiv={aktiv} onWechsel={wechseln} />
      <Hinweise />
      <Fehlerschutz bereich="Aufstieg">
        <RangAufstieg />
      </Fehlerschutz>
      <Fehlerschutz bereich="Wochenrückblick">
        <Wochenrueckblick />
      </Fehlerschutz>
      <Fehlerschutz bereich="Fokus">
        <FokusDialogHalter />
        <WegDialogHalter />
      </Fehlerschutz>
    </div>
  )
}

/** Entscheidet zwischen Anmeldung und Oberfläche. */
function Weiche(): ReactElement {
  const { status } = useNutzer()
  if (status === null) return <div className="h-full" />
  if (!status.angemeldet) return <LoginScreen />
  return (
    <SymbolProvider>
      <Oberflaeche />
    </SymbolProvider>
  )
}

export default function App(): ReactElement {
  return (
    <NutzerProvider>
      <Weiche />
    </NutzerProvider>
  )
}
