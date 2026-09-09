import { startTransition, useEffect, useRef, useState, type ReactElement } from 'react'
import { AUSZEICHNUNGEN } from '@shared/auszeichnungen'
import { Hinweise, hinweisZeigen } from './components/Hinweis'
import { Hintergrund } from './components/Hintergrund'
import { Kopfzeile } from './components/Kopfzeile'
import { Navigation, SCREEN_REIHENFOLGE, type ScreenId } from './components/Navigation'
import { RangAufstieg } from './components/RangAufstieg'
import { NutzerProvider, useNutzer } from './nutzer'
import { SymbolProvider } from './symbole'
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

/** Wie lange der alte Screen beim Wechsel noch sichtbar hinausgleitet (passend zu styles.css). */
const RAUS_MS = 260

/**
 * Screens bleiben nach dem ersten Besuch geladen und behalten ihre Scroll-Position.
 * Ein Wechsel ist dann nur noch ein Gleiten zwischen zwei fertigen Screens: nichts
 * wird neu aufgebaut, keine Diagramme animieren beim Wechsel.
 */
function Oberflaeche(): ReactElement {
  const [aktiv, setAktiv] = useState<ScreenId>('heute')
  const [besucht, setBesucht] = useState<ScreenId[]>(['heute'])
  const [richtung, setRichtung] = useState<1 | -1>(1)
  const [abgang, setAbgang] = useState<ScreenId | null>(null)
  const zaehler = useRef(0)

  function wechseln(ziel: ScreenId): void {
    if (ziel === aktiv) return
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

  // Neue Auszeichnungen kurz unten einblenden, egal auf welchem Screen.
  useEffect(() => {
    if (!window.api) return
    return window.api.auszeichnungen.onNeu((neue) => {
      if (!neue.length) return
      const titel = neue.map((a) => AUSZEICHNUNGEN[a.typ].titel).join(', ')
      hinweisZeigen(`Auszeichnung freigeschaltet: ${titel}`)
    })
  }, [])

  return (
    <div className="flex h-full flex-col">
      <Hintergrund />
      <Kopfzeile />
      <main className="relative flex-1 overflow-hidden">
        {SCREEN_REIHENFOLGE.filter((id) => besucht.includes(id)).map((id) => {
          const Screen = SCREENS[id]
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
                : ''
          return (
            <div
              key={id}
              hidden={zustand === 'versteckt'}
              aria-hidden={zustand !== 'rein' || undefined}
              className={`${klasse} absolute inset-0 overflow-y-auto ${zustand === 'raus' ? 'pointer-events-none' : ''}`}
            >
              <div className="mx-auto w-full max-w-[800px] px-6 pt-4 pb-10">
                <Screen />
              </div>
            </div>
          )
        })}
      </main>
      <Navigation aktiv={aktiv} onWechsel={wechseln} />
      <Hinweise />
      <RangAufstieg />
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
