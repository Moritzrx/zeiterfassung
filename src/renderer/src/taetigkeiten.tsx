import { useEffect, useState } from 'react'

/** Alle bekannten Tätigkeitsnamen für die Vorschläge beim Tippen. */
export function useTaetigkeiten(): string[] {
  const [liste, setListe] = useState<string[]>([])

  useEffect(() => {
    if (!window.api) return
    const laden = (): void => {
      void window.api.taetigkeiten.liste().then(setListe)
    }
    laden()
    return window.api.bloecke.onAenderung(laden)
  }, [])

  return liste
}
