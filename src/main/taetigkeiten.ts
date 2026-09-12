import type { Block, SymbolInfo } from '@shared/typen'
import { taetigkeitSchluessel } from '@shared/regeln'
import { supabase, supabaseKonfiguriert } from './supabase'

interface Eintrag {
  name: string
  symbol: SymbolInfo
  /** Nicht am Rechner (Dreh, Fahrt, Kundentermin): steht bei "Ich bin weg", nicht im Fokus. */
  unterwegs: boolean
}

interface Zeile {
  name: string
  schluessel: string
  symbol_typ: 'lucide' | 'marke'
  symbol_name: string
  unterwegs?: boolean
}

const STANDARD_SYMBOL: SymbolInfo = { typ: 'lucide', name: 'tag' }

/**
 * Alle bekannten Tätigkeitsnamen des Teams mit ihren Symbolen und der Einordnung "am Rechner" oder
 * "unterwegs": aus der Tabelle taetigkeit, den Zielen und den eigenen Blöcken. Sorgt dafür, dass
 * "ki learning" zur vorhandenen Schreibweise "KI Learning" wird.
 */
export class Taetigkeiten {
  private readonly bekannt = new Map<string, Eintrag>()
  /** Ob die Spalte `unterwegs` in der Datenbank schon existiert (Skript 16); vorher gilt alles als "am Rechner". */
  private spalteUnterwegs = true

  constructor(private readonly userId: string) {}

  /** Bereinigt einen Namen und übernimmt eine schon bekannte Schreibweise. */
  merken(name: string): string {
    const bereinigt = name.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!bereinigt) return bereinigt
    const schluessel = taetigkeitSchluessel(bereinigt)
    const vorhanden = this.bekannt.get(schluessel)
    if (vorhanden) return vorhanden.name
    this.bekannt.set(schluessel, { name: bereinigt, symbol: { ...STANDARD_SYMBOL }, unterwegs: false })
    void this.hochladen(bereinigt, schluessel)
    return bereinigt
  }

  /** Ob dieser Name (in irgendeiner Schreibweise) schon bekannt ist. */
  kennt(name: string): boolean {
    return this.bekannt.has(taetigkeitSchluessel(name))
  }

  liste(): string[] {
    return [...this.bekannt.values()].map((e) => e.name).sort((a, b) => a.localeCompare(b, 'de'))
  }

  /** Symbol je Vergleichsschlüssel, für das Fenster. */
  symbole(): Record<string, SymbolInfo> {
    const ergebnis: Record<string, SymbolInfo> = {}
    for (const [schluessel, e] of this.bekannt) ergebnis[schluessel] = e.symbol
    return ergebnis
  }

  /** Vergleichsschlüssel der Unterwegs-Tätigkeiten (Wert immer true), für das Fenster. */
  unterwegs(): Record<string, boolean> {
    const ergebnis: Record<string, boolean> = {}
    for (const [schluessel, e] of this.bekannt) if (e.unterwegs) ergebnis[schluessel] = true
    return ergebnis
  }

  ausBloecken(bloecke: Block[]): void {
    for (const b of bloecke) {
      if (!b.taetigkeit) continue
      const schluessel = taetigkeitSchluessel(b.taetigkeit)
      if (!this.bekannt.has(schluessel)) this.bekannt.set(schluessel, { name: b.taetigkeit, symbol: { ...STANDARD_SYMBOL }, unterwegs: false })
    }
  }

  async laden(): Promise<void> {
    if (!supabaseKonfiguriert()) return
    try {
      let zeilen: Zeile[] = []
      const mit = await supabase().from('taetigkeit').select('name, schluessel, symbol_typ, symbol_name, unterwegs')
      if (mit.error) {
        // Spalte fehlt noch (Skript 16): ohne sie laden, alle Tätigkeiten gelten als "am Rechner".
        this.spalteUnterwegs = false
        console.warn('Spalte "unterwegs" fehlt noch (Skript 16), Tätigkeiten gelten alle als am Rechner:', mit.error.message)
        const ohne = await supabase().from('taetigkeit').select('name, schluessel, symbol_typ, symbol_name')
        zeilen = (ohne.data ?? []) as Zeile[]
      } else {
        this.spalteUnterwegs = true
        zeilen = (mit.data ?? []) as Zeile[]
      }
      for (const z of zeilen) {
        this.bekannt.set(z.schluessel, { name: z.name, symbol: { typ: z.symbol_typ, name: z.symbol_name }, unterwegs: z.unterwegs === true })
      }
      const { data: ziele } = await supabase().from('ziel').select('taetigkeit')
      for (const z of (ziele ?? []) as Array<{ taetigkeit: string | null }>) {
        if (!z.taetigkeit) continue
        const schluessel = taetigkeitSchluessel(z.taetigkeit)
        if (!this.bekannt.has(schluessel)) this.bekannt.set(schluessel, { name: z.taetigkeit, symbol: { ...STANDARD_SYMBOL }, unterwegs: false })
      }
    } catch {
      // Offline: die lokal bekannten Namen reichen vorerst.
    }
  }

  /** Symbol einer Tätigkeit für das ganze Team setzen. */
  async symbolSetzen(name: string, symbol: SymbolInfo): Promise<void> {
    const schluessel = taetigkeitSchluessel(name)
    const eintrag = this.bekannt.get(schluessel) ?? { name, symbol, unterwegs: false }
    eintrag.symbol = symbol
    this.bekannt.set(schluessel, eintrag)
    const { error } = await supabase()
      .from('taetigkeit')
      .upsert(
        { name: eintrag.name, schluessel, symbol_typ: symbol.typ, symbol_name: symbol.name, erstellt_von: this.userId },
        { onConflict: 'schluessel' }
      )
    if (error) throw new Error('Symbol konnte nicht gespeichert werden: ' + error.message)
  }

  /**
   * Einordnung "unterwegs" (nicht am Rechner) für das ganze Team setzen (12. September 2026: Dreh, Fahrt und
   * Kundentermin gehören nicht in den Fokus-Dialog, sondern zu "Ich bin weg").
   */
  async unterwegsSetzen(name: string, an: boolean): Promise<void> {
    if (!this.spalteUnterwegs) throw new Error('Dafür muss in Supabase einmal das Skript 16 (16_taetigkeit_unterwegs.sql) ausgeführt werden.')
    const schluessel = taetigkeitSchluessel(name)
    const eintrag = this.bekannt.get(schluessel) ?? { name, symbol: { ...STANDARD_SYMBOL }, unterwegs: an }
    eintrag.unterwegs = an
    this.bekannt.set(schluessel, eintrag)
    const { error } = await supabase()
      .from('taetigkeit')
      .upsert({ name: eintrag.name, schluessel, unterwegs: an, erstellt_von: this.userId }, { onConflict: 'schluessel' })
    if (error) throw new Error('Einordnung konnte nicht gespeichert werden: ' + error.message)
  }

  private async hochladen(name: string, schluessel: string): Promise<void> {
    if (!supabaseKonfiguriert()) return
    try {
      await supabase()
        .from('taetigkeit')
        .upsert({ name, schluessel, erstellt_von: this.userId }, { onConflict: 'schluessel', ignoreDuplicates: true })
    } catch {
      // Wird beim nächsten Laden nachgeholt, sobald jemand den Namen wieder benutzt.
    }
  }
}
