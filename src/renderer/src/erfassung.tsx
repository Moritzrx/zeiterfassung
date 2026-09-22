import { useEffect, useState } from 'react'
import type { ErfassungsStatus } from '@shared/typen'

const LEER: ErfassungsStatus = {
  zustand: 'nicht-angemeldet',
  laufenderBlock: null,
  inaktivSeit: null,
  pausiertSeit: null,
  eigenesFenster: false,
  fokus: null,
  weg: null,
  offeneAbwesenheiten: [],
  nurFokus: true,
  heuteProduktivSekunden: 0,
  wocheProduktivSekunden: 0,
  rang: 0,
  neuerRang: null,
  unsynchronisiert: 0,
  letzterSync: null,
  syncFehler: null,
  warnung: null
}

/** Der aktuelle Stand der Erfassung, alle 5 Sekunden frisch aus dem Hintergrundprozess. */
export function useErfassung(): ErfassungsStatus {
  const [status, setStatus] = useState<ErfassungsStatus>(LEER)

  useEffect(() => {
    if (!window.api) return
    void window.api.erfassung.status().then(setStatus)
    return window.api.erfassung.onStatus(setStatus)
  }, [])

  return status
}

/** Eine Uhr, die im gegebenen Abstand tickt. Sparsam einsetzen: jeder Tick rendert den Baustein neu. */
export function useTakt(millisekunden: number): number {
  const [jetzt, setJetzt] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setJetzt(Date.now()), millisekunden)
    // Wird das Fenster nach Stunden wieder sichtbar, sofort ticken (Tageswechsel, 22. September 2026).
    const sichtbar = (): void => {
      if (document.visibilityState === 'visible') setJetzt(Date.now())
    }
    document.addEventListener('visibilitychange', sichtbar)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', sichtbar)
    }
  }, [millisekunden])
  return jetzt
}

/** Eine Uhr, die jede Sekunde tickt, nur für kleine laufende Zähler (nicht für ganze Screens). */
export function useSekundentakt(): number {
  return useTakt(1000)
}
