import { useEffect, useState } from 'react'

/*
 * Welcher Hintergrund hinter der App liegt (Wunsch des Auftraggebers vom 10. September 2026: das Logo als
 * Hintergrund ausprobieren, aber jederzeit zurück zum bisherigen):
 *   logo      = Wortmarke "wessamedia" als Wasserzeichen und das Linienmuster des Logos, orangene Lichtketten
 *   klassisch = Raster, Zifferblatt-Ringe und geschwungene Lichtbahnen in Grün, Orange und Lila
 * Liegt je Rechner in localStorage.
 */

export type HintergrundArt = 'logo' | 'klassisch'

export const HINTERGRUND_STANDARD: HintergrundArt = 'logo'
const SCHLUESSEL = 'hintergrund'
const EREIGNIS = 'hintergrund-geaendert'

export function hintergrundArt(): HintergrundArt {
  try {
    const wert = localStorage.getItem(SCHLUESSEL)
    return wert === 'logo' || wert === 'klassisch' ? wert : HINTERGRUND_STANDARD
  } catch {
    return HINTERGRUND_STANDARD
  }
}

export function hintergrundArtSetzen(art: HintergrundArt): void {
  try {
    localStorage.setItem(SCHLUESSEL, art)
  } catch {
    /* localStorage nicht verfügbar */
  }
  window.dispatchEvent(new CustomEvent(EREIGNIS))
}

/** Die Hintergrund-Art als React-Wert, aktualisiert sich bei Änderung in den Einstellungen. */
export function useHintergrundArt(): HintergrundArt {
  const [art, setArt] = useState(hintergrundArt)
  useEffect(() => {
    const handler = (): void => setArt(hintergrundArt())
    window.addEventListener(EREIGNIS, handler)
    return () => window.removeEventListener(EREIGNIS, handler)
  }, [])
  return art
}
