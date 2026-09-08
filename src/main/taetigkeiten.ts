import type { Block } from '@shared/typen'
import { taetigkeitSchluessel } from '@shared/regeln'
import { supabase, supabaseKonfiguriert } from './supabase'

/**
 * Alle bekannten Tätigkeitsnamen des Teams: aus der Tabelle taetigkeit, den
 * Zielen und den eigenen Blöcken. Sorgt dafür, dass "ki learning" zur
 * vorhandenen Schreibweise "KI Learning" wird.
 */
export class Taetigkeiten {
  private readonly bekannt = new Map<string, string>()

  constructor(private readonly userId: string) {}

  /** Bereinigt einen Namen und übernimmt eine schon bekannte Schreibweise. */
  merken(name: string): string {
    const bereinigt = name.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!bereinigt) return bereinigt
    const schluessel = taetigkeitSchluessel(bereinigt)
    const vorhanden = this.bekannt.get(schluessel)
    if (vorhanden) return vorhanden
    this.bekannt.set(schluessel, bereinigt)
    void this.hochladen(bereinigt, schluessel)
    return bereinigt
  }

  liste(): string[] {
    return [...this.bekannt.values()].sort((a, b) => a.localeCompare(b, 'de'))
  }

  ausBloecken(bloecke: Block[]): void {
    for (const b of bloecke) {
      if (!b.taetigkeit) continue
      const schluessel = taetigkeitSchluessel(b.taetigkeit)
      if (!this.bekannt.has(schluessel)) this.bekannt.set(schluessel, b.taetigkeit)
    }
  }

  async laden(): Promise<void> {
    if (!supabaseKonfiguriert()) return
    try {
      const { data } = await supabase().from('taetigkeit').select('name, schluessel')
      for (const z of (data ?? []) as Array<{ name: string; schluessel: string }>) {
        if (!this.bekannt.has(z.schluessel)) this.bekannt.set(z.schluessel, z.name)
      }
      const { data: ziele } = await supabase().from('ziel').select('taetigkeit')
      for (const z of (ziele ?? []) as Array<{ taetigkeit: string | null }>) {
        if (!z.taetigkeit) continue
        const schluessel = taetigkeitSchluessel(z.taetigkeit)
        if (!this.bekannt.has(schluessel)) this.bekannt.set(schluessel, z.taetigkeit)
      }
    } catch {
      // Offline: die lokal bekannten Namen reichen vorerst.
    }
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
