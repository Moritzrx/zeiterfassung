/**
 * Die Rechnungen für den Auswertungs-Screen. Alles leitet sich aus Blöcken ab,
 * die Hochrechnungen aus einer einzigen Basiszahl, dem Tagesschnitt.
 */
import { level } from './level'
import { taetigkeitSchluessel } from './regeln'
import type { Block } from './typen'
import { berlinDatum, datumVerschieben, datumZuTagesanfang, kalenderwoche, wochenanfang } from './zeit'

/** So viele erfasste Tage braucht es, bevor eine Hochrechnung gezeigt wird. */
export const MINDEST_TAGE = 7
/** Ein Tag zählt als erfasst, wenn er mindestens so viel produktive Zeit hat (1 Stunde). */
export const MINDEST_SEKUNDEN_JE_TAG = 3600
export const ZEITRAUM_TAGE = 28
export const WOCHEN_PRO_MONAT = 4.333

export interface Tageswert {
  datum: string
  sekunden: number
}

export interface Hochrechnung {
  /** Sekunden je erfasstem Tag */
  tagesschnitt: number
  woche: number
  monat: number
  jahr: number
}

export interface Hochrechnungen {
  erfassteTage: number
  ausreichend: boolean
  gesamt: Hochrechnung
  jeTaetigkeit: Array<{ name: string } & Hochrechnung>
}

export interface Wochenwert {
  start: string
  kw: number
  sekunden: number
  level: number
  /** true, wenn es in dieser Woche gar keine Blöcke gab (vor dem ersten Start) */
  leer: boolean
}

function anteil(block: Block, von: number, bis: number): number {
  const s = Math.max(Date.parse(block.start), von)
  const e = Math.min(Date.parse(block.ende), bis)
  return e > s ? (e - s) / 1000 : 0
}

/** Produktive Sekunden je Berliner Kalendertag, `tage` Tage bis einschließlich `bisDatum`. */
export function produktivJeTag(bloecke: Block[], bisDatum: string, tage: number): Tageswert[] {
  const produktive = bloecke.filter((b) => b.bewertung === 'produktiv' && !b.geloeschtAm)
  const ergebnis: Tageswert[] = []
  for (let i = tage - 1; i >= 0; i--) {
    const datum = datumVerschieben(bisDatum, -i)
    const von = datumZuTagesanfang(datum).getTime()
    const bis = datumZuTagesanfang(datumVerschieben(datum, 1)).getTime()
    let sekunden = 0
    for (const b of produktive) sekunden += anteil(b, von, bis)
    ergebnis.push({ datum, sekunden })
  }
  return ergebnis
}

/** Gleitender Schnitt über `fenster` Werte, jeweils bis zum aktuellen Wert. */
export function gleitenderSchnitt(werte: number[], fenster = 7): number[] {
  return werte.map((_, i) => {
    const von = Math.max(0, i - fenster + 1)
    let summe = 0
    for (let k = von; k <= i; k++) summe += werte[k]
    return summe / fenster
  })
}

function kette(tagesschnitt: number, urlaubswochen: number): Hochrechnung {
  const woche = tagesschnitt * 5
  return {
    tagesschnitt,
    woche,
    monat: woche * WOCHEN_PRO_MONAT,
    jahr: woche * Math.max(0, 52 - urlaubswochen)
  }
}

/**
 * Hochrechnungen aus den letzten 28 vollen Tagen vor `heute`. Gezählt werden nur
 * Tage mit mindestens einer produktiven Stunde. Dieselbe Kette gilt je Tätigkeit,
 * geteilt durch dieselbe Anzahl Tage, damit die Karten zusammen die Gesamtkarte ergeben.
 */
