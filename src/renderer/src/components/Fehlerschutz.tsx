import { Component, type ErrorInfo, type ReactElement, type ReactNode } from 'react'

interface Props {
  /** Name des Bereichs für die Meldung, z. B. "Woche" */
  bereich: string
  children: ReactNode
}

interface Zustand {
  fehler: Error | null
  /** zählt hoch, damit "Neu laden" den Bereich frisch aufbaut */
  versuch: number
}

/**
 * Fängt Fehler eines Bereichs ab, damit nicht die ganze App schwarz wird: statt des Bereichs
 * erscheint eine Karte mit der Fehlermeldung, "Neu laden" baut nur diesen Bereich neu auf,
 * "App neu starten" lädt das ganze Fenster. Fehler landen zusätzlich in der Konsole.
 */
export class Fehlerschutz extends Component<Props, Zustand> {
  state: Zustand = { fehler: null, versuch: 0 }

  static getDerivedStateFromError(fehler: Error): Partial<Zustand> {
    return { fehler }
  }

  componentDidCatch(fehler: Error, info: ErrorInfo): void {
    console.error(`Fehler im Bereich "${this.props.bereich}":`, fehler, info.componentStack)
  }

  render(): ReactNode {
    const { fehler, versuch } = this.state
    if (!fehler) return <FrischerBereich key={versuch}>{this.props.children}</FrischerBereich>
    return (
      <section className="glas mx-auto mt-6 max-w-[560px] rounded-card p-5">
        <p className="text-xs tracking-wide text-unproduktiv uppercase">Fehler</p>
        <p className="mt-1 text-lg">Der Bereich „{this.props.bereich}" konnte nicht angezeigt werden.</p>
        <p className="mt-2 text-sm text-mute">
          Der Rest der App läuft weiter, die Erfassung auch. Meist hilft „Neu laden". Bleibt der Fehler, bitte Moritz
          Bescheid sagen und die Meldung darunter mitschicken.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-chip bg-panel-2 p-3 text-xs text-dim select-text">{fehler.message}</pre>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => this.setState({ fehler: null, versuch: versuch + 1 })}
            className="rounded-chip bg-ink px-4 py-2 text-sm text-ground transition-colors hover:bg-white"
          >
            Neu laden
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-chip bg-panel-2 px-4 py-2 text-sm text-ink transition-colors hover:bg-inaktiv"
          >
            App neu starten
          </button>
        </div>
      </section>
    )
  }
}

/** Nur eine Hülle mit eigenem Schlüssel, damit "Neu laden" den Inhalt wirklich neu aufbaut. */
function FrischerBereich({ children }: { children: ReactNode }): ReactElement {
  return <>{children}</>
}
