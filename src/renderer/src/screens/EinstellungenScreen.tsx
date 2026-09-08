import type { ReactElement } from 'react'
import { Platzhalter } from '../components/Platzhalter'

export function EinstellungenScreen(): ReactElement {
  return (
    <Platzhalter
      titel="Einstellungen"
      schritt={10}
      beschreibung="Regeln, Ziele, Symbole, Untätigkeit, Urlaubswochen, Abmelden."
    />
  )
}
