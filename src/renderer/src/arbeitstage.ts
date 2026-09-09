import { useEffect, useState } from 'react'

/*
 * Wie viele Tage die Woche gearbeitet wird (5, 6 oder 7). Das Team arbeitet Montag bis Sonntag,
 * deshalb Standard 7. Bestimmt den Tagesrichtwert (Gesamtziel geteilt durch Arbeitstage), die
 * Restlaufzeit auf der Woche und die Hochrechnung der Liga-Vorschau. Liegt je Rechner in
 * localStorage; der Urlaub in der Liga rechnet weiterhin mit Montag bis Freitag (Datenbank).
 */

export const ARBEITSTAGE_STANDARD = 7
const SCHLUESSEL = 'arbeitstage'
const EREIGNIS = 'arbeitstage-geaendert'

export function arbeitstage(): number {
  try {
    const wert = Number(localStorage.getItem(SCHLUESSEL))
    return wert >= 5 && wert <= 7 ? wert : ARBEITSTAGE_STANDARD
  } catch {
    return ARBEITSTAGE_STANDARD
  }
}

export function arbeitstageSetzen(tage: number): void {
  try {
    localStorage.setItem(SCHLUESSEL, String(tage))
  } catch {
    /* localStorage nicht verfügbar */
  }
  window.dispatchEvent(new CustomEvent(EREIGNIS))
}

/** Die Arbeitstage als React-Wert, aktualisiert sich, wenn sie in den Einstellungen geändert werden. */
export function useArbeitstage(): number {
  const [tage, setTage] = useState(arbeitstage)
  useEffect(() => {
    const handler = (): void => setTage(arbeitstage())
    window.addEventListener(EREIGNIS, handler)
    return () => window.removeEventListener(EREIGNIS, handler)
  }, [])
  return tage
}
