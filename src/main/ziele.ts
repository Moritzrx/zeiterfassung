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

  /** Eigenes Ziel setzen oder anlegen. taetigkeit null = Arbeitszeit gesamt. */
  async setzen(taetigkeit: string | null, stundenProWoche: number): Promise<Ziel> {
    if (!(stundenProWoche > 0) || stundenProWoche > 168) throw new Error('Bitte eine Stundenzahl zwischen 0,5 und 168 angeben.')
    const { data, error } = await supabase()
      .from('ziel')
      .upsert({ user_id: this.userId, taetigkeit, stunden_pro_woche: stundenProWoche }, { onConflict: 'user_id,taetigkeit' })
      .select('*')
      .single()
    if (error) throw new Error('Ziel konnte nicht gespeichert werden: ' + error.message)
    const ziel = vonZeile(data as Zeile)
    this.liste = [...this.liste.filter((z) => z.id !== ziel.id), ziel]
    this.speichern()
    return ziel
  }

  async loeschen(id: string): Promise<void> {
    const { error } = await supabase().from('ziel').delete().eq('id', id).eq('user_id', this.userId)
    if (error) throw new Error('Ziel konnte nicht gelöscht werden: ' + error.message)
    this.liste = this.liste.filter((z) => z.id !== id)
    this.speichern()
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
