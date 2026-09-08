import type { ReactElement, ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

/** Eine Fläche im Design: minimal heller als der Hintergrund, 16 px gerundet, kein Rahmen, kein Schatten. */
export function Karte({ children, className = '' }: Props): ReactElement {
  return <section className={`rounded-card bg-panel p-5 ${className}`}>{children}</section>
}