export function hochrechnungBerechnen(bloecke: Block[], heute: string, urlaubswochen: number): Hochrechnungen {
  const gestern = datumVerschieben(heute, -1)
  const tage = produktivJeTag(bloecke, gestern, ZEITRAUM_TAGE)
  const gezaehlt = tage.filter((t) => t.sekunden >= MINDEST_SEKUNDEN_JE_TAG)
  const n = gezaehlt.length
  const gezaehlteTage = new Set(gezaehlt.map((t) => t.datum))
  const gesamtSekunden = gezaehlt.reduce((s, t) => s + t.sekunden, 0)

  const summen = new Map<string, { name: string; sekunden: number }>()
  const von = datumZuTagesanfang(datumVerschieben(gestern, -(ZEITRAUM_TAGE - 1))).getTime()
  const bis = datumZuTagesanfang(heute).getTime()
  for (const b of bloecke) {
    if (b.bewertung !== 'produktiv' || !b.taetigkeit || b.geloeschtAm) continue
    if (!gezaehlteTage.has(berlinDatum(new Date(b.start)))) continue
    const schluessel = taetigkeitSchluessel(b.taetigkeit)
    const eintrag = summen.get(schluessel) ?? { name: b.taetigkeit, sekunden: 0 }
    eintrag.sekunden += anteil(b, von, bis)
    summen.set(schluessel, eintrag)
  }

  return {
    erfassteTage: n,
    ausreichend: n >= MINDEST_TAGE,
    gesamt: kette(n ? gesamtSekunden / n : 0, urlaubswochen),
    jeTaetigkeit: [...summen.values()]
      .map((e) => ({ name: e.name, ...kette(n ? e.sekunden / n : 0, urlaubswochen) }))
      .sort((a, b) => b.tagesschnitt - a.tagesschnitt)
  }
}

/** Level je abgeschlossener Woche, die letzten `anzahl` Wochen vor der laufenden. */
export function wochenLevel(bloecke: Block[], jetzt: Date, anzahl = 12): Wochenwert[] {
  const laufende = berlinDatum(wochenanfang(jetzt))
  const ergebnis: Wochenwert[] = []
  for (let i = anzahl; i >= 1; i--) {
    const startDatum = datumVerschieben(laufende, -7 * i)
    const von = datumZuTagesanfang(startDatum).getTime()
    const bis = datumZuTagesanfang(datumVerschieben(startDatum, 7)).getTime()
    let sekunden = 0
    let leer = true
    for (const b of bloecke) {
      if (b.geloeschtAm) continue
      const a = anteil(b, von, bis)
      if (a > 0) {
        leer = false
        if (b.bewertung === 'produktiv') sekunden += a
      }
    }
    ergebnis.push({ start: startDatum, kw: kalenderwoche(new Date(von)), sekunden, level: level(sekunden), leer })
  }
  return ergebnis
}

/** Anteil jeder Tätigkeit an der produktiven Zeit im Zeitraum, absteigend, Rest als "Sonstige". */
export function verteilung(
  bloecke: Block[],
  von: Date,
  bis: Date,
  maxEintraege = 8
): Array<{ name: string; sekunden: number }> {
  const summen = new Map<string, { name: string; sekunden: number }>()
  const v = von.getTime()
  const b2 = bis.getTime()
  for (const b of bloecke) {
    if (b.bewertung !== 'produktiv' || b.geloeschtAm) continue
    const a = anteil(b, v, b2)
    if (a <= 0) continue
    const name = b.taetigkeit ?? 'Ohne Tätigkeit'
    const schluessel = taetigkeitSchluessel(name)
    const eintrag = summen.get(schluessel) ?? { name, sekunden: 0 }
    eintrag.sekunden += a
    summen.set(schluessel, eintrag)
  }
  const sortiert = [...summen.values()].sort((a, b) => b.sekunden - a.sekunden)
  if (sortiert.length <= maxEintraege) return sortiert
  const rest = sortiert.slice(maxEintraege - 1).reduce((s, e) => s + e.sekunden, 0)
  return [...sortiert.slice(0, maxEintraege - 1), { name: 'Sonstige', sekunden: rest }]
}
