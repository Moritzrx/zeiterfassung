import { memo, useMemo, type ReactElement } from 'react'
import type { Block } from '@shared/typen'
import { berlinTeile, berlinZuUtc } from '@shared/zeit'
import type { Luecke } from '../zeilen'
import { dauerText, uhrzeit } from '../format'

/** Der Zeitstrahl reicht mindestens von 7 bis 20 Uhr und wächst, wenn früher oder später Blöcke liegen. */
const VON_STUNDE = 7
const BIS_STUNDE = 20
/** So kurz darf ein rotes Stück ohne Aufzeichnung sein; am heutigen Ende etwas mehr, damit der laufende Block nicht flackert. */
const FREI_MIN_MS = 60_000
const FREI_ENDE_MIN_MS = 90_000

interface Abschnitt {
  start: number
  ende: number
  farbe: string
  titel: string
}

interface Props {
  bloecke: Block[]
  datum: string
  /** Jetzt in ms für die Marke des aktuellen Zeitpunkts, sonst null (vergangener Tag) */
  jetztMs: number | null
  onLuecke: (l: Luecke) => void
}

/**
 * Tagesverlauf (15. September 2026): ein Balken über den Tag. Seit 16. September 2026 gilt (Auftraggeber: "jede Zeit, in der
 * man nicht produktiv ist, rot; falls man außerhalb des Laptops produktiv war, trägt man es nach"): GRÜN ist nur produktive
 * Zeit, ALLES ANDERE im Zeitfenster bis jetzt ist ROT. Rot gestrichelt heißt keine Aufzeichnung (klickbar, öffnet
 * "Nachtragen"), rot glatt ist ein Block, der nicht zählt: Pause im Fokus (klickbar zum Nachtragen), Unproduktives laut Regel
 * oder Ungeklärtes (in der Liste zuordnen). Grau bleibt nur die Zukunft.
 */
