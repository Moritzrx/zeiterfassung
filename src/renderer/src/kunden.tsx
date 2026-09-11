import { useEffect, useState } from 'react'

/** Alle bekannten Kunden (Projekte) des Teams, alphabetisch; lädt bei jeder Blockänderung neu. */
export function useKunden(): string[] {
  const [liste, setListe] = useState<string[]>([])

  useEffect(() => {
    if (!window.api) return
    const laden = (): void => {
      void window.api.kunden.liste().then(setListe)
    }
    laden()
    return window.api.bloecke.onAenderung(laden)
  }, [])

  return liste
}
