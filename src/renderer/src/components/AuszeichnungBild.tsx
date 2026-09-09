import type { ReactElement } from 'react'
import { AUSZEICHNUNGEN } from '@shared/auszeichnungen'
import type { AuszeichnungTyp } from '@shared/typen'
import ersteWocheLevel10 from '../assets/wappen/ausz-erste_woche_level10.png'
import dreiWochenLevel10 from '../assets/wappen/ausz-drei_wochen_level10.png'
import dauerbrenner from '../assets/wappen/ausz-dauerbrenner.png'
import comeback from '../assets/wappen/ausz-comeback.png'
import eternal from '../assets/wappen/ausz-eternal.png'
import perfekteWoche from '../assets/wappen/ausz-perfekte_woche.png'
import alleLernziele from '../assets/wappen/ausz-alle_lernziele.png'
import fokusWoche from '../assets/wappen/ausz-fokus_woche.png'
import marathon from '../assets/wappen/ausz-marathon.png'
import sprint from '../assets/wappen/ausz-sprint.png'
import fruehaufsteher from '../assets/wappen/ausz-fruehaufsteher.png'
import nachteule from '../assets/wappen/ausz-nachteule.png'
import wochenendKrieger from '../assets/wappen/ausz-wochenend_krieger.png'
import aufgeraeumt from '../assets/wappen/ausz-aufgeraeumt.png'

/*
 * Die Medaillen der Auszeichnungen: je Typ ein illustriertes Bild (erzeugt mit Higgsfield im Stil
 * der Rang-Wappen, als PNG mit Alphakanal in assets/wappen). Erreichte leuchten in ihrer Farbe,
 * offene sind grau und blass.
 */
const BILDER: Record<AuszeichnungTyp, string> = {
  erste_woche_level10: ersteWocheLevel10,
  drei_wochen_level10: dreiWochenLevel10,
  dauerbrenner,
  comeback,
  eternal,
  perfekte_woche: perfekteWoche,
  alle_lernziele: alleLernziele,
  fokus_woche: fokusWoche,
  marathon,
  sprint,
  fruehaufsteher,
  nachteule,
  wochenend_krieger: wochenendKrieger,
  aufgeraeumt
}

export function AuszeichnungBild({ typ, erreicht, groesse = 80 }: { typ: AuszeichnungTyp; erreicht: boolean; groesse?: number }): ReactElement {
  const farbe = AUSZEICHNUNGEN[typ].farbe
  return (
    <div className="relative shrink-0 select-none" style={{ width: groesse, height: groesse }} role="img" aria-label={AUSZEICHNUNGEN[typ].titel}>
      <img
        src={BILDER[typ]}
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none"
        style={{
          left: '-10%',
          top: '-10%',
          width: '120%',
          height: '120%',
          filter: erreicht ? `drop-shadow(0 0 ${Math.round(groesse * 0.1)}px ${farbe}80)` : 'grayscale(1) brightness(0.5)',
          opacity: erreicht ? 1 : 0.5
        }}
      />
    </div>
  )
}
