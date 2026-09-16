import { memo, useMemo, type ReactElement } from 'react'
import type { Block } from '@shared/typen'
import { berlinTeile, berlinZuUtc } from '@shared/zeit'
import type { Luecke } from '../zeilen'
import { dauerText, uhrzeit } from '../format'

/** Der Zeitstrahl reicht mindestens von 7 bis 20 Uhr und wächst, wenn früher oder später Blöcke liegen. */
const VON_STUNDE = 7
const BIS_STUNDE = 20

interface Abschnitt {
  start: number
  ende: number
  farbe: string
  titel: string
}

interface Props {
  bloecke: Block[]
  luecken: Luecke[]
  datum: string
  /** Jetzt in ms für die Marke des aktuellen Zeitpunkts, sonst null (vergangener Tag) */
  jetztMs: number | null
  onLuecke: (l: Luecke) => void
}

/**
 * Tagesverlauf (15. September 2026): ein Balken über den Tag, auf dem produktive Zeit grün, Unproduktives rot und
 * Ungeklärtes hellgrau liegen. Zeit, in der niemand am Rechner war, ist seit 16. September 2026 ROT (Auftraggeber: "wenn
 * man nicht am Rechner ist, soll das rot sein; nachgetragen wird es grün"): Lücken ohne Aufzeichnung rot gestrichelt,
 * Pausen im Fokus (inaktive Blöcke) rot halbdurchsichtig. Beides ist klickbar und öffnet "Nachtragen" für den Zeitraum.
 */
export const TagesZeitstrahl = memo(function TagesZeitstrahl({ bloecke, luecken, datum, jetztMs, onLuecke }: Props): ReactElement | null {
  const [jahr, monat, tag] = datum.split('-').map(Number)

  const { von, bis, abschnitte, pausen, stunden } = useMemo(() => {
    let vonStunde = VON_STUNDE
    let bisStunde = BIS_STUNDE
    for (const b of bloecke) {
      if (b.bewertung === 'inaktiv') continue
      const s = berlinTeile(new Date(b.start))
      const e = berlinTeile(new Date(Math.max(Date.parse(b.start), Date.parse(b.ende) - 1)))
      if (s.jahr === jahr && s.monat === monat && s.tag === tag) vonStunde = Math.min(vonStunde, s.stunde)
      if (e.jahr === jahr && e.monat === monat && e.tag === tag) bisStunde = Math.max(bisStunde, e.stunde + 1)
    }
    bisStunde = Math.min(24, bisStunde)
    const von = berlinZuUtc(jahr, monat, tag, vonStunde, 0).getTime()
    const bis = vonStunde === bisStunde ? von + 3_600_000 : berlinZuUtc(jahr, monat, tag, bisStunde, 0).getTime()

    // Direkt aufeinanderfolgende Blöcke gleicher Bewertung zu einem Abschnitt zusammenfassen (weniger Elemente).
    const sortiert = bloecke
      .filter((b) => b.bewertung !== 'inaktiv' && Date.parse(b.ende) > von && Date.parse(b.start) < bis)
      .sort((a, b) => a.start.localeCompare(b.start))
    const abschnitte: Abschnitt[] = []
    for (const b of sortiert) {
      const s = Math.max(Date.parse(b.start), von)
      const e = Math.min(Date.parse(b.ende), bis)
      if (e <= s) continue
      const farbe = b.bewertung === 'produktiv' ? '#00C076' : b.bewertung === 'unproduktiv' ? '#FF4D4D' : '#8A8A8F'
      const letzter = abschnitte[abschnitte.length - 1]
      if (letzter && letzter.farbe === farbe && s - letzter.ende <= 60_000) {
        letzter.ende = Math.max(letzter.ende, e)
        if (b.taetigkeit && !letzter.titel.includes(b.taetigkeit)) letzter.titel += `, ${b.taetigkeit}`
      } else {
        abschnitte.push({ start: s, ende: e, farbe, titel: b.taetigkeit ?? (b.bewertung === 'ungeklaert' ? 'Ungeklärt' : b.bewertung === 'unproduktiv' ? 'Unproduktiv' : 'Produktiv') })
      }
    }
    // Pausen im Fokus (inaktive Blöcke ohne Programm): nicht am Rechner, deshalb rot; klickbar zum Nachtragen.
    const pausen: Luecke[] = bloecke
      .filter((b) => b.bewertung === 'inaktiv' && !b.programm && Date.parse(b.ende) > von && Date.parse(b.start) < bis)
      .map((b) => ({ start: new Date(Math.max(Date.parse(b.start), von)).toISOString(), ende: new Date(Math.min(Date.parse(b.ende), bis)).toISOString() }))
    const stunden: number[] = []
    for (let h = vonStunde; h <= bisStunde; h++) stunden.push(h)
    return { von, bis, abschnitte, pausen, stunden }
  }, [bloecke, jahr, monat, tag])

  if (bloecke.length === 0 && luecken.length === 0) return null
  const spanne = bis - von
  const prozent = (ms: number): number => Math.min(100, Math.max(0, ((ms - von) / spanne) * 100))
  const jetztProzent = jetztMs !== null && jetztMs >= von && jetztMs <= bis ? prozent(jetztMs) : null
  const zeitText = (s: number, e: number): string => `${uhrzeit(new Date(s).toISOString())} – ${uhrzeit(new Date(e).toISOString())} (${dauerText((e - s) / 1000)})`

  return (
    <div className="mt-3">
      <div className="relative h-5 overflow-hidden rounded-chip bg-panel-2">
        {abschnitte.map((a, i) => (
          <div
            key={i}
            title={`${a.titel}: ${zeitText(a.start, a.ende)}`}
            className="absolute inset-y-0"
            style={{ left: `${prozent(a.start)}%`, width: `${Math.max(0.3, prozent(a.ende) - prozent(a.start))}%`, backgroundColor: a.farbe }}
          />
        ))}
        {pausen.map((l) => {
          const s = Date.parse(l.start)
          const e = Date.parse(l.ende)
          if (e <= s) return null
          return (
            <button
              key={`p${l.start}`}
              type="button"
              onClick={() => onLuecke(l)}
              title={`Nicht am Rechner (Pause im Fokus) ${zeitText(s, e)}. Klicken und nachtragen, falls du gearbeitet hast.`}
              className="absolute inset-y-0 cursor-pointer transition-opacity hover:opacity-80"
              style={{ left: `${prozent(s)}%`, width: `${Math.max(0.3, prozent(e) - prozent(s))}%`, backgroundColor: 'rgba(255,77,77,0.45)' }}
            />
          )
        })}
        {luecken.map((l) => {
          const s = Math.max(Date.parse(l.start), von)
          const e = Math.min(Date.parse(l.ende), bis)
          if (e <= s) return null
          return (
            <button
              key={l.start}
              type="button"
              onClick={() => onLuecke(l)}
              title={`Nicht am Rechner, keine Aufzeichnung ${zeitText(s, e)}. Klicken und nachtragen.`}
              className="absolute inset-y-0 cursor-pointer transition-opacity hover:opacity-80"
              style={{
                left: `${prozent(s)}%`,
                width: `${Math.max(0.3, prozent(e) - prozent(s))}%`,
                backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,77,77,0.75) 0 3px, rgba(255,77,77,0.3) 3px 7px)'
              }}
            />
          )
        })}
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
        Grün zählt. Rot heißt nicht am Rechner (gestrichelt: keine Aufzeichnung, glatt: Pause im Fokus). Klick auf Rot trägt die Zeit nach, etwa
        für Kundentermin, Dreh oder Fahrt, dann wird sie grün.
      </p>
    </div>
  )
})
