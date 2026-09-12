import { useEffect, useMemo, useState } from 'react'
import { taetigkeitSchluessel } from '@shared/regeln'

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

/** Vergleichsschlüssel der Tätigkeiten, die "unterwegs" (nicht am Rechner) sind. */
export function useUnterwegs(): Record<string, boolean> {
  const [zuordnung, setZuordnung] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!window.api) return
    const laden = (): void => {
      void window.api.taetigkeiten.unterwegs().then(setZuordnung)
    }
    laden()
    return window.api.bloecke.onAenderung(laden)
  }, [])

  return zuordnung
}

/**
 * Tätigkeiten nach Ort (12. September 2026): `amRechner` für den Fokus, `unterwegs` für "Ich bin weg" und die
 * Rückfrage nach einer Abwesenheit. Solange keine Tätigkeit als unterwegs markiert ist (Skript 16 noch nicht
 * gelaufen oder nichts eingeordnet), bekommen beide Seiten die ganze Liste.
 */
export function useTaetigkeitenNachOrt(): { alle: string[]; amRechner: string[]; unterwegs: string[]; eingeordnet: boolean } {
  const alle = useTaetigkeiten()
  const zuordnung = useUnterwegs()
  return useMemo(() => {
    const unterwegs = alle.filter((t) => zuordnung[taetigkeitSchluessel(t)])
    const eingeordnet = unterwegs.length > 0
    const amRechner = eingeordnet ? alle.filter((t) => !zuordnung[taetigkeitSchluessel(t)]) : alle
    return { alle, amRechner, unterwegs: eingeordnet ? unterwegs : alle, eingeordnet }
  }, [alle, zuordnung])
}
