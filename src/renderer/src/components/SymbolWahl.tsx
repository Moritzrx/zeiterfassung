import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Portal } from './Portal'
import { X } from 'lucide-react'
import type { SymbolInfo } from '@shared/typen'
import { LUCIDE_SYMBOLE, MARKEN, MARKEN_ERSATZ, SymbolBild } from '../symbole'

interface Props {
  name: string
  aktuell: SymbolInfo
  onWahl: (symbol: SymbolInfo) => void
  onSchliessen: () => void
}

const FELD =
  'w-full rounded-chip bg-panel-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim'

/** Fenster zur Auswahl eines Symbols: Markenlogos und eine kuratierte Liste weißer Symbole, mit Suche. */
export function SymbolWahl({ name, aktuell, onWahl, onSchliessen }: Props): ReactElement {
  const [suche, setSuche] = useState('')

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  const s = suche.trim().toLowerCase()
  const marken = useMemo(() => {
    const alle = [...Object.keys(MARKEN), ...Object.keys(MARKEN_ERSATZ)].map((k) => ({
      schluessel: k,
      titel: MARKEN[k]?.title ?? k.charAt(0).toUpperCase() + k.slice(1)
    }))
    return alle.filter((m) => !s || m.schluessel.includes(s) || m.titel.toLowerCase().includes(s))
  }, [s])
  const symbole = useMemo(
    () =>
      Object.entries(LUCIDE_SYMBOLE).filter(([k, e]) => !s || k.includes(s) || e.suche.toLowerCase().includes(s)),
    [s]
  )

  function istAktuell(typ: SymbolInfo['typ'], schluessel: string): boolean {
    return aktuell.typ === typ && aktuell.name === schluessel
  }

  return (
    <Portal>
    <div className="animate-aufblenden fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" onClick={onSchliessen}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[calc(100vh-3rem)] w-full max-w-[640px] overscroll-contain overflow-y-auto rounded-card bg-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl">Symbol für {name}</h2>
            <p className="mt-1 text-sm text-mute">Gilt für alle drei, überall wo die Tätigkeit auftaucht.</p>
          </div>
          <button type="button" onClick={onSchliessen} className="rounded-chip p-1 text-mute hover:text-ink" title="Schließen">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <input
          className={`${FELD} mt-4`}
          placeholder="Suchen, z. B. Kamera, Instagram, Telefon"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          autoFocus
        />

        {marken.length > 0 && (
          <>
            <p className="mt-5 text-xs tracking-wide text-mute uppercase">Marken</p>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {marken.map((m) => (
                <button
                  key={m.schluessel}
                  type="button"
                  onClick={() => onWahl({ typ: 'marke', name: m.schluessel })}
                  title={m.titel}
                  className={`flex flex-col items-center gap-1 rounded-card p-2 text-[10px] text-mute transition-colors hover:bg-panel-2 ${
                    istAktuell('marke', m.schluessel) ? 'bg-panel-2 text-ink' : ''
                  }`}
                >
                  <SymbolBild symbol={{ typ: 'marke', name: m.schluessel }} groesse={22} />
                  <span className="w-full truncate text-center">{m.titel}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {symbole.length > 0 && (
          <>
            <p className="mt-5 text-xs tracking-wide text-mute uppercase">Symbole</p>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {symbole.map(([k, e]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => onWahl({ typ: 'lucide', name: k })}
                  title={e.suche}
                  className={`flex flex-col items-center gap-1 rounded-card p-2 text-[10px] text-mute transition-colors hover:bg-panel-2 ${
                    istAktuell('lucide', k) ? 'bg-panel-2 text-ink' : ''
                  }`}
                >
                  <SymbolBild symbol={{ typ: 'lucide', name: k }} groesse={22} />
                  <span className="w-full truncate text-center">{e.suche.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {marken.length === 0 && symbole.length === 0 && <p className="mt-5 text-sm text-dim">Nichts gefunden.</p>}
      </div>
    </div>
    </Portal>
  )
}
