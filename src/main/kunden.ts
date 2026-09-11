import type { Block } from '@shared/typen'
import { taetigkeitSchluessel } from '@shared/regeln'
import type { Speicher } from './speicher'
import { supabase, supabaseKonfiguriert } from './supabase'

/**
 * Kunden (oder Projekte) als zweite Dimension neben der Tätigkeit (11. September 2026, Wunsch des Auftraggebers:
 * "für wen" ist in einer Agentur oft wichtiger als "was"). Gleiche Mechanik wie die Tätigkeiten: gemeinsame Liste
 * für das Team in der Tabelle `kunde`, Schreibweisen werden über den Schlüssel (ohne Groß/Klein, Leerzeichen,
 * Bindestriche) vereinheitlicht, neue Namen werden hochgeladen, die eigenen Blöcke füllen die Liste offline.
 * Umbenennen, Zusammenlegen und Löschen laufen über die Datenbankfunktionen aus Skript 15, weil sie die Blöcke
 * ALLER Personen anfassen müssen.
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

  /**
   * Benennt einen Kunden um, im ganzen Team (Datenbankfunktion kunde_umbenennen, Skript 15). Trägt ein Kunde den
   * neuen Namen schon, werden beide zusammengelegt. Die eigenen lokalen Blöcke werden sofort mitgezogen, die der
   * anderen holt deren App beim nächsten Abgleich. Liefert die Zahl der geänderten Blöcke in der Datenbank.
   */
  async umbenennen(speicher: Speicher, alt: string, neu: string): Promise<number> {
    const neuBereinigt = neu.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!neuBereinigt) throw new Error('Bitte einen Namen angeben.')
    const altSchluessel = taetigkeitSchluessel(alt)
    const neuSchluessel = taetigkeitSchluessel(neuBereinigt)
    if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
    const { data, error } = await supabase().rpc('kunde_umbenennen', { alt_schluessel: altSchluessel, neuer_name: neuBereinigt })
    if (error) {
      if (/kunde_umbenennen/.test(error.message)) throw new Error('Dafür muss in Supabase einmal das Skript 15 (15_kunde_verwalten.sql) ausgeführt werden.')
      throw new Error('Umbenennen hat nicht geklappt: ' + error.message)
    }
    for (const b of speicher.alle()) {
      if (b.kunde && !b.geloeschtAm && taetigkeitSchluessel(b.kunde) === altSchluessel) {
        b.kunde = neuBereinigt
        speicher.aktualisieren(b)
      }
    }
    this.bekannt.delete(altSchluessel)
    this.bekannt.set(neuSchluessel, neuBereinigt)
    return Number(data ?? 0)
  }

  /** Nimmt einen Kunden aus der Liste und aus allen Blöcken des Teams (Datenbankfunktion kunde_loeschen). */
  async loeschen(speicher: Speicher, name: string): Promise<number> {
    const schluessel = taetigkeitSchluessel(name)
    if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
    const { data, error } = await supabase().rpc('kunde_loeschen', { alt_schluessel: schluessel })
    if (error) {
      if (/kunde_loeschen/.test(error.message)) throw new Error('Dafür muss in Supabase einmal das Skript 15 (15_kunde_verwalten.sql) ausgeführt werden.')
      throw new Error('Löschen hat nicht geklappt: ' + error.message)
    }
    for (const b of speicher.alle()) {
      if (b.kunde && !b.geloeschtAm && taetigkeitSchluessel(b.kunde) === schluessel) {
        b.kunde = null
        speicher.aktualisieren(b)
      }
    }
    this.bekannt.delete(schluessel)
    return Number(data ?? 0)
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
