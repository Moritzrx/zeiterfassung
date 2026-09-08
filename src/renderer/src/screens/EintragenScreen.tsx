import type { ReactElement } from 'react'
import { Platzhalter } from '../components/Platzhalter'

export function EintragenScreen(): ReactElement {
  return (
    <Platzhalter
      titel="Eintragen"
      schritt={7}
      beschreibung="Zeiten von Hand: Drehs, Kundentermine, Telefonate, Fahrten."
    />
  )
}
