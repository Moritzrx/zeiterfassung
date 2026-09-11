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
  kunde?: string | null
  bewertung: Block['bewertung']
  notiz: string | null
  manuell_geprueft: boolean
  geraet: string | null
  geaendert_am?: string
  geloescht_am: string | null
  testdaten?: boolean
}

/**
 * Ob die Datenbank die Spalte "kunde" schon kennt (Skript 14). Solange nicht, wird sie beim Senden weggelassen,
 * sonst scheiterte JEDER Abgleich mit "column kunde does not exist" (11. September 2026). Der Anfangsabgleich prüft es.
 */
let spalteKunde = true

function zuZeile(b: Block): Zeile {
  const zeile: Zeile = {
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
  if (spalteKunde) zeile.kunde = b.kunde
  return zeile
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
    kunde: z.kunde ?? null,
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

  /** Erfüllt, sobald der erste Abgleich nach dem Start durch ist (auch wenn er scheiterte). */
  erstAbgleich: Promise<void> = Promise.resolve()

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.lauf(), TAKT_MS)
    this.erstAbgleich = this.anfangsAbgleich().then(() => this.lauf())
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
      const ausstehende = this.speicher.ausstehende()
      // Blöcke ohne Dauer (Ende = Anfang) werden nie gesendet; sie blieben sonst für immer als "wartend" stehen
      // (Diagnose "wartend 2" am 11. September 2026). Ändern sie sich noch, kommen sie über aktualisieren() zurück.
      const leere = ausstehende.filter((b) => Date.parse(b.ende) <= Date.parse(b.start))
      if (leere.length > 0) {
        this.speicher.alsGesendet(
          leere.map((b) => b.id),
          new Map(leere.map((b) => [b.id, b.geaendertAm]))
        )
      }
      const kandidaten = ausstehende.filter((b) => {
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

  /** Steht die Spalte "kunde" schon in der Datenbank? Für den Hinweis in den Einstellungen. */
  kundeSpalteVorhanden(): boolean {
    return spalteKunde
  }

  async anfangsAbgleich(): Promise<void> {
    if (!supabaseKonfiguriert()) return
    try {
      // Skript 14 gelaufen? Sonst die Spalte "kunde" beim Senden weglassen.
      const probe = await supabase().from('block').select('kunde').eq('user_id', this.userId).limit(1)
      spalteKunde = !probe.error
      if (probe.error) console.warn('Sync: Spalte "kunde" fehlt noch (Skript 14), Kunden werden bis dahin nur lokal gespeichert.')
    } catch {
      spalteKunde = false
    }
    try {
      const von = new Date(Date.now() - WOCHEN_ZURUECK * 7 * 86_400_000).toISOString()
      // Blöcke der letzten Minuten könnten noch unterwegs sein, die werden nicht als verwaist gewertet.
      const bisEnde = new Date(Date.now() - 10 * 60_000).toISOString()
      const bekannt = new Set<string>()
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
        for (const z of zeilen) bekannt.add(z.id)
        uebernommen += this.speicher.vomServerUebernehmen(zeilen.map(vonZeile))
        if (zeilen.length < SEITE) break
        ab += SEITE
      }
      const entfernt = this.speicher.verwaisteEntfernen(bekannt, von, bisEnde)
      if (uebernommen) console.log(`Sync: ${uebernommen} Blöcke aus der Datenbank übernommen`)
      if (entfernt) console.log(`Sync: ${entfernt} Blöcke lokal entfernt, die die Datenbank nicht mehr kennt`)
      if (uebernommen || entfernt) this.nachAbgleich(uebernommen + entfernt)
      this.fehler = null
    } catch (e) {
      this.fehler = e instanceof Error ? e.message : String(e)
    }
  }
}
