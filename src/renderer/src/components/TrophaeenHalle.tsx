import { useEffect, useState, type ReactElement } from 'react'
import { X } from 'lucide-react'
import type { BossHalleEintrag } from '@shared/spiel'
import { datumVerschieben, datumZuTagesanfang, kalenderwoche } from '@shared/zeit'
import { Portal } from './Portal'
import { bossBild, bossFarbe } from './bossBilder'
import { fehlerText, kurzDatum, stundenText } from '../format'

interface Props {
  onSchliessen: () => void
}

/** Alle Bosse vergangener Wochen: besiegte leuchten, überlebende bleiben grau. */
export function TrophaeenHalle({ onSchliessen }: Props): ReactElement {
  const [liste, setListe] = useState<BossHalleEintrag[] | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    if (!window.api) return
    window.api.spiel
      .bossHalle()
      .then(setListe)
      .catch((e) => setFehler(fehlerText(e)))
  }, [])

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  const siege = liste?.filter((b) => b.besiegt).length ?? 0

  return (
    <Portal>
      <div className="animate-aufblenden fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" onClick={onSchliessen}>
        <div onClick={(e) => e.stopPropagation()} className="max-h-[calc(100vh-3rem)] w-full max-w-[640px] overscroll-contain overflow-y-auto rounded-card bg-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl">Trophäenhalle</h2>
              <p className="mt-1 text-sm text-mute">
                {liste === null ? 'Wird geladen …' : liste.length === 0 ? 'Noch kein Boss abgeschlossen. Der erste fällt am Sonntag, wenn ihr genug Stunden macht.' : `${siege} von ${liste.length} Bossen besiegt.`}
              </p>
            </div>
            <button type="button" onClick={onSchliessen} className="rounded-chip p-1 text-mute hover:text-ink" title="Schließen">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
          {fehler && <p className="mt-4 text-sm text-unproduktiv">{fehler}</p>}
          <div className="mt-4 divide-y divide-panel-2">
            {liste?.map((b) => {
              const farbe = bossFarbe(b.schluessel)
              const kw = kalenderwoche(datumZuTagesanfang(b.wocheStart))
              return (
                <div key={b.wocheStart} className="flex items-center gap-4 py-3">
                  <img
                    src={bossBild(b.schluessel)}
                    alt=""
                    draggable={false}
                    className={`h-14 w-14 shrink-0 select-none ${b.besiegt ? '' : 'opacity-40 grayscale'}`}
                    style={b.besiegt ? { filter: `drop-shadow(0 0 8px ${farbe}88)` } : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-base">{b.name}</p>
                    <p className="text-xs text-dim">
                      KW {kw} · {kurzDatum(b.wocheStart)} bis {kurzDatum(datumVerschieben(b.wocheStart, 6))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm ${b.besiegt ? 'text-produktiv' : 'text-mute'}`}>{b.besiegt ? 'Besiegt' : 'Überlebt'}</p>
                    <p className="text-xs text-dim tabular-nums">
                      {stundenText(b.ergebnisSekunden)} von {stundenText(b.hpSekunden)} h
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Portal>
  )
}
