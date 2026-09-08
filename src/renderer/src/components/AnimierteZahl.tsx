import { useEffect, useRef, useState, type ReactElement } from 'react'

interface Props {
  wert: number
  format: (wert: number) => string
  /** Dauer in Millisekunden, Standard 600 */
  dauer?: number
}

/** Zählt sanft vom alten zum neuen Wert, wenn sich der Wert ändert. Ruhig bei "Bewegung reduzieren". */
export function AnimierteZahl({ wert, format, dauer = 600 }: Props): ReactElement {
  const [anzeige, setAnzeige] = useState(wert)
  const vorher = useRef(wert)

  useEffect(() => {
    const von = vorher.current
    const bis = wert
    vorher.current = wert
    const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduziert || von === bis) {
      setAnzeige(bis)
      return
    }
    const start = performance.now()
    let anfrage = 0
    const schritt = (t: number): void => {
      const anteil = Math.min(1, (t - start) / dauer)
      const weich = 1 - Math.pow(1 - anteil, 3)
      setAnzeige(von + (bis - von) * weich)
      if (anteil < 1) anfrage = requestAnimationFrame(schritt)
    }
    anfrage = requestAnimationFrame(schritt)
    return () => cancelAnimationFrame(anfrage)
  }, [wert, dauer])

  return <>{format(anzeige)}</>
}
