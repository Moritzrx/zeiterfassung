import type { ReactElement } from 'react'
import { AUSZEICHNUNGEN } from '@shared/auszeichnungen'
import type { AuszeichnungTyp } from '@shared/typen'
import ersteWocheLevel10 from '../assets/wappen/ausz-erste_woche_level10.png'
import dreiWochenLevel10 from '../assets/wappen/ausz-drei_wochen_level10.png'
import serie6 from '../assets/wappen/ausz-serie_6.png'
import serie12 from '../assets/wappen/ausz-serie_12.png'
import dauerbrenner from '../assets/wappen/ausz-dauerbrenner.png'
import comeback from '../assets/wappen/ausz-comeback.png'
import eternal from '../assets/wappen/ausz-eternal.png'
import perfekteWoche from '../assets/wappen/ausz-perfekte_woche.png'
import durchlaeufer from '../assets/wappen/ausz-durchlaeufer.png'
import alleLernziele from '../assets/wappen/ausz-alle_lernziele.png'
import lernmeister from '../assets/wappen/ausz-lernmeister.png'
import fokusWoche from '../assets/wappen/ausz-fokus_woche.png'
import marathon from '../assets/wappen/ausz-marathon.png'
import ultra from '../assets/wappen/ausz-ultra.png'
import sprint from '../assets/wappen/ausz-sprint.png'
import fruehaufsteher from '../assets/wappen/ausz-fruehaufsteher.png'
import nachteule from '../assets/wappen/ausz-nachteule.png'
import wochenendKrieger from '../assets/wappen/ausz-wochenend_krieger.png'
import aufgeraeumt from '../assets/wappen/ausz-aufgeraeumt.png'
import blitzsauber from '../assets/wappen/ausz-blitzsauber.png'
import stunden100 from '../assets/wappen/ausz-stunden_100.png'
import stunden500 from '../assets/wappen/ausz-stunden_500.png'
import stunden1000 from '../assets/wappen/ausz-stunden_1000.png'
import stunden2500 from '../assets/wappen/ausz-stunden_2500.png'
import stunden5000 from '../assets/wappen/ausz-stunden_5000.png'
import wochensieger from '../assets/wappen/ausz-wochensieger.png'
import dauersieger from '../assets/wappen/ausz-dauersieger.png'
import teamWoche from '../assets/wappen/ausz-team_woche.png'
import ligaBronze from '../assets/wappen/liga-bronze.png'
import ligaSilber from '../assets/wappen/liga-silber.png'
import ligaGold from '../assets/wappen/liga-gold.png'
import ligaKristall from '../assets/wappen/liga-kristall.png'
import ligaMeister from '../assets/wappen/liga-meister.png'
import ligaChampion from '../assets/wappen/liga-champion.png'
import ligaTitan from '../assets/wappen/liga-titan.png'
import ligaLegende from '../assets/wappen/liga-legende.png'

/*
 * Die Medaillen der Auszeichnungen: je Typ ein illustriertes Bild (erzeugt mit Higgsfield im Stil
 * der Rang-Wappen, als PNG mit Alphakanal in assets/wappen). Die Liga-Auszeichnungen tragen das
 * Wappen der jeweiligen Liga. Erreichte leuchten in ihrer Farbe, offene sind grau und blass.
 */
const BILDER: Record<AuszeichnungTyp, string> = {
  erste_woche_level10: ersteWocheLevel10,
  comeback,
  eternal,
  drei_wochen_level10: dreiWochenLevel10,
  serie_6: serie6,
  serie_12: serie12,
  dauerbrenner,
  stunden_100: stunden100,
  stunden_500: stunden500,
  stunden_1000: stunden1000,
  stunden_2500: stunden2500,
  stunden_5000: stunden5000,
  liga_bronze: ligaBronze,
  liga_silber: ligaSilber,
  liga_gold: ligaGold,
  liga_kristall: ligaKristall,
  liga_meister: ligaMeister,
  liga_champion: ligaChampion,
  liga_titan: ligaTitan,
  liga_legende: ligaLegende,
  perfekte_woche: perfekteWoche,
  durchlaeufer,
  marathon,
  ultra,
  sprint,
  wochensieger,
  dauersieger,
  team_woche: teamWoche,
  alle_lernziele: alleLernziele,
  lernmeister,
  fokus_woche: fokusWoche,
  aufgeraeumt,
  blitzsauber,
  fruehaufsteher,
  nachteule,
  wochenend_krieger: wochenendKrieger
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
