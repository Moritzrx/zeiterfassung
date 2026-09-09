import type { ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Hängt Dialoge und Einblendungen direkt an den body statt in den scrollenden Screen.
 * Sonst reicht das Scrollen im Dialog nach unten an die Seite dahinter durch,
 * und man landet nach dem Schließen am Ende der Liste.
 */
export function Portal({ children }: { children: ReactNode }): ReactElement {
  return createPortal(children, document.body)
}
