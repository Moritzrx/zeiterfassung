import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { Portal } from './Portal'
import { rangName } from '@shared/rang'
import { useErfassung } from '../erfassung'
import { RangAbzeichen } from './RangAbzeichen'

const DAUER_MS = 4000

/**
 * Die ruhige Einblendung beim Rang-Aufstieg. Erscheint nur, wenn das Fenster
 * sichtbar ist, bleibt ein paar Sekunden oder bis zum Klick, und wird pro
 * Woche für jeden Rang nur einmal gezeigt.
 */
export function RangAufstieg(): ReactElement | null {
  const status = useErfassung()
  const [gezeigt, setGezeigt] = useState<number | null>(null)
  // Zuletzt gefeierter Rang, damit bis zur nächsten Statusmeldung nichts doppelt erscheint.
  const gefeiert = useRef(0)

  const schliessen = useCallback((r: number): void => {
    gefeiert.current = Math.max(gefeiert.current, r)
    void window.api.rang.gefeiert(r)
    setGezeigt(null)
  }, [])

  // Einblenden, sobald ein neuer Rang gemeldet wird und das Fenster sichtbar ist.
  useEffect(() => {
    const neuer = status.neuerRang
    if (neuer === null || neuer <= gefeiert.current || gezeigt !== null) return
    const starten = (): void => {
      if (!document.hidden) setGezeigt(neuer)
    }
    starten()
    document.addEventListener('visibilitychange', starten)
    return () => document.removeEventListener('visibilitychange', starten)
  }, [status.neuerRang, gezeigt])

  // Nach ein paar Sekunden von selbst schließen.
  useEffect(() => {
    if (gezeigt === null) return
    const timer = window.setTimeout(() => schliessen(gezeigt), DAUER_MS)
    return () => window.clearTimeout(timer)
  }, [gezeigt, schliessen])

  if (gezeigt === null) return null

  return (
    <Portal>
    <div className="animate-aufblenden fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => schliessen(gezeigt)}>
      <div className="flex flex-col items-center text-center">
        {/* Platz für die Level-Aufstieg-Grafik (levelup.png), bis dahin das Abzeichen selbst */}
        <RangAbzeichen rang={gezeigt} groesse={160} />
        <p className="mt-6 text-sm tracking-wide text-orange uppercase">Aufstieg</p>
        <p className="mt-1 text-[56px] leading-none font-light">Rang {gezeigt}</p>
        <p className="mt-2 text-lg text-mute">{rangName(gezeigt)}</p>
      </div>
    </div>
    </Portal>
  )
}
