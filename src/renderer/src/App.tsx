import { startTransition, useEffect, useRef, useState, type ReactElement } from 'react'
import { AUSZEICHNUNGEN } from '@shared/auszeichnungen'
import { Hinweise, hinweisZeigen } from './components/Hinweis'
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

interface Auftritt {
  id: ScreenId
  phase: 'rein' | 'raus'
  /** 1 = nach links weiterblättern, -1 = zurück */
  richtung: 1 | -1
  /** Wie weit der Screen gescrollt war, als er verabschiedet wurde */
  scrollTop: number
}

/** Das eigentliche Fenster mit Kopfzeile, Inhalt und Navigation. */
function Oberflaeche(): ReactElement {
  const [aktiv, setAktiv] = useState<ScreenId>('heute')
  // Alle Screens, die gerade sichtbar sind: der aktive und höchstens kurz noch der vorherige.
  const [auftritte, setAuftritte] = useState<Auftritt[]>([{ id: 'heute', phase: 'rein', richtung: 1, scrollTop: 0 }])
  const inhalt = useRef<HTMLElement>(null)

  function wechseln(ziel: ScreenId): void {
    if (ziel === aktiv) return
    const richtung: 1 | -1 = SCREEN_REIHENFOLGE.indexOf(ziel) > SCREEN_REIHENFOLGE.indexOf(aktiv) ? 1 : -1
    const scrollTop = inhalt.current?.scrollTop ?? 0
    // Erst sofort reagieren: Markierung wandert, alter Screen beginnt zu gleiten ...
    setAktiv(ziel)
    setAuftritte((alte) =>
      alte.filter((a) => a.id !== ziel).map((a) => (a.phase === 'rein' ? { ...a, phase: 'raus' as const, richtung, scrollTop } : a))
    )
    inhalt.current?.scrollTo({ top: 0 })
    // ... und den neuen Screen mit niedrigerer Priorität aufbauen, damit nichts hakt.
    startTransition(() => {
      setAuftritte((alte) => [...alte.filter((a) => a.id !== ziel), { id: ziel, phase: 'rein', richtung, scrollTop: 0 }])
    })
  }

  // Verabschiedete Screens nach der Animation wegräumen.
  useEffect(() => {
    if (!auftritte.some((a) => a.phase === 'raus')) return
    const timer = window.setTimeout(() => setAuftritte((alte) => alte.filter((a) => a.phase !== 'raus')), RAUS_MS)
    return () => window.clearTimeout(timer)
  }, [auftritte])

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
      <Kopfzeile />
      <main ref={inhalt} className="relative flex-1 overflow-y-auto">
        {auftritte.map((a) => {
          const Screen = SCREENS[a.id]
          const klasse =
            a.phase === 'rein'
              ? a.richtung === 1
                ? 'screen-rein-rechts'
                : 'screen-rein-links'
              : a.richtung === 1
                ? 'screen-raus-links'
                : 'screen-raus-rechts'
          return (
            <div
              key={a.id}
              aria-hidden={a.phase === 'raus' || undefined}
              className={`${klasse} mx-auto w-full max-w-[800px] px-6 pt-4 pb-10 ${
                a.phase === 'raus' ? 'pointer-events-none absolute inset-x-0' : ''
              }`}
              style={a.phase === 'raus' ? { top: -a.scrollTop } : undefined}
            >
              <Screen />
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
