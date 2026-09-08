import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { NeueRegel, Regel, RegelAenderung } from '@shared/typen'
import { supabase, supabaseKonfiguriert } from './supabase'

interface Zeile {
  id: string
  muster: string
  feld: 'programm' | 'titel'
  taetigkeit: string | null
  bewertung: Regel['bewertung']
  gilt_fuer: string | null
  prioritaet: number
  aktiv: boolean
  erstellt_von: string | null
}

function vonZeile(z: Zeile): Regel {
  return {
    id: z.id,
    muster: z.muster,
    feld: z.feld,
    taetigkeit: z.taetigkeit,
    bewertung: z.bewertung,
    giltFuer: z.gilt_fuer,
    prioritaet: z.prioritaet,
    aktiv: z.aktiv,
    erstelltVon: z.erstellt_von
  }
}

/**
 * Alle Regeln aus der Datenbank, lokal zwischengespeichert, damit die
 * Bewertung auch ohne Verbindung funktioniert.
 */
export class Regelwerk {
  fehler: string | null = null
  private regeln: Regel[] = []
  private readonly pfad = join(app.getPath('userData'), 'regeln.json')

  constructor(private readonly userId: string) {
    try {
      if (existsSync(this.pfad)) this.regeln = JSON.parse(readFileSync(this.pfad, 'utf8')) as Regel[]
    } catch {
      this.regeln = []
    }
  }

  liste(): Regel[] {
    return this.regeln
  }

  async laden(): Promise<boolean> {
    if (!supabaseKonfiguriert()) return false
    try {
      const { data, error } = await supabase().from('regel').select('*')
      if (error) throw new Error(error.message)
      this.regeln = ((data ?? []) as Zeile[]).map(vonZeile)
      this.speichern()
      this.fehler = null
      return true
    } catch (e) {
      this.fehler = e instanceof Error ? e.message : String(e)
      return false
    }
  }

  async anlegen(neu: NeueRegel): Promise<Regel> {
    const muster = neu.muster.trim()
    if (!muster) throw new Error('Das Muster darf nicht leer sein.')
    const zeile = {
      muster,
      feld: neu.feld,
      taetigkeit: neu.taetigkeit,
      bewertung: neu.bewertung,
      gilt_fuer: neu.fuerAlle ? null : this.userId,
      prioritaet: 0,
      erstellt_von: this.userId
    }
    const { data, error } = await supabase().from('regel').insert(zeile).select('*').single()
    if (error) throw new Error('Regel konnte nicht gespeichert werden: ' + error.message)
    const regel = vonZeile(data as Zeile)
    this.regeln.push(regel)
    this.speichern()
    return regel
  }

  /** Ändert eine Regel. Team-Regeln darf jeder ändern, persönliche nur die eigene Person (RLS). */
  async aendern(id: string, aenderung: RegelAenderung): Promise<Regel> {
    const alt = this.regeln.find((r) => r.id === id)
    if (!alt) throw new Error('Regel nicht gefunden.')
    const neu: Regel = {
      ...alt,
      muster: (aenderung.muster ?? alt.muster).trim(),
      feld: aenderung.feld ?? alt.feld,
      taetigkeit: aenderung.taetigkeit === undefined ? alt.taetigkeit : aenderung.taetigkeit,
      bewertung: aenderung.bewertung ?? alt.bewertung,
      aktiv: aenderung.aktiv ?? alt.aktiv,
      giltFuer: aenderung.fuerAlle === undefined ? alt.giltFuer : aenderung.fuerAlle ? null : this.userId
    }
    if (!neu.muster) throw new Error('Das Muster darf nicht leer sein.')
    const { error } = await supabase()
      .from('regel')
      .update({
        muster: neu.muster,
        feld: neu.feld,
        taetigkeit: neu.taetigkeit,
        bewertung: neu.bewertung,
        aktiv: neu.aktiv,
        gilt_fuer: neu.giltFuer
      })
      .eq('id', id)
    if (error) throw new Error('Regel konnte nicht geändert werden: ' + error.message)
    this.regeln = this.regeln.map((r) => (r.id === id ? neu : r))
    this.speichern()
    return neu
  }

  async loeschen(id: string): Promise<void> {
    const { error } = await supabase().from('regel').delete().eq('id', id)
    if (error) throw new Error('Regel konnte nicht gelöscht werden: ' + error.message)
    this.regeln = this.regeln.filter((r) => r.id !== id)
    this.speichern()
  }

  private speichern(): void {
    try {
      mkdirSync(dirname(this.pfad), { recursive: true })
      writeFileSync(this.pfad, JSON.stringify(this.regeln))
    } catch {
      // Zwischenspeicher ist optional
    }
  }
}
