import type { ReactElement } from 'react'
import { Platzhalter } from '../components/Platzhalter'

export function WocheScreen(): ReactElement {
  return (
    <Platzhalter
      titel="Woche"
      schritt={6}
      beschreibung="Level-Ring, Wochendiagramm und Tätigkeiten gegen ihre Ziele."
    />
  )
}
