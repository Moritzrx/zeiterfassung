import type { ReactElement } from 'react'
import { MINDEST_TAGE, ZEITRAUM_TAGE, type Hochrechnung } from '@shared/auswertung'
import { AnimierteZahl } from './AnimierteZahl'
import { Karte } from './Karte'
import { stundenText, zahlText } from '../format'
import { TaetigkeitSymbol } from '../symbole'

interface Props {
  /** null = Arbeitszeit gesamt */
  name: string | null
  werte: Hochrechnung
  erfassteTage: number
  ausreichend: boolean
  gross?: boolean
}

/** Eine Hochrechnungs-Karte: Tagesschnitt, daraus Woche, Monat und Jahr, plus der Hinweis, worauf sie beruht. */
export function HochrechnungKarte({ name, werte, erfassteTage, ausreichend, gross = false }: Props): ReactElement {
  const hinweis = ausreichend
    ? `Schnitt aus ${erfassteTage} Arbeitstagen der letzten ${ZEITRAUM_TAGE} Tage, × 5 Tage pro Woche.`
    : `Datenlage noch zu dünn: erst ${erfassteTage} von mindestens ${MINDEST_TAGE} erfassten Tagen.`

  return (
    <Karte className={gross ? 'py-6' : ''}>
      <div className="flex items-center gap-3">
        {name ? <TaetigkeitSymbol name={name} groesse={gross ? 22 : 18} /> : null}
        <p className={gross ? 'text-lg' : 'text-sm'}>{name ?? 'Arbeitszeit gesamt'}</p>
      </div>
      {ausreichend ? (
        <>
          <p className={`mt-3 font-light ${gross ? 'text-[44px] leading-none' : 'text-2xl'}`}>
            <AnimierteZahl wert={werte.tagesschnitt} format={stundenText} />
            <span className={`ml-2 text-mute ${gross ? 'text-lg' : 'text-sm'}`}>Stunden am Tag im Schnitt</span>
          </p>
          <p className={`mt-3 ${gross ? 'text-base' : 'text-sm'} text-mute`}>
            <span className="text-ink">{stundenText(werte.woche)}</span> pro Woche ·{' '}
            <span className="text-ink">{stundenText(werte.monat)}</span> pro Monat ·{' '}
            <span className="text-ink">{zahlText(werte.jahr / 3600, 0)}</span> pro Jahr
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-mute">Noch keine Hochrechnung.</p>
      )}
      <p className="mt-2 text-xs text-dim">{hinweis}</p>
    </Karte>
  )
}
