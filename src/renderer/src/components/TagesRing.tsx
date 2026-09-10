import { memo, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import { DiagrammTooltip } from './DiagrammTooltip'

export interface RingAnteile {
  produktiv: number
  unproduktiv: number
  inaktiv: number
  ungeklaert: number
}

const FARBEN = {
  produktiv: '#00C076',
  unproduktiv: '#FF4D4D',
  inaktiv: '#38BDF8',
  ungeklaert: '#8A8A8F',
  leer: '#151517'
}

const TEXTE = {
  produktiv: 'produktiv',
  unproduktiv: 'unproduktiv',
  inaktiv: 'abwesend',
  ungeklaert: 'ungeklärt'
}

interface Props {
  anteile: RingAnteile
  /** Größe in Pixeln, Standard 240 */
  groesse?: number
  children?: ReactNode
}

/** Ringdiagramm eines Tages: produktiv, unproduktiv, inaktiv, ungeklärt. In der Mitte beliebiger Inhalt. */
function TagesRingInnen({ anteile, groesse = 240, children }: Props): ReactElement {
  // Nur beim ersten Aufbau animieren, danach ruhig bleiben.
  const [animieren, setAnimieren] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setAnimieren(false), 900)
    return () => clearTimeout(t)
  }, [])

  const eintraege = (Object.keys(TEXTE) as Array<keyof RingAnteile>)
    .filter((k) => anteile[k] > 0)
    .map((k) => ({ name: k, sekunden: anteile[k], farbe: FARBEN[k], text: TEXTE[k] }))
  const leer = eintraege.length === 0
  const daten = leer ? [{ name: 'leer', sekunden: 1, farbe: FARBEN.leer, text: '' }] : eintraege

  const aussen = groesse / 2
  const innen = aussen - 14

  return (
    <div className="relative" style={{ width: groesse, height: groesse }}>
      <PieChart width={groesse} height={groesse}>
        <Pie
          data={daten}
          dataKey="sekunden"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={innen}
          outerRadius={aussen}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          paddingAngle={leer || daten.length === 1 ? 0 : 2}
          cornerRadius={6}
          isAnimationActive={animieren}
          animationDuration={700}
        >
          {daten.map((d) => (
            <Cell
              key={d.name}
              fill={d.farbe}
              // Der produktive Anteil leuchtet, damit der Fortschritt lebendig wirkt.
              style={
                d.name === 'produktiv'
                  ? { filter: 'drop-shadow(0 0 5px rgba(0, 192, 118, 0.95)) drop-shadow(0 0 18px rgba(0, 192, 118, 0.5))' }
                  : undefined
              }
            />
          ))}
        </Pie>
        {!leer && <Tooltip content={<DiagrammTooltip />} cursor={false} />}
      </PieChart>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

/** Gemerkt: rendert nur neu, wenn sich die Eingaben ändern; die Statusmeldung alle 5 s rendert sonst jedes Diagramm mit. */
export const TagesRing = memo(TagesRingInnen)
