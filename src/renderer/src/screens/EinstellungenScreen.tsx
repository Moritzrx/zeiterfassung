import type { ReactElement } from 'react'
import { Karte } from '../components/Karte'
import { useErfassung } from '../erfassung'
import { uhrzeit } from '../format'
import { useNutzer } from '../nutzer'

export function EinstellungenScreen(): ReactElement {
  const { status, neuLaden } = useNutzer()
  const erfassung = useErfassung()

  async function abmelden(): Promise<void> {
    await window.api.auth.abmelden()
    await neuLaden()
  }

  let abgleich = 'Noch kein Abgleich in dieser Sitzung.'
  if (erfassung.syncFehler) abgleich = `Datenbank nicht erreichbar: ${erfassung.syncFehler}`
  else if (erfassung.letzterSync) abgleich = `Zuletzt abgeglichen um ${uhrzeit(erfassung.letzterSync)}.`

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

      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Datenbank</p>
        <p className="mt-2 text-sm">{abgleich}</p>
        <p className="text-sm text-mute">
          {erfassung.unsynchronisiert === 0
            ? 'Alle Blöcke sind in der Datenbank.'
            : `${erfassung.unsynchronisiert} Block${erfassung.unsynchronisiert === 1 ? '' : 'e'} warten auf den nächsten Abgleich (alle 60 Sekunden).`}
        </p>
      </Karte>
    </div>
  )
}
