import { LEERER_KONTEXT, auszeichnungenPruefen, type AuszeichnungsKontext } from '@shared/auszeichnungen'
import type { Auszeichnung, AuszeichnungTyp, Block, TeamWoche, Ziel } from '@shared/typen'
import { berlinDatum, datumVerschieben, wochenanfang } from '@shared/zeit'
import { supabase, supabaseKonfiguriert } from './supabase'

interface Zeile {
  typ: AuszeichnungTyp
  woche_start: string
  freigeschaltet_am: string
  testdaten: boolean
}

/** Wie viele Wochen zurück die Team-Wochen für Wochensieger, Dauersieger und Team-Woche geholt werden. */
const TEAM_WOCHEN_ZURUECK = 13

/** Die eigenen Auszeichnungen aus der Datenbank, plus die Prüfung auf neue. */
export class Auszeichnungen {
  liste: Auszeichnung[] = []
  private geladen = false

  constructor(private readonly userId: string) {}

  async laden(): Promise<boolean> {
    if (!supabaseKonfiguriert()) return false
    try {
      const { data, error } = await supabase()
        .from('auszeichnung')
        .select('typ, woche_start, freigeschaltet_am, testdaten')
        .eq('user_id', this.userId)
      if (error) throw new Error(error.message)
      this.liste = ((data ?? []) as Zeile[]).map((z) => ({
        typ: z.typ,
        wocheStart: z.woche_start,
        freigeschaltetAm: new Date(z.freigeschaltet_am).toISOString(),
        testdaten: z.testdaten
      }))
      this.geladen = true
      return true
    } catch {
      return false
    }
  }

  /**
   * Holt aus der Datenbank, was die Prüfung über die eigenen Blöcke hinaus braucht:
   * produktive Stunden seit dem Start (Funktion produktiv_gesamt aus Skript 13), den eigenen
   * Trophäenstand (liga_stand), die Wochenstunden aller (team_wochen) und alle Wochenziele.
   * Jeder Teil darf fehlen (z. B. Skript noch nicht ausgeführt), dann fallen nur die
   * betroffenen Auszeichnungen aus.
   */
  private async kontextLaden(jetzt: Date): Promise<AuszeichnungsKontext> {
    const k: AuszeichnungsKontext = { ...LEERER_KONTEXT, eigeneUserId: this.userId }
    try {
      const { data, error } = await supabase().rpc('produktiv_gesamt')
      if (!error && data !== null && data !== undefined) k.gesamtProduktiv = Number(data)
    } catch {
      /* Skript 13 fehlt oder keine Verbindung */
    }
    try {
      const { data, error } = await supabase().rpc('liga_stand')
      if (!error) {
        const ich = ((data ?? []) as Array<{ user_id: string; trophaeen: number | string }>).find((z) => z.user_id === this.userId)
        if (ich) k.trophaeen = Number(ich.trophaeen)
      }
    } catch {
      /* keine Liga-Daten */
    }
    try {
      const laufende = berlinDatum(wochenanfang(jetzt))
      const von = datumVerschieben(laufende, -7 * TEAM_WOCHEN_ZURUECK)
      const { data, error } = await supabase().rpc('team_wochen', { von, bis: laufende })
      if (!error) {
        k.teamWochen = ((data ?? []) as Array<{ user_id: string; name: string; woche_start: string; produktive_sekunden: number | string }>).map(
          (z): TeamWoche => ({ userId: z.user_id, name: z.name, wocheStart: z.woche_start, produktiveSekunden: Number(z.produktive_sekunden) })
        )
      }
    } catch {
      /* keine Team-Daten */
    }
    try {
      const { data, error } = await supabase().from('ziel').select('id, user_id, taetigkeit, stunden_pro_woche')
      if (!error) {
        k.teamZiele = ((data ?? []) as Array<{ id: string; user_id: string; taetigkeit: string | null; stunden_pro_woche: number | string }>).map(
          (z): Ziel => ({ id: z.id, userId: z.user_id, taetigkeit: z.taetigkeit, stundenProWoche: Number(z.stunden_pro_woche) })
        )
      }
    } catch {
      /* keine Ziele */
    }
    return k
  }

  /** Prüft und speichert neue Auszeichnungen. Liefert nur die, die gerade dazugekommen sind. */
  async pruefenUndSpeichern(bloecke: Block[], ziele: Ziel[], jetzt: Date): Promise<Auszeichnung[]> {
    if (!this.geladen && !(await this.laden())) return []
    const kontext = await this.kontextLaden(jetzt)
    const neue = auszeichnungenPruefen(bloecke, ziele, this.liste, jetzt, kontext)
    const gespeichert: Auszeichnung[] = []
    for (const n of neue) {
      const { data, error } = await supabase()
        .from('auszeichnung')
        .insert({ user_id: this.userId, typ: n.typ, woche_start: n.wocheStart, testdaten: n.testdaten })
        .select('typ, woche_start, freigeschaltet_am, testdaten')
        .single()
      if (error) {
        // Doppelt (z. B. von einem anderen Gerät) oder Typ in der Datenbank noch nicht erlaubt (Skript 13): neu laden.
        await this.laden()
        continue
      }
      const z = data as Zeile
      const a: Auszeichnung = {
        typ: z.typ,
        wocheStart: z.woche_start,
        freigeschaltetAm: new Date(z.freigeschaltet_am).toISOString(),
        testdaten: z.testdaten
      }
      this.liste.push(a)
      gespeichert.push(a)
    }
    return gespeichert
  }
}