export const TagesZeitstrahl = memo(function TagesZeitstrahl({ bloecke, datum, jetztMs, onLuecke }: Props): ReactElement | null {
  const [jahr, monat, tag] = datum.split('-').map(Number)

  const { von, bis, abschnitte, pausen, frei, stunden } = useMemo(() => {
    let vonStunde = VON_STUNDE
    let bisStunde = BIS_STUNDE
    const gueltig = bloecke.filter((b) => !b.geloeschtAm && Date.parse(b.ende) > Date.parse(b.start))
    for (const b of gueltig) {
      if (b.bewertung === 'inaktiv') continue
      const s = berlinTeile(new Date(b.start))
      const e = berlinTeile(new Date(Math.max(Date.parse(b.start), Date.parse(b.ende) - 1)))
      if (s.jahr === jahr && s.monat === monat && s.tag === tag) vonStunde = Math.min(vonStunde, s.stunde)
      if (e.jahr === jahr && e.monat === monat && e.tag === tag) bisStunde = Math.max(bisStunde, e.stunde + 1)
    }
    bisStunde = Math.min(24, bisStunde)
    const von = berlinZuUtc(jahr, monat, tag, vonStunde, 0).getTime()
    const bis = vonStunde === bisStunde ? von + 3_600_000 : berlinZuUtc(jahr, monat, tag, bisStunde, 0).getTime()

    const sortiert = gueltig.filter((b) => Date.parse(b.ende) > von && Date.parse(b.start) < bis).sort((a, b) => a.start.localeCompare(b.start))

    // Produktives grün, Unproduktives und Ungeklärtes rot; direkt aufeinanderfolgende Blöcke gleicher Farbe zu einem Abschnitt.
    const abschnitte: Abschnitt[] = []
    for (const b of sortiert) {
      if (b.bewertung === 'inaktiv') continue
      const s = Math.max(Date.parse(b.start), von)
      const e = Math.min(Date.parse(b.ende), bis)
      if (e <= s) continue
      const farbe = b.bewertung === 'produktiv' ? '#00C076' : b.bewertung === 'unproduktiv' ? '#FF4D4D' : 'rgba(255,77,77,0.6)'
      const letzter = abschnitte[abschnitte.length - 1]
      if (letzter && letzter.farbe === farbe && s - letzter.ende <= 60_000) {
        letzter.ende = Math.max(letzter.ende, e)
        if (b.taetigkeit && !letzter.titel.includes(b.taetigkeit)) letzter.titel += `, ${b.taetigkeit}`
      } else {
        abschnitte.push({
          start: s,
          ende: e,
          farbe,
          titel:
            b.bewertung === 'ungeklaert'
              ? 'Ungeklärt, zählt nicht: in der Liste antippen und zuordnen'
              : b.bewertung === 'unproduktiv'
                ? 'Unproduktiv laut Regel, zählt nicht'
                : (b.taetigkeit ?? 'Produktiv')
        })
      }
    }
    // Pausen im Fokus (inaktive Blöcke): nicht am Rechner, deshalb rot; klickbar zum Nachtragen.
    const pausen: Luecke[] = sortiert
      .filter((b) => b.bewertung === 'inaktiv')
      .map((b) => ({ start: new Date(Math.max(Date.parse(b.start), von)).toISOString(), ende: new Date(Math.min(Date.parse(b.ende), bis)).toISOString() }))

    // Alles ohne Aufzeichnung bis jetzt (heute) bzw. bis zum Ende des Fensters (vergangener Tag): rot gestrichelt, klickbar.
    let ende = bis
    if (jetztMs !== null) {
      const letztesEnde = sortiert.reduce((m, b) => Math.max(m, Date.parse(b.ende)), 0)
      ende = Math.min(bis, Math.max(jetztMs, letztesEnde))
    }
    const frei: Luecke[] = []
    let freiAb = von
    for (const b of sortiert) {
      const s = Date.parse(b.start)
      const e = Date.parse(b.ende)
      if (s - freiAb >= FREI_MIN_MS && freiAb < ende) frei.push({ start: new Date(freiAb).toISOString(), ende: new Date(Math.min(s, ende)).toISOString() })
      freiAb = Math.max(freiAb, e)
      if (freiAb >= ende) break
    }
    if (ende - freiAb >= (jetztMs !== null ? FREI_ENDE_MIN_MS : FREI_MIN_MS)) frei.push({ start: new Date(freiAb).toISOString(), ende: new Date(ende).toISOString() })

    const stunden: number[] = []
    for (let h = vonStunde; h <= bisStunde; h++) stunden.push(h)
    return { von, bis, abschnitte, pausen, frei, stunden }
  }, [bloecke, jahr, monat, tag, jetztMs])

  if (bloecke.length === 0 && frei.length === 0) return null
  const spanne = bis - von
  const prozent = (ms: number): number => Math.min(100, Math.max(0, ((ms - von) / spanne) * 100))
  const jetztProzent = jetztMs !== null && jetztMs >= von && jetztMs <= bis ? prozent(jetztMs) : null
  const zeitText = (s: number, e: number): string => `${uhrzeit(new Date(s).toISOString())} – ${uhrzeit(new Date(e).toISOString())} (${dauerText((e - s) / 1000)})`

  return (
    <div className="mt-3">
      <div className="relative h-5 overflow-hidden rounded-chip bg-panel-2">
        {frei.map((l) => {
          const s = Math.max(Date.parse(l.start), von)
          const e = Math.min(Date.parse(l.ende), bis)
          if (e <= s) return null
          return (
            <button
              key={`f${l.start}`}
              type="button"
              onClick={() => onLuecke(l)}
              title={`Keine Aufzeichnung ${zeitText(s, e)}, zählt nicht. Klicken und nachtragen, falls du gearbeitet hast.`}
              className="absolute inset-y-0 cursor-pointer transition-opacity hover:opacity-80"
              style={{
                left: `${prozent(s)}%`,
                width: `${Math.max(0.3, prozent(e) - prozent(s))}%`,
                backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,77,77,0.75) 0 3px, rgba(255,77,77,0.3) 3px 7px)'
              }}
            />
          )
        })}
        {pausen.map((l) => {
          const s = Date.parse(l.start)
          const e = Date.parse(l.ende)
          if (e <= s) return null
          return (
            <button
              key={`p${l.start}`}
              type="button"
              onClick={() => onLuecke(l)}
              title={`Pause im Fokus ${zeitText(s, e)}, zählt nicht. Klicken und nachtragen, falls du gearbeitet hast.`}
              className="absolute inset-y-0 cursor-pointer transition-opacity hover:opacity-80"
              style={{ left: `${prozent(s)}%`, width: `${Math.max(0.3, prozent(e) - prozent(s))}%`, backgroundColor: 'rgba(255,77,77,0.6)' }}
            />
          )
        })}
        {abschnitte.map((a, i) => (
          <div
            key={i}
            title={`${a.titel}: ${zeitText(a.start, a.ende)}`}
            className="absolute inset-y-0"
            style={{ left: `${prozent(a.start)}%`, width: `${Math.max(0.3, prozent(a.ende) - prozent(a.start))}%`, backgroundColor: a.farbe }}
          />
        ))}
        {jetztProzent !== null && <div className="absolute inset-y-0 w-px bg-ink" style={{ left: `${jetztProzent}%` }} title="Jetzt" />}
      </div>
      <div className="relative mt-1 h-4 text-[10px] tabular-nums text-dim">
        {stunden.map((h) => {
          const p = ((h - stunden[0]) / Math.max(1, stunden[stunden.length - 1] - stunden[0])) * 100
          const zeigen = stunden.length <= 8 || h % 2 === 0
          if (!zeigen) return null
          return (
            <span key={h} className="absolute -translate-x-1/2" style={{ left: `${p}%` }}>
              {h}
            </span>
          )
        })}
      </div>
      <p className="mt-1 text-xs text-dim">
        Grün zählt, alles andere ist rot: gestrichelt ohne Aufzeichnung, glatt als Pause oder Block, der nicht zählt. Klick auf Rot trägt die Zeit
        nach, etwa für Kundentermin, Dreh oder Fahrt, dann wird sie grün.
      </p>
    </div>
  )
})
