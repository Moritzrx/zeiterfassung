import type { ReactElement } from 'react'
import { Karte } from '../components/Karte'
import { useNutzer } from '../nutzer'

export function EinstellungenScreen(): ReactElement {
  const { status, neuLaden } = useNutzer()

  async function abmelden(): Promise<void> {
    await window.api.auth.abmelden()
    await neuLaden()
  }

  return (
    <div className="flex flex-col gap-4 pt-6">
      <h1 className="text-2xl font-light">Einstellungen</h1>
      <p className="text-sm text-mute">
        Regeln, Ziele, Symbole, Untätigkeit und Urlaubswochen kommen in Schritt 10.
      </p>

      <Karte className="mt-4">
        <p className="text-xs tracking-wide text-mute uppercase">Konto</p>
        <p className="mt-2 text-sm">{status?.name ?? 'Unbekannt'}</p>
        <p className="text-sm text-mute">{status?.email ?? ''}</p>
        <button
          type="button"
          onClick={abmelden}
          className="mt-4 rounded-chip bg-panel-2 px-4 py-2 text-sm text-ink transition-colors hover:bg-inaktiv"
        >
          Abmelden
        </button>
      </Karte>
    </div>
  )
}
