import { useEffect, useState, type ReactElement } from 'react'

/** Ein Knopf in der Meldung, zum Beispiel "Rückgängig" nach dem Löschen (15. September 2026). */
export interface HinweisAktion {
  text: string
  onClick: () => void
}

interface HinweisDaten {
  text: string
  aktion: HinweisAktion | null
}

/** Zeigt unten eine kurze Meldung, z. B. "37 Blöcke neu bewertet"; mit Aktion bleibt sie länger stehen. */
export function hinweisZeigen(text: string, aktion: HinweisAktion | null = null): void {
  window.dispatchEvent(new CustomEvent<HinweisDaten>('hinweis', { detail: { text, aktion } }))
}

export function Hinweise(): ReactElement | null {
  const [daten, setDaten] = useState<HinweisDaten | null>(null)

  useEffect(() => {
    let timer = 0
    const handler = (ereignis: Event): void => {
      const d = (ereignis as CustomEvent<HinweisDaten>).detail
      setDaten(d)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setDaten(null), d.aktion ? 8000 : 4000)
    }
    window.addEventListener('hinweis', handler)
    return () => {
      window.removeEventListener('hinweis', handler)
      window.clearTimeout(timer)
    }
  }, [])

  if (!daten) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center">
      <div className="glas animate-einblenden flex items-center gap-3 rounded-chip px-4 py-2 text-sm text-ink">
        <span>{daten.text}</span>
        {daten.aktion && (
          <button
            type="button"
            onClick={() => {
              daten.aktion?.onClick()
              setDaten(null)
            }}
            className="pointer-events-auto rounded-chip bg-ink px-2.5 py-1 text-xs text-ground transition-colors hover:bg-white"
          >
            {daten.aktion.text}
          </button>
        )}
      </div>
    </div>
  )
}
