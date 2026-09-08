import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

interface Stand {
  /** Montag der Woche, für die die Werte gelten */
  wocheStart: string
  /** höchster Rang, der diese Woche schon gefeiert wurde */
  gefeiert: number
  /** true, wenn die Sonntags-Meldung für diese Woche schon raus ist */
  benachrichtigt: boolean
}

/**
 * Merkt sich je Woche, welcher Rang schon gefeiert wurde, damit die Aufstiegs-
 * Einblendung nicht zweimal kommt, wenn jemand nach einer Korrektur wieder aufsteigt.
 */
export class Feier {
  private stand: Stand = { wocheStart: '', gefeiert: 0, benachrichtigt: false }
  private readonly pfad: string

  constructor(userId: string) {
    this.pfad = join(app.getPath('userData'), `feier-${userId}.json`)
    try {
      if (existsSync(this.pfad)) this.stand = { ...this.stand, ...(JSON.parse(readFileSync(this.pfad, 'utf8')) as Stand) }
    } catch {
      // Neustart bei null ist unkritisch
    }
  }

  private fuerWoche(wocheStart: string): Stand {
    if (this.stand.wocheStart !== wocheStart) {
      this.stand = { wocheStart, gefeiert: 0, benachrichtigt: false }
      this.speichern()
    }
    return this.stand
  }

  gefeierterRang(wocheStart: string): number {
    return this.fuerWoche(wocheStart).gefeiert
  }

  feiern(wocheStart: string, rang: number): void {
    const s = this.fuerWoche(wocheStart)
    if (rang > s.gefeiert) {
      s.gefeiert = rang
      this.speichern()
    }
  }

  istBenachrichtigt(wocheStart: string): boolean {
    return this.fuerWoche(wocheStart).benachrichtigt
  }

  benachrichtigt(wocheStart: string): void {
    this.fuerWoche(wocheStart).benachrichtigt = true
    this.speichern()
  }

  private speichern(): void {
    try {
      mkdirSync(dirname(this.pfad), { recursive: true })
      writeFileSync(this.pfad, JSON.stringify(this.stand))
    } catch {
      // optional
    }
  }
}
