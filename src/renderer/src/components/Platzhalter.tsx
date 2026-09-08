import type { ReactElement } from 'react'

interface Props {
  titel: string
  schritt: number
  beschreibung: string
}

/** Leerer Screen, solange ein Feature noch nicht gebaut ist. */
export function Platzhalter({ titel, schritt, beschreibung }: Props): ReactElement {
  return (
    <div className="pt-6">
      <h1 className="text-2xl font-light">{titel}</h1>
      <p className="mt-2 text-sm text-mute">{beschreibung}</p>
      <p className="mt-10 text-center text-sm text-dim">Kommt in Schritt {schritt}.</p>
    </div>
  )
}
