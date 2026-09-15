import liste from './aenderungen.json'

/** Ein Eintrag der Änderungsliste (Update-News), neueste Version zuerst. Quelle: aenderungen.json (auch für die GitHub-Veröffentlichung). */
export interface Aenderung {
  version: string
  datum: string
  titel: string
  punkte: string[]
}

export const AENDERUNGEN: Aenderung[] = liste as Aenderung[]

/** Versionsvergleich "1.0.48" gegen "1.0.9": true, wenn a neuer als b ist. */
export function versionNeuer(a: string, b: string): boolean {
  const x = a.split('.').map((t) => Number.parseInt(t, 10) || 0)
  const y = b.split('.').map((t) => Number.parseInt(t, 10) || 0)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

/**
 * Die Einträge, die seit der zuletzt gesehenen Version dazugekommen sind (bis einschließlich der laufenden).
 * Ohne gesehene Version nur der Eintrag der laufenden Version; gibt es keinen, die neueste Version der Liste,
 * sofern sie nicht neuer als die laufende ist.
 */
export function neueAenderungen(laufend: string, gesehen: string | null): Aenderung[] {
  const passend = AENDERUNGEN.filter((a) => !versionNeuer(a.version, laufend))
  if (!gesehen) {
    const genau = passend.find((a) => a.version === laufend)
    return genau ? [genau] : passend.slice(0, 1)
  }
  return passend.filter((a) => versionNeuer(a.version, gesehen))
}
