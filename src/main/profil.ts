import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { Profil as ProfilDaten } from '@shared/typen'
import { supabase, supabaseKonfiguriert } from './supabase'

const STANDARD: ProfilDaten = {
  name: '',
  urlaubswochen: 6,
  idleSchwelleSekunden: 180,
  fenstertitelSpeichern: true
}

interface Zeile {
  name: string
  urlaubswochen: number
  idle_schwelle_sekunden: number
  fenstertitel_speichern: boolean
}

/** Die eigenen Einstellungen aus der Tabelle profile, lokal zwischengespeichert. */
export class Profil {
  daten: ProfilDaten = { ...STANDARD }
  private readonly pfad: string

  constructor(private readonly userId: string) {
    this.pfad = join(app.getPath('userData'), `profil-${userId}.json`)
    try {
      if (existsSync(this.pfad)) this.daten = { ...STANDARD, ...(JSON.parse(readFileSync(this.pfad, 'utf8')) as ProfilDaten) }
    } catch {
      this.daten = { ...STANDARD }
    }
  }

  async laden(): Promise<boolean> {
    if (!supabaseKonfiguriert()) return false
    try {
      const { data, error } = await supabase()
        .from('profile')
        .select('name, urlaubswochen, idle_schwelle_sekunden, fenstertitel_speichern')
        .eq('user_id', this.userId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return false
      const z = data as Zeile
      this.daten = {
        name: z.name,
        urlaubswochen: z.urlaubswochen,
        idleSchwelleSekunden: z.idle_schwelle_sekunden,
        fenstertitelSpeichern: z.fenstertitel_speichern
      }
      this.speichern()
      return true
    } catch {
      return false
    }
  }

  async aendern(aenderung: Partial<ProfilDaten>): Promise<ProfilDaten> {
    const neu = { ...this.daten, ...aenderung }
    const { error } = await supabase()
      .from('profile')
      .update({
        name: neu.name,
        urlaubswochen: neu.urlaubswochen,
        idle_schwelle_sekunden: neu.idleSchwelleSekunden,
        fenstertitel_speichern: neu.fenstertitelSpeichern
      })
      .eq('user_id', this.userId)
    if (error) throw new Error('Einstellung konnte nicht gespeichert werden: ' + error.message)
    this.daten = neu
    this.speichern()
    return neu
  }

  private speichern(): void {
    try {
      mkdirSync(dirname(this.pfad), { recursive: true })
      writeFileSync(this.pfad, JSON.stringify(this.daten))
    } catch {
      // Zwischenspeicher ist optional
    }
  }
}
