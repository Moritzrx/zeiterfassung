import type { ReactElement } from 'react'
import { Platzhalter } from '../components/Platzhalter'

export function AuswertungScreen(): ReactElement {
  return (
    <Platzhalter
      titel="Auswertung"
      schritt={8}
      beschreibung="Monatsverlauf, Trend, Verteilung und Hochrechnungen."
    />
  )
}
