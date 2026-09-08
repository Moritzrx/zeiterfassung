import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { Ziel } from '@shared/typen'
import { supabase, supabaseKonfiguriert } from './supabase'

interface Zeile {
  id: string
  user_id: string
  taetigkeit: string | null
  stunden_pro_woche: number | string
}

function vonZeile(z: Zeile): Ziel {
  return { id: z.id, userId: z.user_id, taetigkeit: z.taetigkeit, stundenProWoche: Number(z.stunden_pro_woche) }
}

/** Die Wochenziele aller drei aus der Datenbank, lokal zwischengespeichert. */
export class Ziele {
  fehler: string | null = null
  private liste: Ziel[] = []
  private readonly pfad = join(app.getPath('userData'), 'ziele.json')

  constructor(private readonly userId: string) {
    try {
      if (existsSync(this.pfad)) this.liste = JSON.parse(readFileSync(this.pfad, 'utf8')) as Ziel[]
    } catch {
      this.liste = []
    }
  }

  eigene(): Ziel[] {
    return this.liste.filter((z) => z.userId === this.userId)
  }

  alle(): Ziel[] {
    return this.liste
  }

  async laden(): Promise<boolean> {
    if (!supabaseKonfiguriert()) return false
    try {
      const { data, error } = await supabase().from('ziel').select('*')
      if (error) throw new Error(error.message)
      this.liste = ((data ?? []) as Zeile[]).map(vonZeile)
      this.speichern()
      this.fehler = null
      return true
    } catch (e) {
      this.fehler = e instanceof Error ? e.message : String(e)
      return false
    }
  }

  private speichern(): void {
    try {
      mkdirSync(dirname(this.pfad), { recursive: true })
      writeFileSync(this.pfad, JSON.stringify(this.liste))
    } catch {
      // Zwischenspeicher ist optional
    }
  }
}
