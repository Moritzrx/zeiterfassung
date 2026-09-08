import { useEffect, useState } from 'react'
import type { ErfassungsStatus } from '@shared/typen'

const LEER: ErfassungsStatus = {
  zustand: 'nicht-angemeldet',
  laufenderBlock: null,
  inaktivSeit: null,
  pausiertSeit: null,
  heuteProduktivSekunden: 0,
  wocheProduktivSekunden: 0,
  rang: 0,
  neuerRang: null,
  unsynchronisiert: 0,
  letzterSync: null,
  syncFehler: null
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

/** Eine Uhr, die jede Sekunde tickt, für laufende Zähler. */
export function useSekundentakt(): number {
  const [jetzt, setJetzt] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setJetzt(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return jetzt
}
