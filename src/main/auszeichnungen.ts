import { auszeichnungenPruefen } from '@shared/auszeichnungen'
import type { Auszeichnung, AuszeichnungTyp, Block, Ziel } from '@shared/typen'
import { supabase, supabaseKonfiguriert } from './supabase'

interface Zeile {
  typ: AuszeichnungTyp
  woche_start: string
  freigeschaltet_am: string
  testdaten: boolean
}

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

  /** Prüft und speichert neue Auszeichnungen. Liefert nur die, die gerade dazugekommen sind. */
  async pruefenUndSpeichern(bloecke: Block[], ziele: Ziel[], jetzt: Date): Promise<Auszeichnung[]> {
    if (!this.geladen && !(await this.laden())) return []
    const neue = auszeichnungenPruefen(bloecke, ziele, this.liste, jetzt)
    const gespeichert: Auszeichnung[] = []
    for (const n of neue) {
      const { data, error } = await supabase()
        .from('auszeichnung')
        .insert({ user_id: this.userId, typ: n.typ, woche_start: n.wocheStart, testdaten: n.testdaten })
        .select('typ, woche_start, freigeschaltet_am, testdaten')
        .single()
      if (error) {
        // Doppelt (z. B. von einem anderen Gerät): dann einfach neu laden.
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
