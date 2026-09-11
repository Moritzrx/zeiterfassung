import type { Block } from '@shared/typen'
import { taetigkeitSchluessel } from '@shared/regeln'
import { supabase, supabaseKonfiguriert } from './supabase'

/**
 * Kunden (oder Projekte) als zweite Dimension neben der Tätigkeit (11. September 2026, Wunsch des Auftraggebers:
 * "für wen" ist in einer Agentur oft wichtiger als "was"). Gleiche Mechanik wie die Tätigkeiten: gemeinsame Liste
 * für das Team in der Tabelle `kunde`, Schreibweisen werden über den Schlüssel (ohne Groß/Klein, Leerzeichen,
 * Bindestriche) vereinheitlicht, neue Namen werden hochgeladen, die eigenen Blöcke füllen die Liste offline.
 */
export class Kunden {
  private readonly bekannt = new Map<string, string>()

  constructor(private readonly userId: string) {}

  /** Bereinigt einen Namen und übernimmt eine schon bekannte Schreibweise; leer bleibt leer. */
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
      if (!b.kunde) continue
      const schluessel = taetigkeitSchluessel(b.kunde)
      if (!this.bekannt.has(schluessel)) this.bekannt.set(schluessel, b.kunde)
    }
  }

  async laden(): Promise<void> {
    if (!supabaseKonfiguriert()) return
    try {
      const { data } = await supabase().from('kunde').select('name, schluessel')
      for (const z of (data ?? []) as Array<{ name: string; schluessel: string }>) this.bekannt.set(z.schluessel, z.name)
    } catch {
      // Offline oder Tabelle noch nicht angelegt (Skript 14): die lokal bekannten Namen reichen vorerst.
    }
  }

  private async hochladen(name: string, schluessel: string): Promise<void> {
    if (!supabaseKonfiguriert()) return
    try {
      await supabase().from('kunde').upsert({ name, schluessel, erstellt_von: this.userId }, { onConflict: 'schluessel', ignoreDuplicates: true })
    } catch {
      // Wird beim nächsten Laden nachgeholt, sobald jemand den Namen wieder benutzt.
    }
  }
}
