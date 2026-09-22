import { useCallback, useEffect, useState } from 'react'
import type { BossStand, Duell, Ereignis, SeasonStand } from '@shared/spiel'
import { fehlerText } from './format'

/*
 * Lade-Hooks fürs Team-Spiel (22. September 2026). Jeder Hook lädt beim Aufbau, bei Blockänderungen, bei Spiel-Ereignissen
 * aus dem Hauptprozess und in einem festen Takt neu; `fehler` trägt den Hinweis "Skript 21", solange die Tabellen fehlen.
 */

function useNeuLaden(laden: () => Promise<void>, taktMs: number): void {
  useEffect(() => {
    void laden()
    if (!window.api) return
    const abBloecke = window.api.bloecke.onAenderung(() => void laden())
    const abEreignis = window.api.spiel.onEreignis(() => void laden())
    const timer = window.setInterval(() => void laden(), taktMs)
    const sichtbar = (): void => {
      if (document.visibilityState === 'visible') void laden()
    }
    document.addEventListener('visibilitychange', sichtbar)
    return () => {
      abBloecke()
      abEreignis()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', sichtbar)
    }
  }, [laden, taktMs])
}

export function useSeason(): { stand: SeasonStand | null; fehler: string | null; neuLaden: () => Promise<void> } {
  const [stand, setStand] = useState<SeasonStand | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const laden = useCallback(async () => {
    if (!window.api) return
    try {
      const s = await window.api.spiel.stand()
      setStand(s)
      setFehler(null)
    } catch (e) {
      setFehler(fehlerText(e))
    }
  }, [])
  useNeuLaden(laden, 60_000)
  return { stand, fehler, neuLaden: laden }
}

export function useBoss(): { boss: BossStand | null; fehler: string | null; neuLaden: () => Promise<void> } {
  const [boss, setBoss] = useState<BossStand | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const laden = useCallback(async () => {
    if (!window.api) return
    try {
      setBoss(await window.api.spiel.boss())
      setFehler(null)
    } catch (e) {
      setFehler(fehlerText(e))
    }
  }, [])
  useNeuLaden(laden, 60_000)
  return { boss, fehler, neuLaden: laden }
}

export function useDuelle(): { duelle: Duell[]; fehler: string | null; neuLaden: () => Promise<void> } {
  const [duelle, setDuelle] = useState<Duell[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const laden = useCallback(async () => {
    if (!window.api) return
    try {
      setDuelle(await window.api.spiel.duelle())
      setFehler(null)
    } catch (e) {
      setFehler(fehlerText(e))
    }
  }, [])
  useNeuLaden(laden, 60_000)
  return { duelle, fehler, neuLaden: laden }
}

export function useFeed(): { feed: Ereignis[]; fehler: string | null; neuLaden: () => Promise<void> } {
  const [feed, setFeed] = useState<Ereignis[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const laden = useCallback(async () => {
    if (!window.api) return
    try {
      setFeed(await window.api.spiel.feed())
      setFehler(null)
    } catch (e) {
      setFehler(fehlerText(e))
    }
  }, [])
  useNeuLaden(laden, 60_000)
  return { feed, fehler, neuLaden: laden }
}
