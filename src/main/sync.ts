import type { Block } from '@shared/typen'
import type { Speicher } from './speicher'
import { supabase, supabaseKonfiguriert } from './supabase'

const TAKT_MS = 60_000
const PAKET = 200
const SEITE = 1000
const WOCHEN_ZURUECK = 13

interface Zeile {
  id: string
  user_id: string
  start: string
  ende: string
  quelle: 'auto' | 'manuell'
  programm: string | null
  programm_roh: string | null
  fenstertitel: string | null
  taetigkeit: string | null
  bewertung: Block['bewertung']
  notiz: string | null
  manuell_geprueft: boolean
  geraet: string | null
  geaendert_am?: string
  geloescht_am: string | null
  testdaten?: boolean
}

function zuZeile(b: Block): Zeile {
  return {
    id: b.id,
    user_id: b.userId,
    start: b.start,
    ende: b.ende,
    quelle: b.quelle,
    programm: b.programm,
    programm_roh: b.programmRoh,
    fenstertitel: b.fenstertitel,
    taetigkeit: b.taetigkeit,
    bewertung: b.bewertung,
    notiz: b.notiz,
    manuell_geprueft: b.manuellGeprueft,
    geraet: b.geraet,
    geloescht_am: b.geloeschtAm
  }
}

function vonZeile(z: Zeile): Block {
  return {
    id: z.id,
    userId: z.user_id,
    start: new Date(z.start).toISOString(),
    ende: new Date(z.ende).toISOString(),
    quelle: z.quelle,
    programm: z.programm,
    programmRoh: z.programm_roh,
    fenstertitel: z.fenstertitel,
    taetigkeit: z.taetigkeit,
    bewertung: z.bewertung,
    notiz: z.notiz,
    manuellGeprueft: z.manuell_geprueft,
    geraet: z.geraet,
    geaendertAm: z.geaendert_am ? new Date(z.geaendert_am).toISOString() : new Date(0).toISOString(),
    geloeschtAm: z.geloescht_am ? new Date(z.geloescht_am).toISOString() : null,
    testdaten: z.testdaten ?? false
  }
}

/**
 * Schickt alle 60 Sekunden die ausstehenden Blöcke an Supabase. Ohne Verbindung
 * bleiben sie lokal liegen und werden später nachgereicht. Beim Start werden die
 * eigenen Blöcke der letzten Wochen aus der Datenbank geholt.
 */
export class Sync {
  letzterSync: Date | null = null
  fehler: string | null = null
  private timer: NodeJS.Timeout | null = null
  private laeuft = false

  constructor(
    private readonly speicher: Speicher,
    private readonly userId: string,
    /** Wird aufgerufen, wenn Blöcke aus der Datenbank übernommen wurden. */
    private readonly nachAbgleich: (anzahl: number) => void = () => {}
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.lauf(), TAKT_MS)
    void this.anfangsAbgleich().then(() => this.lauf())
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async lauf(): Promise<void> {
    if (!supabaseKonfiguriert() || this.laeuft) return
    this.laeuft = true
    try {
      const jetzt = Date.now()
      // Laufende Blöcke erst ab 60 s senden, fertige erst 10 s nach dem Ende:
      // so lange kann die Kurzblock-Regel sie noch mit dem Nachbarn verschmelzen.
      const kandidaten = this.speicher.ausstehende().filter((b) => {
        const s = Date.parse(b.start)
        const e = Date.parse(b.ende)
        return e > s && (e - s >= 60_000 || jetzt - e > 10_000)
      })
      if (kandidaten.length === 0) {
        this.fehler = null
        return
      }
      const stand = new Map(kandidaten.map((b) => [b.id, b.geaendertAm]))
      for (let i = 0; i < kandidaten.length; i += PAKET) {
        const teil = kandidaten.slice(i, i + PAKET)
        const { error } = await supabase().from('block').upsert(teil.map(zuZeile), { onConflict: 'id' })
        if (error) throw new Error(error.message)
        this.speicher.alsGesendet(
          teil.map((b) => b.id),
          stand
        )
      }
      await supabase().from('profile').update({ zuletzt_sync: new Date().toISOString() }).eq('user_id', this.userId)
      this.letzterSync = new Date()
      this.fehler = null
    } catch (e) {
      this.fehler = e instanceof Error ? e.message : String(e)
    } finally {
      this.laeuft = false
    }
  }

  async anfangsAbgleich(): Promise<void> {
    if (!supabaseKonfiguriert()) return
    try {
      const von = new Date(Date.now() - WOCHEN_ZURUECK * 7 * 86_400_000).toISOString()
      let ab = 0
      let uebernommen = 0
      for (;;) {
        const { data, error } = await supabase()
          .from('block')
          .select('*')
          .eq('user_id', this.userId)
          .gte('ende', von)
          .is('geloescht_am', null)
          .order('start', { ascending: true })
          .range(ab, ab + SEITE - 1)
        if (error) throw new Error(error.message)
        const zeilen = (data ?? []) as Zeile[]
        uebernommen += this.speicher.vomServerUebernehmen(zeilen.map(vonZeile))
        if (zeilen.length < SEITE) break
        ab += SEITE
      }
      if (uebernommen) {
        console.log(`Sync: ${uebernommen} Blöcke aus der Datenbank übernommen`)
        this.nachAbgleich(uebernommen)
      }
      this.fehler = null
    } catch (e) {
      this.fehler = e instanceof Error ? e.message : String(e)
    }
  }
}
