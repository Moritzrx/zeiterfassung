import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Building2, Download } from 'lucide-react'
import type { TeamTaetigkeit } from '@shared/typen'
import { berlinTeile, berlinZuUtc } from '@shared/zeit'
import { fehlerText, stundenText } from '../format'
import { tonSpielen } from '../toene'
import { hinweisZeigen } from './Hinweis'
import { Karte } from './Karte'

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

interface Monat {
  jahr: number
  monat: number
  label: string
  von: string
  bis: string
}

/** Der laufende Monat und die zwei davor (Berliner Zeit). */
function monateBilden(): Monat[] {
  const t = berlinTeile(new Date())
  const liste: Monat[] = []
  for (let i = 0; i < 3; i++) {
    let jahr = t.jahr
    let monat = t.monat - i
    while (monat < 1) {
      monat += 12
      jahr -= 1
    }
    const naechster = monat === 12 ? { jahr: jahr + 1, monat: 1 } : { jahr, monat: monat + 1 }
    liste.push({
      jahr,
      monat,
      label: `${MONATE[monat - 1]} ${jahr}`,
      von: berlinZuUtc(jahr, monat, 1, 0, 0).toISOString(),
      bis: berlinZuUtc(naechster.jahr, naechster.monat, 1, 0, 0).toISOString()
    })
  }
  return liste
}

interface Kundenzeile {
  kunde: string
  sekunden: number
  zeilen: Array<{ name: string; taetigkeit: string; sekunden: number }>
}

/**
 * Kundenbericht (15. September 2026): produktive Stunden je Kunde im Monat, aufgeschlüsselt nach Person und Tätigkeit,
 * für das ganze Team (Datenbankfunktion team_taetigkeiten). "Als Datei speichern" legt eine CSV-Tabelle ab, die Excel
 * direkt öffnet, für Rechnung oder Weitergabe.
 */
export function Kundenbericht(): ReactElement {
  const monate = useMemo(monateBilden, [])
  const [gewaehlt, setGewaehlt] = useState(0)
  const [zeilen, setZeilen] = useState<TeamTaetigkeit[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const monat = monate[gewaehlt]

  useEffect(() => {
    if (!window.api) return
    let aktiv = true
    window.api.team
      .taetigkeiten(monat.von, monat.bis)
      .then((l) => {
        if (!aktiv) return
        setZeilen(l)
        setFehler(null)
      })
      .catch((e) => {
        if (!aktiv) return
        setZeilen([])
        setFehler(fehlerText(e))
      })
    return () => {
      aktiv = false
    }
  }, [monat])

  const kunden = useMemo<Kundenzeile[]>(() => {
    const karte = new Map<string, Kundenzeile>()
    for (const z of zeilen) {
      const kunde = z.kunde ?? 'Ohne Kunde'
      const k = karte.get(kunde) ?? { kunde, sekunden: 0, zeilen: [] }
      k.sekunden += z.produktiveSekunden
      k.zeilen.push({ name: z.name, taetigkeit: z.taetigkeit ?? 'Ohne Tätigkeit', sekunden: z.produktiveSekunden })
      karte.set(kunde, k)
    }
    const liste = [...karte.values()]
    for (const k of liste) k.zeilen.sort((a, b) => b.sekunden - a.sekunden)
    // "Ohne Kunde" ans Ende, sonst nach Stunden
    liste.sort((a, b) => (a.kunde === 'Ohne Kunde' ? 1 : b.kunde === 'Ohne Kunde' ? -1 : b.sekunden - a.sekunden))
    return liste
  }, [zeilen])
  const gesamt = kunden.reduce((s, k) => s + k.sekunden, 0)

  async function speichern(): Promise<void> {
    if (!window.api || laeuft) return
    setLaeuft(true)
    try {
      const zeilenCsv = ['Kunde;Person;Tätigkeit;Stunden']
      for (const k of kunden) {
        for (const z of k.zeilen) zeilenCsv.push(`${k.kunde};${z.name};${z.taetigkeit};${stundenText(z.sekunden)}`)
        zeilenCsv.push(`${k.kunde};;Summe;${stundenText(k.sekunden)}`)
      }
      zeilenCsv.push(`;;Gesamt;${stundenText(gesamt)}`)
      const pfad = await window.api.bericht.speichern(`Kundenbericht-${monat.jahr}-${String(monat.monat).padStart(2, '0')}.csv`, zeilenCsv.join('\r\n') + '\r\n')
      if (pfad) {
        tonSpielen('erfolg')
        hinweisZeigen(`Gespeichert: ${pfad}`)
      }
    } catch (e) {
      hinweisZeigen(fehlerText(e))
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <Karte>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs tracking-wide text-mute uppercase">Kundenbericht</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-chip bg-panel-2 p-1">
            {monate.map((m, i) => (
              <button
                key={m.label}
                type="button"
                onClick={() => setGewaehlt(i)}
                className={`rounded-chip px-3 py-1 text-xs transition-colors ${gewaehlt === i ? 'bg-ink text-ground' : 'text-mute hover:text-ink'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={laeuft || kunden.length === 0}
            onClick={() => void speichern()}
            className="flex items-center gap-1.5 rounded-chip bg-panel-2 px-3 py-1.5 text-xs text-ink transition-colors hover:bg-inaktiv disabled:opacity-40"
            title="Als CSV-Tabelle speichern (öffnet sich in Excel)"
          >
            <Download size={13} strokeWidth={2} />
            Als Datei speichern
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-dim">Produktive Stunden je Kunde im Monat, alle drei zusammen, je Person und Tätigkeit. Für die Rechnung oder zum Weitergeben.</p>
      {fehler ? (
        <p className="mt-3 text-sm text-mute">{fehler}</p>
      ) : kunden.length === 0 ? (
        <p className="mt-3 text-sm text-dim">In diesem Monat noch keine produktive Zeit.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {kunden.map((k) => (
            <div key={k.kunde}>
              <div className="flex items-center gap-2 text-sm">
                <Building2 size={14} strokeWidth={1.5} className="shrink-0 text-mute" />
                <span className="truncate">{k.kunde}</span>
                <span className="ml-auto shrink-0 tabular-nums">{stundenText(k.sekunden)} h</span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-mute">{gesamt ? Math.round((k.sekunden / gesamt) * 100) : 0} %</span>
              </div>
              <div className="mt-1 flex flex-col gap-0.5 pl-6">
                {k.zeilen.map((z, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-mute">
                    <span className="w-16 shrink-0 truncate">{z.name}</span>
                    <span className="truncate">{z.taetigkeit}</span>
                    <span className="ml-auto shrink-0 tabular-nums">{stundenText(z.sekunden)} h</span>
                    <span className="w-10 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 border-t border-panel-2 pt-2 text-sm">
            <span className="text-mute">Gesamt {monat.label}</span>
            <span className="ml-auto tabular-nums">{stundenText(gesamt)} h</span>
            <span className="w-10 shrink-0" />
          </div>
        </div>
      )}
    </Karte>
  )
}
