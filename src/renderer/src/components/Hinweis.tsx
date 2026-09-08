import { useEffect, useState, type ReactElement } from 'react'

/** Zeigt unten eine kurze Meldung, z. B. "37 Blöcke neu bewertet". */
export function hinweisZeigen(text: string): void {
  window.dispatchEvent(new CustomEvent('hinweis', { detail: text }))
}

export function Hinweise(): ReactElement | null {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    let timer = 0
    const handler = (ereignis: Event): void => {
      setText((ereignis as CustomEvent<string>).detail)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setText(null), 4000)
    }
    window.addEventListener('hinweis', handler)
    return () => {
      window.removeEventListener('hinweis', handler)
      window.clearTimeout(timer)
    }
  }, [])

  if (!text) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center">
      <div className="rounded-chip bg-panel-2 px-4 py-2 text-sm text-ink">{text}</div>
    </div>
  )
}
