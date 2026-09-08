import type { ReactElement } from 'react'
import { Platzhalter } from '../components/Platzhalter'

export function TeamScreen(): ReactElement {
  return (
    <Platzhalter titel="Team" schritt={9} beschreibung="Alle drei nebeneinander, sortiert nach Level." />
  )
}
