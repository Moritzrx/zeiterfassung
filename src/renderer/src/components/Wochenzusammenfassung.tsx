import { FOKUS_QUOTE_ZIEL, fokusQuote } from '@shared/ruhe'
import type { ReactElement } from 'react'
import { AUSZEICHNUNGEN, zieleErreicht, type Wochenstatistik } from '@shared/auszeichnungen'
import { STANDARD_GESAMTZIEL, rang, rangName, zielRang } from '@shared/rang'
import type { Auszeichnung, Ziel } from '@shared/typen'
import { kurzDatum, stundenText } from '../format'
import { Karte } from './Karte'
import { RangAbzeichen } from './RangAbzeichen'
import { TaetigkeitSymbol } from '../symbole'

interface Props {
  stat: Wochenstatistik
  ziele: Ziel[]
  /** true am Sonntagabend, solange die Woche noch läuft */
  zwischenstand: boolean
  /** Auszeichnungen, die in dieser Woche freigeschaltet wurden */
  neueAuszeichnungen: Auszeichnung[]
  onDurchgehen?: () => void
}

/** Die Wochenzusammenfassung: Rang, Stunden, produktiv gegen unproduktiv, Ziele, neue Auszeichnungen. */
export function Wochenzusammenfassung({ stat, ziele, zwischenstand, neueAuszeichnungen, onDurchgehen }: Props): ReactElement {
  const r = rang(stat.produktiv)
  const gesamtziel = ziele.find((z) => !z.taetigkeit)?.stundenProWoche ?? STANDARD_GESAMTZIEL
  const ziel = zielRang(gesamtziel)
  const geschafft = r >= ziel
  const gesamt = stat.produktiv + stat.unproduktiv + stat.ungeklaert
  const lernziele = zieleErreicht(stat, ziele)

  return (
    <Karte>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-wide text-orange uppercase">
            Wochenzusammenfassung{zwischenstand ? ' · Zwischenstand, Woche läuft noch' : ''}
          </p>
          <p className="mt-1 text-sm text-mute">Woche ab {kurzDatum(stat.start)}</p>
        </div>
        <RangAbzeichen rang={r} groesse={56} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-mute">Rang</p>
          <p className={`text-2xl font-light ${geschafft ? 'text-produktiv' : ''}`}>
            {r} <span className="text-sm text-mute">{rangName(r)}</span>
          </p>
          <p className="text-xs text-dim">{geschafft ? 'Woche geschafft' : `Ziel war Rang ${ziel}`}</p>
        </div>
        <div>
          <p className="text-xs text-mute">Stunden gesamt</p>
          <p className="text-2xl font-light">{stundenText(gesamt)}</p>
          <p className="text-xs text-dim">ohne inaktive Zeit</p>
        </div>
        <div>
          <p className="text-xs text-mute">Produktiv</p>
          <p className="text-2xl font-light text-produktiv">{stundenText(stat.produktiv)}</p>
        </div>
        <div>
          <p className="text-xs text-mute">Fokus-Quote</p>
          <p className={`text-2xl font-light ${fokusQuote(stat) >= FOKUS_QUOTE_ZIEL ? 'text-produktiv' : 'text-unproduktiv'}`}>
            {Math.round(fokusQuote(stat) * 100)} %
          </p>
          <p className="text-xs text-dim">{stundenText(stat.unproduktiv)} h unproduktiv</p>
        </div>
      </div>

      {lernziele.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-mute">Ziele</p>
          <div className="mt-1 flex flex-col gap-1">
            {lernziele.map(({ ziel: z, sekunden, erreicht }) => (
              <div key={z.id} className="flex items-center gap-2 text-sm">
                <span className={`inline-block h-2 w-2 rounded-full ${erreicht ? 'bg-produktiv' : 'bg-unproduktiv'}`} />
                <TaetigkeitSymbol name={z.taetigkeit} groesse={14} />
                <span>{z.taetigkeit}</span>
                <span className="ml-auto text-mute">
                  {stundenText(sekunden)} von {stundenText(z.stundenProWoche * 3600)} h
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {neueAuszeichnungen.length > 0 && (
        <p className="mt-4 text-sm text-orange">
          Neu freigeschaltet: {neueAuszeichnungen.map((a) => AUSZEICHNUNGEN[a.typ].titel).join(', ')}
        </p>
      )}

      {stat.ungeklaert > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="text-mute">Noch {stundenText(stat.ungeklaert)} h ungeklärt, die nicht zählen.</span>
          {onDurchgehen && (
            <button type="button" onClick={onDurchgehen} className="knopf-primaer rounded-chip px-4 py-2 text-sm">
              Jetzt durchgehen
            </button>
          )}
        </div>
      )}
    </Karte>
  )
}
