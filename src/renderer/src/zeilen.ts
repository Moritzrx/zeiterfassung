import { fensterInfo } from '@shared/fenster'
import { berlinZuUtc } from '@shared/zeit'
import type { Block } from '@shared/typen'

/*
 * Zeilen für Blocklisten: direkt aufeinanderfolgende automatische Blöcke desselben Programms (bei Browsern
 * derselben Seite) mit gleicher Bewertung und Tätigkeit werden zu einer Zeile "N Abschnitte" zusammengefasst,
 * damit Listen nicht in Vier-Minuten-Stücke zerfallen (Wunsch vom 10. September 2026). Nur Anzeige, die Blöcke
 * bleiben getrennt gespeichert. Genutzt vom Heute-Screen und von der Überschneidungsliste beim Eintragen.
 */

/** Eine Zeile: ein Block oder mehrere zusammenhängende Abschnitte desselben Programms. */
export interface Zeile {
  /** Kennung des ersten Blocks, dient als Schlüssel */
  id: string
  /** Was die Zeile zeigt: bei mehreren Abschnitten der längste mit der Zeitspanne der ganzen Gruppe */
  block: Block
  bloecke: Block[]
  sekunden: number
}

/** Bis zu dieser Lücke gelten zwei Blöcke desselben Programms als zusammenhängend. */
export const ZEILEN_LUECKE_MS = 2 * 60_000

/** Eine Zeit ohne jede Aufzeichnung an einem Tag (kein Fokus lief), die man nachtragen kann. */
export interface Luecke {
  start: string
  ende: string
}

/** Lücken ab dieser Länge werden in der Tagesliste angeboten. */
export const LUECKE_MIN_MS = 15 * 60_000
/** Nur innerhalb dieser Uhrzeiten (Berlin) gelten fehlende Aufzeichnungen als Lücke. */
export const LUECKE_VON_STUNDE = 7
export const LUECKE_BIS_STUNDE = 20

/**
 * Lücken ohne Aufzeichnung an einem Tag (15. September 2026, "wir tragen produktive Zeit hinterher ein"): zwischen
 * 7 und 20 Uhr Berliner Zeit, ab 15 Minuten, ohne Block irgendeiner Bewertung (auch Pausen zählen als Aufzeichnung).
 * Am heutigen Tag endet die Betrachtung jetzt. Liefert die Lücken chronologisch.
 */
export function lueckenFinden(bloecke: Block[], datum: string, jetztMs: number | null): Luecke[] {
  const [jahr, monat, tag] = datum.split('-').map(Number)
  const fensterVon = berlinZuUtc(jahr, monat, tag, LUECKE_VON_STUNDE, 0).getTime()
  let fensterBis = berlinZuUtc(jahr, monat, tag, LUECKE_BIS_STUNDE, 0).getTime()
  if (jetztMs !== null) fensterBis = Math.min(fensterBis, jetztMs)
  if (fensterBis - fensterVon < LUECKE_MIN_MS) return []
  const belegt = bloecke
    .filter((b) => !b.geloeschtAm)
    .map((b) => [Date.parse(b.start), Date.parse(b.ende)] as [number, number])
    .sort((a, b) => a[0] - b[0])
  const luecken: Luecke[] = []
  let frei = fensterVon
  for (const [s, e] of belegt) {
    if (s - frei >= LUECKE_MIN_MS && frei < fensterBis) luecken.push({ start: new Date(frei).toISOString(), ende: new Date(Math.min(s, fensterBis)).toISOString() })
    frei = Math.max(frei, e)
    if (frei >= fensterBis) break
  }
  if (fensterBis - frei >= LUECKE_MIN_MS) luecken.push({ start: new Date(frei).toISOString(), ende: new Date(fensterBis).toISOString() })
  return luecken
}

export function blockSekunden(b: Block): number {
  return (Date.parse(b.ende) - Date.parse(b.start)) / 1000
}

/**
 * Fasst die Blöcke zu Zeilen zusammen. Der laufende Block (laufendId) und Abwesenheit (Bewertung inaktiv)
 * bleiben für sich. Erwartet die Blöcke in zeitlicher Reihenfolge.
 */
export function zeilenBilden(sortiert: Block[], laufendId: string | null): Zeile[] {
  const zeilen: Zeile[] = []
  for (const b of sortiert) {
    const letzte = zeilen[zeilen.length - 1]
    const vorher = letzte?.bloecke[letzte.bloecke.length - 1]
    const passt =
      !!letzte &&
      !!vorher &&
      b.id !== laufendId &&
      vorher.id !== laufendId &&
      b.quelle === 'auto' &&
      vorher.quelle === 'auto' &&
      b.bewertung !== 'inaktiv' &&
      b.programm === vorher.programm &&
      b.bewertung === vorher.bewertung &&
      b.taetigkeit === vorher.taetigkeit &&
      fensterInfo(b.programm, b.fenstertitel).seite === fensterInfo(vorher.programm, vorher.fenstertitel).seite &&
      Date.parse(b.start) - Date.parse(vorher.ende) <= ZEILEN_LUECKE_MS
    if (passt && letzte) {
      letzte.bloecke.push(b)
      letzte.sekunden += blockSekunden(b)
    } else {
      zeilen.push({ id: b.id, block: b, bloecke: [b], sekunden: blockSekunden(b) })
    }
  }
  for (const z of zeilen) {
    if (z.bloecke.length < 2) continue
    const laengster = z.bloecke.reduce((a, b) => (blockSekunden(b) > blockSekunden(a) ? b : a))
    z.block = {
      ...laengster,
      id: z.id,
      start: z.bloecke[0].start,
      ende: z.bloecke[z.bloecke.length - 1].ende,
      manuellGeprueft: z.bloecke.every((b) => b.manuellGeprueft)
    }
  }
  return zeilen
}
