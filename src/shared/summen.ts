/**
 * Rechnungen auf Tagessummen. Für kurze Zeiträume kommen die Summen aus den
 * lokalen Blöcken, für lange aus der Datenbankfunktion tages_summen.
 */
import type { Tageswert, Wochenwert } from './auswertung'
import { rang } from './rang'
import { taetigkeitSchluessel } from './regeln'
import type { Block, Tagessumme } from './typen'
import { berlinDatum, datumVerschieben, datumZuTagesanfang, kalenderwoche, wochenanfang } from './zeit'

/** Tagessummen aus Blöcken, für jeden Tag von `vonDatum` bis `bisDatum` (Berlin). */
export function tagessummenAusBloecken(bloecke: Block[], vonDatum: string, bisDatum: string): Tagessumme[] {
  const gueltige = bloecke.filter((b) => !b.geloeschtAm)
  const ergebnis = new Map<string, Tagessumme>()
  let datum = vonDatum
  while (datum <= bisDatum) {
    const von = datumZuTagesanfang(datum).getTime()
    const bis = datumZuTagesanfang(datumVerschieben(datum, 1)).getTime()
    for (const b of gueltige) {
      const s = Math.max(Date.parse(b.start), von)
      const e = Math.min(Date.parse(b.ende), bis)
      if (e <= s) continue
      const schluessel = `${datum}|${b.taetigkeit ?? ''}|${b.bewertung}`
      const eintrag = ergebnis.get(schluessel) ?? { datum, taetigkeit: b.taetigkeit, bewertung: b.bewertung, sekunden: 0 }
      eintrag.sekunden += (e - s) / 1000
      ergebnis.set(schluessel, eintrag)
    }
    datum = datumVerschieben(datum, 1)
  }
  return [...ergebnis.values()]
}

/** Produktive Sekunden je Tag über den Zeitraum, fehlende Tage mit 0. */
export function produktivJeTagAusSummen(summen: Tagessumme[], vonDatum: string, bisDatum: string): Tageswert[] {
  const jeTag = new Map<string, number>()
  for (const s of summen) {
    if (s.bewertung === 'produktiv') jeTag.set(s.datum, (jeTag.get(s.datum) ?? 0) + s.sekunden)
  }
  const liste: Tageswert[] = []
  let datum = vonDatum
  while (datum <= bisDatum) {
    liste.push({ datum, sekunden: jeTag.get(datum) ?? 0 })
    datum = datumVerschieben(datum, 1)
  }
  return liste
}

/** Anteil jeder Tätigkeit an der produktiven Zeit, absteigend, Rest als "Sonstige". */
export function verteilungAusSummen(summen: Tagessumme[], maxEintraege = 8): Array<{ name: string; sekunden: number }> {
  const gruppen = new Map<string, { name: string; sekunden: number }>()
  for (const s of summen) {
    if (s.bewertung !== 'produktiv' || s.sekunden <= 0) continue
    const name = s.taetigkeit ?? 'Ohne Tätigkeit'
    const schluessel = taetigkeitSchluessel(name)
    const eintrag = gruppen.get(schluessel) ?? { name, sekunden: 0 }
    eintrag.sekunden += s.sekunden
    gruppen.set(schluessel, eintrag)
  }
  const sortiert = [...gruppen.values()].sort((a, b) => b.sekunden - a.sekunden)
  if (sortiert.length <= maxEintraege) return sortiert
  const rest = sortiert.slice(maxEintraege - 1).reduce((s, e) => s + e.sekunden, 0)
  return [...sortiert.slice(0, maxEintraege - 1), { name: 'Sonstige', sekunden: rest }]
}

/** Rang je abgeschlossener Woche, die letzten `anzahl` Wochen vor der laufenden. */
export function wochenRangAusSummen(summen: Tagessumme[], jetzt: Date, anzahl: number): Wochenwert[] {
  const produktivJeTag = new Map<string, number>()
  const tageMitDaten = new Set<string>()
  for (const s of summen) {
    if (s.sekunden > 0) tageMitDaten.add(s.datum)
    if (s.bewertung === 'produktiv') produktivJeTag.set(s.datum, (produktivJeTag.get(s.datum) ?? 0) + s.sekunden)
  }
  const laufende = berlinDatum(wochenanfang(jetzt))
  const ergebnis: Wochenwert[] = []
  for (let i = anzahl; i >= 1; i--) {
    const start = datumVerschieben(laufende, -7 * i)
    let sekunden = 0
    let leer = true
    for (let d = 0; d < 7; d++) {
      const datum = datumVerschieben(start, d)
      if (tageMitDaten.has(datum)) leer = false
      sekunden += produktivJeTag.get(datum) ?? 0
    }
    ergebnis.push({ start, kw: kalenderwoche(datumZuTagesanfang(start)), sekunden, rang: rang(sekunden), leer })
  }
  return ergebnis
}
