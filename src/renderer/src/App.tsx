import { useState, type ReactElement } from 'react'
import { Kopfzeile } from './components/Kopfzeile'
import { Navigation, type ScreenId } from './components/Navigation'
import { NutzerProvider, useNutzer } from './nutzer'
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

/** Das eigentliche Fenster mit Kopfzeile, Inhalt und Navigation. */
function Oberflaeche(): ReactElement {
  const [aktiv, setAktiv] = useState<ScreenId>('heute')
  const Screen = SCREENS[aktiv]

  return (
    <div className="flex h-full flex-col">
      <Kopfzeile />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[800px] px-6 pt-4 pb-10">
          <Screen />
        </div>
      </main>
      <Navigation aktiv={aktiv} onWechsel={setAktiv} />
    </div>
  )
}

/** Entscheidet zwischen Anmeldung und Oberfläche. */
function Weiche(): ReactElement {
  const { status } = useNutzer()
  if (status === null) return <div className="h-full" />
  if (!status.angemeldet) return <LoginScreen />
  return <Oberflaeche />
}

export default function App(): ReactElement {
  return (
    <NutzerProvider>
      <Weiche />
    </NutzerProvider>
  )
}
