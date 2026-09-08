import type { Regel, RegelBewertung } from './typen'

export interface Zuordnung {
  taetigkeit: string | null
  bewertung: RegelBewertung
  regelId: string
}

/**
 * Wendet die Regeln auf Programm und Fenstertitel an.
 * Reihenfolge bei mehreren Treffern: persönliche Regel vor Team-Regel,
 * Programm vor Fenstertitel, höhere Priorität, längeres Muster.
 * Passt keine Regel, kommt null zurück (= ungeklärt).
 */
export function regelnAnwenden(
  programm: string | null,
  titel: string | null,
  regeln: Regel[],
  userId: string
): Zuordnung | null {
  const p = (programm ?? '').toLowerCase()
  const t = (titel ?? '').toLowerCase()
  const treffer = regeln.filter((r) => {
    if (!r.aktiv || !r.muster) return false
    if (r.giltFuer !== null && r.giltFuer !== userId) return false
    const muster = r.muster.toLowerCase()
    return r.feld === 'programm' ? p.includes(muster) : t.length > 0 && t.includes(muster)
  })
  if (treffer.length === 0) return null
  treffer.sort(
    (a, b) =>
      (a.giltFuer ? 0 : 1) - (b.giltFuer ? 0 : 1) ||
      (a.feld === 'programm' ? 0 : 1) - (b.feld === 'programm' ? 0 : 1) ||
      b.prioritaet - a.prioritaet ||
      b.muster.length - a.muster.length
  )
  const r = treffer[0]
  return { taetigkeit: r.taetigkeit, bewertung: r.bewertung, regelId: r.id }
}

/**
 * Schlägt aus einem Fenstertitel das Muster für eine neue Regel vor:
 * "Posteingang - Gmail – Google Chrome" wird zu "Gmail".
 */
export function musterVorschlag(titel: string | null): string {
  if (!titel) return ''
  const ohneBrowser = titel.replace(
    /\s[–—-]\s(Google Chrome|Microsoft Edge|Mozilla Firefox|Firefox|Safari|Opera|Brave|Arc)\s*$/i,
    ''
  )
  const teile = ohneBrowser.split(/\s[–—-]\s|\s\|\s/)
  const letzter = teile[teile.length - 1]?.trim() || ohneBrowser.trim()
  return letzter.slice(0, 40)
}

/** Vergleichsschlüssel für Tätigkeitsnamen: ohne Groß/Klein, Leerzeichen, Binde- und Unterstriche. */
export function taetigkeitSchluessel(name: string): string {
  return name.toLowerCase().replace(/[\s\-_]+/g, '')
}
