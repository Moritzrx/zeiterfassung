import type { ReactElement, ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

/** Eine Fläche im Design: Milchglas über dem Hintergrund, 16 px gerundet, kein Rahmen. */
export function Karte({ children, className = '' }: Props): ReactElement {
  return <section className={`glas rounded-card p-5 ${className}`}>{children}</section>
}
