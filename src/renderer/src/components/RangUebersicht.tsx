import { useEffect, type ReactElement } from 'react'
import { Portal } from './Portal'
import { X } from 'lucide-react'
import {
  MAX_RANG,
  RANG_ZIEL,
  STUFEN_FARBEN,
  STUFEN_NAMEN,
  rangName,
  rangSchwelle,
  rangStufe,
  type RangStufe
} from '@shared/rang'
import { stundenText } from '../format'
import { RangAbzeichen } from './RangAbzeichen'

interface Props {
  /** Der eigene aktuelle Rang, wird hervorgehoben */
  aktuellerRang: number
  onSchliessen: () => void
}

const STUFEN: RangStufe[] = ['bronze', 'silber', 'gold', 'champion', 'diamant']

/** Alle 15 Ränge auf einen Blick: Abzeichen, Name, Stufe und die Stunden, ab denen man ihn hat. */
export function RangUebersicht({ aktuellerRang, onSchliessen }: Props): ReactElement {
  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  const raenge = Array.from({ length: MAX_RANG }, (_, i) => i + 1)

  return (
    <Portal>
    <div className="animate-aufblenden fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" onClick={onSchliessen}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100vh-3rem)] w-full max-w-[720px] overscroll-contain overflow-y-auto rounded-card bg-panel p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl">Alle {MAX_RANG} Ränge</h2>
            <p className="mt-1 text-sm text-mute">
              Bis Rang {RANG_ZIEL} bringt jede fünfte produktive Stunde der Woche einen Rang. Ab Rang {RANG_ZIEL} jede zweite.
              Montag beginnt jeder wieder bei null.
            </p>
          </div>
          <button type="button" onClick={onSchliessen} className="rounded-chip p-1 text-mute hover:text-ink" title="Schließen">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {STUFEN.map((stufe) => {
          const eigene = raenge.filter((r) => rangStufe(r) === stufe)
          return (
            <div key={stufe} className="mt-6">
              <p className="text-xs tracking-wide uppercase" style={{ color: STUFEN_FARBEN[stufe] }}>
                {STUFEN_NAMEN[stufe]}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {eigene.map((r) => {
                  const erreicht = r <= aktuellerRang
                  const istAktuell = r === aktuellerRang
                  return (
                    <div
                      key={r}
                      className={`flex items-center gap-3 rounded-card p-3 ${
                        istAktuell ? 'bg-panel-2' : erreicht ? 'bg-panel-2/40' : ''
                      }`}
                    >
                      <div className={erreicht ? '' : 'opacity-40'}>
                        <RangAbzeichen rang={r} groesse={52} />
                      </div>
                      <div className="min-w-0">
                        <p className={`truncate text-sm ${erreicht ? 'text-ink' : 'text-mute'}`}>
                          {r}. {rangName(r)}
                        </p>
                        <p className="text-xs text-dim">ab {stundenText(rangSchwelle(r))} h</p>
                        {istAktuell && <p className="text-xs text-produktiv">dein Rang diese Woche</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
    </Portal>
  )
}
