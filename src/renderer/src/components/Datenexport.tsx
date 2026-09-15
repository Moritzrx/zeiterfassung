import { useMemo, useState, type ReactElement } from 'react'
import { Download } from 'lucide-react'
import type { Block } from '@shared/typen'
import { ruheName } from '@shared/ruhe'
import { berlinTeile, berlinZuUtc } from '@shared/zeit'
import { fehlerText, zahlText } from '../format'
import { tonSpielen } from '../toene'
import { hinweisZeigen } from './Hinweis'
import { Karte } from './Karte'

interface Zeitraum {
  label: string
  von: string
  bis: string
  dateiname: string
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

function zeitraeumeBilden(): Zeitraum[] {
  const t = berlinTeile(new Date())
  const monatVon = (jahr: number, monat: number): string => berlinZuUtc(jahr, monat, 1, 0, 0).toISOString()
  const naechster = (jahr: number, monat: number): [number, number] => (monat === 12 ? [jahr + 1, 1] : [jahr, monat + 1])
  const [vJahr, vMonat] = t.monat === 1 ? [t.jahr - 1, 12] : [t.jahr, t.monat - 1]
  const [nJahr, nMonat] = naechster(t.jahr, t.monat)
  const mm = (m: number): string => String(m).padStart(2, '0')
  return [
    { label: `${MONATE[t.monat - 1]} ${t.jahr}`, von: monatVon(t.jahr, t.monat), bis: monatVon(nJahr, nMonat), dateiname: `wessamedia-Zeit-${t.jahr}-${mm(t.monat)}.csv` },
    { label: `${MONATE[vMonat - 1]} ${vJahr}`, von: monatVon(vJahr, vMonat), bis: monatVon(t.jahr, t.monat), dateiname: `wessamedia-Zeit-${vJahr}-${mm(vMonat)}.csv` },
    { label: `Jahr ${t.jahr}`, von: monatVon(t.jahr, 1), bis: monatVon(t.jahr + 1, 1), dateiname: `wessamedia-Zeit-${t.jahr}.csv` },
    { label: 'Alles', von: monatVon(t.jahr - 3, 1), bis: monatVon(t.jahr + 1, 1), dateiname: 'wessamedia-Zeit-alles.csv' }
  ]
}

function feld(wert: string | number | null | undefined): string {
  const s = wert === null || wert === undefined ? '' : String(wert)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const BEWERTUNG_TEXT: Record<Block['bewertung'], string> = {
  produktiv: 'produktiv',
  unproduktiv: 'unproduktiv',
  ungeklaert: 'ungeklärt',
  inaktiv: 'Pause'
}

/** Eine Zeile je Block: Datum, Von, Bis, Dauer, Tätigkeit, Kunde, Bewertung, Quelle, Programm, Fenstertitel, Notiz, Kennung. */
export function csvBauen(bloecke: Block[]): string {
  const zeilen = ['Datum;Von;Bis;Dauer (h);Tätigkeit;Kunde;Bewertung;Quelle;Programm;Fenstertitel;Notiz;Kennung']
  const uhr = (iso: string): string => {
    const z = berlinTeile(new Date(iso))
    return `${String(z.stunde).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`
  }
  for (const b of bloecke) {
    const s = berlinTeile(new Date(b.start))
    const datum = `${String(s.tag).padStart(2, '0')}.${String(s.monat).padStart(2, '0')}.${s.jahr}`
    const stunden = (Date.parse(b.ende) - Date.parse(b.start)) / 3_600_000
    const bewertung = b.bewertung === 'inaktiv' ? ruheName(b) : BEWERTUNG_TEXT[b.bewertung]
    zeilen.push(
      [
        datum,
        uhr(b.start),
        uhr(b.ende),
        zahlText(stunden, 2),
        b.taetigkeit,
        b.kunde,
        bewertung,
        b.quelle === 'manuell' ? 'von Hand' : 'automatisch',
        b.programm,
        b.fenstertitel,
        b.notiz,
        b.id
      ]
        .map(feld)
        .join(';')
    )
  }
  return zeilen.join('\r\n') + '\r\n'
}

/**
 * Datenexport (15. September 2026, "für Sicherung und Buchhaltung"): alle eigenen Blöcke eines Zeitraums als
 * CSV-Tabelle (Semikolon, UTF-8 mit BOM, öffnet sich in Excel). Älteres als 13 Wochen holt der Hintergrundprozess
 * aus der Datenbank.
 */
export function Datenexport(): ReactElement {
  const zeitraeume = useMemo(zeitraeumeBilden, [])
  const [gewaehlt, setGewaehlt] = useState(0)
  const [laeuft, setLaeuft] = useState(false)
  const zeitraum = zeitraeume[gewaehlt]

  async function speichern(): Promise<void> {
    if (!window.api || laeuft) return
    setLaeuft(true)
    try {
      const bloecke = await window.api.bloecke.exportieren(zeitraum.von, zeitraum.bis)
      if (bloecke.length === 0) {
        hinweisZeigen('In diesem Zeitraum gibt es keine Blöcke.')
        return
      }
      const pfad = await window.api.bericht.speichern(zeitraum.dateiname, csvBauen(bloecke))
      if (pfad) {
        tonSpielen('erfolg')
        hinweisZeigen(`${bloecke.length} Blöcke gespeichert: ${pfad}`)
      }
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <Karte>
      <p className="flex items-center gap-2 text-xs tracking-wide text-mute uppercase">
        <Download size={14} strokeWidth={1.5} />
        Datenexport
      </p>
      <p className="mt-1 text-xs text-dim">
        Alle deine Blöcke eines Zeitraums als Excel-Tabelle (CSV): Datum, Von, Bis, Dauer, Tätigkeit, Kunde, Bewertung, Programm, Fenstertitel,
        Notiz. Für die Sicherung oder die Buchhaltung.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-chip bg-panel-2 p-1">
          {zeitraeume.map((z, i) => (
            <button
              key={z.label}
              type="button"
              onClick={() => setGewaehlt(i)}
              className={`rounded-chip px-3 py-1 text-xs transition-colors ${gewaehlt === i ? 'bg-ink text-ground' : 'text-mute hover:text-ink'}`}
            >
              {z.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={laeuft}
          onClick={() => void speichern()}
          className="flex items-center gap-1.5 rounded-chip bg-panel-2 px-3 py-1.5 text-xs text-ink transition-colors hover:bg-inaktiv disabled:opacity-40"
        >
          <Download size={13} strokeWidth={2} />
          {laeuft ? 'Holt Blöcke …' : 'Als Datei speichern'}
        </button>
      </div>
    </Karte>
  )
}
