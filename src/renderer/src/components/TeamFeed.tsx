import { useState, type FormEvent, type ReactElement } from 'react'
import { Crown, Flame, Medal, MessageCircle, Send, Skull, Sparkles, Swords, Target, Trophy } from 'lucide-react'
import { REAKTIONEN, type EreignisTyp } from '@shared/spiel'
import { berlinDatum } from '@shared/zeit'
import { Karte } from './Karte'
import { hinweisZeigen } from './Hinweis'
import { useFeed } from '../spiel'
import { useNutzer } from '../nutzer'
import { fehlerText, kurzDatum, uhrzeit } from '../format'
import { tonSpielen } from '../toene'

const SYMBOLE: Record<EreignisTyp, ReactElement> = {
  auszeichnung: <Medal size={14} strokeWidth={1.8} />,
  rang: <Trophy size={14} strokeWidth={1.8} />,
  liga: <Crown size={14} strokeWidth={1.8} />,
  boss: <Skull size={14} strokeWidth={1.8} />,
  'boss-schaden': <Skull size={14} strokeWidth={1.8} />,
  streak: <Flame size={14} strokeWidth={1.8} />,
  quests: <Target size={14} strokeWidth={1.8} />,
  duell: <Swords size={14} strokeWidth={1.8} />,
  season: <Sparkles size={14} strokeWidth={1.8} />,
  nachricht: <MessageCircle size={14} strokeWidth={1.8} />
}

function initialen(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? '')
    .join('')
}

function zeitText(iso: string): string {
  const heute = berlinDatum(new Date())
  const tag = berlinDatum(new Date(iso))
  return tag === heute ? uhrzeit(iso) : `${kurzDatum(tag)}, ${uhrzeit(iso)}`
}

/**
 * Team-Feed (22. September 2026): Medaillen, Ränge, Boss-Schaden, Streaks, Quests, Duelle und Nachrichten der drei,
 * mit Reaktionen wie in einem Spiel-Chat. Neue Einträge kommen aus dem Hauptprozess, hier nur Nachrichten.
 */
export function TeamFeed(): ReactElement {
  const { feed, fehler, neuLaden } = useFeed()
  const { status } = useNutzer()
  const [text, setText] = useState('')
  const [sendet, setSendet] = useState(false)

  async function senden(e: FormEvent): Promise<void> {
    e.preventDefault()
    const t = text.trim()
    if (!t || !window.api || sendet) return
    setSendet(true)
    try {
      await window.api.spiel.posten('nachricht', t)
      setText('')
      tonSpielen('erfolg')
      await neuLaden()
    } catch (fehler) {
      hinweisZeigen(fehlerText(fehler))
    } finally {
      setSendet(false)
    }
  }

  async function reagieren(id: string, emoji: string): Promise<void> {
    if (!window.api) return
    try {
      await window.api.spiel.reagieren(id, emoji)
      await neuLaden()
    } catch (fehler) {
      hinweisZeigen(fehlerText(fehler))
    }
  }

  return (
    <Karte>
      <p className="text-xs tracking-wide text-mute uppercase">Team-Feed</p>
      <form onSubmit={(e) => void senden(e)} className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-chip bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-dim"
          placeholder="Etwas ans Team schreiben …"
          value={text}
          maxLength={280}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={!text.trim() || sendet} className="flex items-center gap-1.5 rounded-chip bg-ink px-3 py-2 text-sm text-ground disabled:opacity-40">
          <Send size={14} strokeWidth={2} />
          Senden
        </button>
      </form>
      {fehler && <p className="mt-3 text-sm text-mute">{fehler}</p>}
      {!fehler && feed.length === 0 && <p className="mt-3 text-sm text-dim">Noch nichts passiert. Medaillen, Boss-Schaden, Streaks und Duelle landen hier von selbst.</p>}
      <div className="mt-2 divide-y divide-panel-2">
        {feed.map((e) => {
          const istIch = e.userId === status?.userId
          return (
            <div key={e.id} className="flex gap-3 py-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs ${istIch ? 'bg-produktiv text-ground' : 'bg-panel-2 text-ink'}`}>
                {initialen(e.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-xs text-dim">
                  <span className={e.typ === 'nachricht' ? 'text-mute' : 'text-orange'}>{SYMBOLE[e.typ] ?? SYMBOLE.nachricht}</span>
                  <span className="text-mute">{e.name}</span>
                  <span>{zeitText(e.erstelltAm)}</span>
                </p>
                <p className={`mt-0.5 text-sm ${e.typ === 'nachricht' ? '' : 'text-ink/90'}`}>{e.text}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {REAKTIONEN.map((emoji) => {
                    const r = e.reaktionen.find((x) => x.emoji === emoji)
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => void reagieren(e.id, emoji)}
                        className={`rounded-chip px-1.5 py-0.5 text-xs transition-colors ${r?.meine ? 'bg-produktiv/25 text-ink' : r ? 'bg-panel-2 text-ink' : 'bg-panel-2/60 text-dim hover:text-ink'}`}
                        title={r?.meine ? 'Reaktion wegnehmen' : 'Reagieren'}
                      >
                        {emoji}
                        {r && r.anzahl > 0 ? ` ${r.anzahl}` : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Karte>
  )
}
