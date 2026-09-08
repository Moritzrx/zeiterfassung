import type { Block, SymbolInfo } from '@shared/typen'
import { taetigkeitSchluessel } from '@shared/regeln'
import { supabase, supabaseKonfiguriert } from './supabase'

interface Eintrag {
  name: string
  symbol: SymbolInfo
}

const STANDARD_SYMBOL: SymbolInfo = { typ: 'lucide', name: 'tag' }

/**
 * Alle bekannten Tätigkeitsnamen des Teams mit ihren Symbolen: aus der Tabelle
 * taetigkeit, den Zielen und den eigenen Blöcken. Sorgt dafür, dass
 * "ki learning" zur vorhandenen Schreibweise "KI Learning" wird.
 */
export class Taetigkeiten {
  private readonly bekannt = new Map<string, Eintrag>()

  constructor(private readonly userId: string) {}

  /** Bereinigt einen Namen und übernimmt eine schon bekannte Schreibweise. */
  merken(name: string): string {
    const bereinigt = name.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!bereinigt) return bereinigt
    const schluessel = taetigkeitSchluessel(bereinigt)
    const vorhanden = this.bekannt.get(schluessel)
    if (vorhanden) return vorhanden.name
    this.bekannt.set(schluessel, { name: bereinigt, symbol: { ...STANDARD_SYMBOL } })
    void this.hochladen(bereinigt, schluessel)
    return bereinigt
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

  ausBloecken(bloecke: Block[]): void {
    for (const b of bloecke) {
      if (!b.taetigkeit) continue
      const schluessel = taetigkeitSchluessel(b.taetigkeit)
      if (!this.bekannt.has(schluessel)) this.bekannt.set(schluessel, { name: b.taetigkeit, symbol: { ...STANDARD_SYMBOL } })
    }
  }

  async laden(): Promise<void> {
    if (!supabaseKonfiguriert()) return
    try {
      const { data } = await supabase().from('taetigkeit').select('name, schluessel, symbol_typ, symbol_name')
      for (const z of (data ?? []) as Array<{ name: string; schluessel: string; symbol_typ: 'lucide' | 'marke'; symbol_name: string }>) {
        this.bekannt.set(z.schluessel, { name: z.name, symbol: { typ: z.symbol_typ, name: z.symbol_name } })
      }
      const { data: ziele } = await supabase().from('ziel').select('taetigkeit')
      for (const z of (ziele ?? []) as Array<{ taetigkeit: string | null }>) {
        if (!z.taetigkeit) continue
        const schluessel = taetigkeitSchluessel(z.taetigkeit)
        if (!this.bekannt.has(schluessel)) this.bekannt.set(schluessel, { name: z.taetigkeit, symbol: { ...STANDARD_SYMBOL } })
      }
    } catch {
      // Offline: die lokal bekannten Namen reichen vorerst.
    }
  }

  /** Symbol einer Tätigkeit für das ganze Team setzen. */
  async symbolSetzen(name: string, symbol: SymbolInfo): Promise<void> {
    const schluessel = taetigkeitSchluessel(name)
    const eintrag = this.bekannt.get(schluessel) ?? { name, symbol }
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
