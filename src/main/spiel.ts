import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import {
  BOSS_FAKTOR_START,
  PUNKTE,
  STREAK_MEILENSTEINE,
  STREAK_STUNDEN,
  belohnungenBisLevel,
  bossFaktorDanach,
  bossFuerWoche,
  bossHpSekunden,
  naechsteBelohnung,
  produktivAmTag,
  questsBewerten,
  seasonLevel,
  seasonVon,
  streakBerechnen,
  tagesQuests,
  wochenIndex,
  type Belohnung,
  type BossHalleEintrag,
  type BossStand,
  type Duell,
  type DuellArt,
  type Ereignis,
  type EreignisTyp,
  type Kosmetik,
  type NeuesDuell,
  type SeasonPerson,
  type SeasonStand,
  type SpielEreignis
} from '@shared/spiel'
import { STANDARD_GESAMTZIEL } from '@shared/rang'
import type { Ziel } from '@shared/typen'
import { berlinDatum, datumVerschieben, datumZuTagesanfang, wochenanfang } from '@shared/zeit'
import type { Speicher } from './speicher'
import type { Ziele } from './ziele'
import { supabase, supabaseKonfiguriert } from './supabase'

/*
 * Team-Spiel im Hauptprozess (22. September 2026): wertet Quests, Streak, Boss und Duelle aus den eigenen Blöcken und
 * der Datenbank aus, schreibt Season-Punkte (je Quelle und Schlüssel genau einmal) und Ereignisse in den Feed.
 * Tabellen aus Skript 21. Fehlt das Skript, laufen alle Aufrufe leer und `fehler` sagt es dem Fenster.
 */

const SKRIPT_HINWEIS = 'Dafür muss in Supabase einmal das Skript 21 (21_team_spiel.sql) ausgeführt werden.'

interface PunktZeile {
  quelle: string
  schluessel: string
  punkte: number
  datum: string
}

interface ProfilZeile {
  user_id: string
  name: string
  aktiv: boolean
  titel?: string | null
  rahmen?: string | null
}

interface BossZeile {
  woche_start: string
  schluessel: string
  name: string
  hp_sekunden: number | string
  faktor: number | string
  besiegt: boolean | null
  ergebnis_sekunden: number | string | null
}

interface DuellZeile {
  id: string
  von_user: string
  an_user: string
  art: DuellArt
  taetigkeit: string | null
  kunde?: string | null
  ziel_stunden?: number | string | null
  beschreibung?: string | null
  von: string
  bis: string
  einsatz: string
  status: Duell['status']
  gewinner: string | null
  unentschieden: boolean
  von_wert: number | string | null
  an_wert: number | string | null
  eingeloest_am: string | null
  erstellt_am: string
}

interface Lokal {
  hintergrund: string | null
  /** Kennungen von Duell-Anfragen, die schon gemeldet wurden */
  gemeldeteDuelle: string[]
  /** Kennungen eigener Herausforderungen, deren Annahme schon gefeiert wurde */
  gefeierteAnnahmen?: string[]
}

export class Spiel {
  private punkte = new Map<string, PunktZeile>()
  private punkteSeason = ''
  private profile: ProfilZeile[] = []
  private lokal: Lokal = { hintergrund: null, gemeldeteDuelle: [] }
  private readonly pfad: string
  private laeuft = false
  fehler: string | null = null

  constructor(
    private readonly userId: string,
    private readonly speicher: Speicher,
    private readonly ziele: Ziele,
    private readonly melden: (ereignisse: SpielEreignis[]) => void
  ) {
    this.pfad = join(app.getPath('userData'), `spiel-${userId}.json`)
    try {
      if (existsSync(this.pfad)) this.lokal = { ...this.lokal, ...(JSON.parse(readFileSync(this.pfad, 'utf8')) as Lokal) }
    } catch {
      /* Neustart bei null ist unkritisch */
    }
  }

  private lokalSpeichern(): void {
    try {
      mkdirSync(dirname(this.pfad), { recursive: true })
      writeFileSync(this.pfad, JSON.stringify(this.lokal))
    } catch {
      /* nur Komfort */
    }
  }

  private eigenerName(): string {
    return this.profile.find((p) => p.user_id === this.userId)?.name ?? 'Ich'
  }

  private nameVon(userId: string): string {
    return this.profile.find((p) => p.user_id === userId)?.name ?? 'Jemand'
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Laden
  // -------------------------------------------------------------------------------------------------------------------

  async laden(jetzt = new Date()): Promise<void> {
    if (!supabaseKonfiguriert()) return
    const season = seasonVon(berlinDatum(jetzt))
    try {
      const { data, error } = await supabase()
        .from('profile')
        .select('user_id, name, aktiv, titel, rahmen')
      if (error) {
        // Ohne die neuen Spalten (Skript 21) wenigstens die Namen.
        const alt = await supabase().from('profile').select('user_id, name, aktiv')
        if (alt.error) throw new Error(alt.error.message)
        this.profile = (alt.data ?? []) as ProfilZeile[]
      } else this.profile = (data ?? []) as ProfilZeile[]
    } catch (fehler) {
      console.warn('Spiel: Profile nicht geladen:', fehler instanceof Error ? fehler.message : fehler)
    }
    try {
      const { data, error } = await supabase()
        .from('season_punkt')
        .select('quelle, schluessel, punkte, datum')
        .eq('user_id', this.userId)
        .eq('season_start', season.start)
      if (error) throw new Error(error.message)
      this.punkte = new Map()
      for (const z of (data ?? []) as PunktZeile[]) this.punkte.set(`${z.quelle}:${z.schluessel}`, z)
      this.punkteSeason = season.start
      this.fehler = null
    } catch (fehler) {
      const text = fehler instanceof Error ? fehler.message : String(fehler)
      this.fehler = /season_punkt|does not exist|schema cache/i.test(text) ? SKRIPT_HINWEIS : text
      console.warn('Spiel: Punkte nicht geladen:', text)
    }
  }

  private punkteSumme(): number {
    let summe = 0
    for (const z of this.punkte.values()) summe += z.punkte
    return summe
  }

  private punkteHeute(heute: string): number {
    let summe = 0
    for (const z of this.punkte.values()) if (z.datum === heute) summe += z.punkte
    return summe
  }

  /** Punkte genau einmal vergeben; liefert true, wenn sie neu waren. */
  private async vergeben(quelle: string, schluessel: string, punkte: number, text: string, datum: string): Promise<boolean> {
    const key = `${quelle}:${schluessel}`
    if (this.punkte.has(key)) return false
    if (!supabaseKonfiguriert() || this.fehler === SKRIPT_HINWEIS) return false
    const season = seasonVon(datum)
    try {
      const { error } = await supabase()
        .from('season_punkt')
        .upsert(
          { user_id: this.userId, season_start: season.start, datum, quelle, schluessel, punkte, text },
          { onConflict: 'user_id,quelle,schluessel', ignoreDuplicates: true }
        )
      if (error) throw new Error(error.message)
      this.punkte.set(key, { quelle, schluessel, punkte, datum })
      return true
    } catch (fehler) {
      console.warn('Spiel: Punkte nicht gespeichert:', fehler instanceof Error ? fehler.message : fehler)
      return false
    }
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Feed
  // -------------------------------------------------------------------------------------------------------------------

  /** Ereignis in den Team-Feed; mit Schlüssel höchstens einmal (auch wenn mehrere Rechner es sehen). */
  async posten(typ: EreignisTyp, text: string, schluessel: string | null = null): Promise<boolean> {
    if (!supabaseKonfiguriert()) return false
    try {
      const { error } = await supabase().from('ereignis').insert({ user_id: this.userId, typ, text, schluessel })
      if (error) {
        if (error.code === '23505') return false // gab es schon
        throw new Error(error.message)
      }
      return true
    } catch (fehler) {
      console.warn('Spiel: Feed-Eintrag nicht gespeichert:', fehler instanceof Error ? fehler.message : fehler)
      return false
    }
  }

  async feed(anzahl = 40): Promise<Ereignis[]> {
    if (!supabaseKonfiguriert()) return []
    const { data, error } = await supabase()
      .from('ereignis')
      .select('id, user_id, typ, text, erstellt_am')
      .order('erstellt_am', { ascending: false })
      .limit(anzahl)
    if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? SKRIPT_HINWEIS : error.message)
    const zeilen = (data ?? []) as Array<{ id: string; user_id: string; typ: EreignisTyp; text: string; erstellt_am: string }>
    const ids = zeilen.map((z) => z.id)
    const reaktionen = new Map<string, Array<{ emoji: string; user_id: string }>>()
    if (ids.length) {
      const r = await supabase().from('reaktion').select('ereignis_id, user_id, emoji').in('ereignis_id', ids)
      if (!r.error) {
        for (const z of (r.data ?? []) as Array<{ ereignis_id: string; user_id: string; emoji: string }>) {
          const liste = reaktionen.get(z.ereignis_id) ?? []
          liste.push({ emoji: z.emoji, user_id: z.user_id })
          reaktionen.set(z.ereignis_id, liste)
        }
      }
    }
    return zeilen.map((z) => {
      const eigene = reaktionen.get(z.id) ?? []
      const jeEmoji = new Map<string, { anzahl: number; meine: boolean }>()
      for (const r of eigene) {
        const e = jeEmoji.get(r.emoji) ?? { anzahl: 0, meine: false }
        e.anzahl++
        if (r.user_id === this.userId) e.meine = true
        jeEmoji.set(r.emoji, e)
      }
      return {
        id: z.id,
        userId: z.user_id,
        name: this.nameVon(z.user_id),
        typ: z.typ,
        text: z.text,
        erstelltAm: new Date(z.erstellt_am).toISOString(),
        reaktionen: [...jeEmoji.entries()].map(([emoji, e]) => ({ emoji, anzahl: e.anzahl, meine: e.meine }))
      }
    })
  }

  /** Reaktion setzen oder wieder wegnehmen. */
  async reagieren(ereignisId: string, emoji: string): Promise<void> {
    const vorhanden = await supabase()
      .from('reaktion')
      .select('emoji')
      .eq('ereignis_id', ereignisId)
      .eq('user_id', this.userId)
      .eq('emoji', emoji)
      .maybeSingle()
    if (vorhanden.data) {
      const { error } = await supabase().from('reaktion').delete().eq('ereignis_id', ereignisId).eq('user_id', this.userId).eq('emoji', emoji)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase().from('reaktion').insert({ ereignis_id: ereignisId, user_id: this.userId, emoji })
      if (error) throw new Error(error.message)
    }
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Boss der Woche
  // -------------------------------------------------------------------------------------------------------------------

  private zielSummeStunden(): number {
    const ziele: Ziel[] = this.ziele.alle()
    const aktive = this.profile.filter((p) => p.aktiv)
    if (!aktive.length) return STANDARD_GESAMTZIEL * 3
    let summe = 0
    for (const p of aktive) {
      const ziel = ziele.find((z) => z.userId === p.user_id && z.taetigkeit === null)
      summe += ziel ? ziel.stundenProWoche : STANDARD_GESAMTZIEL
    }
    return summe
  }

  /** Die Boss-Zeile der Woche holen, notfalls anlegen (wer zuerst kommt, legt an; Duplikate werden ignoriert). */
  private async bossZeile(wocheStart: string): Promise<BossZeile | null> {
    const lesen = async (): Promise<BossZeile | null> => {
      const { data, error } = await supabase().from('boss').select('*').eq('woche_start', wocheStart).maybeSingle()
      if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? SKRIPT_HINWEIS : error.message)
      return (data as BossZeile | null) ?? null
    }
    const vorhanden = await lesen()
    if (vorhanden) return vorhanden
    // Faktor aus der Vorwoche ableiten.
    const vorwoche = await supabase().from('boss').select('*').eq('woche_start', datumVerschieben(wocheStart, -7)).maybeSingle()
    const vorher = (vorwoche.data as BossZeile | null) ?? null
    const faktor = vorher ? bossFaktorDanach(Number(vorher.faktor), vorher.besiegt) : BOSS_FAKTOR_START
    const def = bossFuerWoche(wochenIndex(wocheStart))
    const hp = bossHpSekunden(this.zielSummeStunden(), faktor)
    const { error } = await supabase()
      .from('boss')
      .upsert({ woche_start: wocheStart, schluessel: def.schluessel, name: def.name, hp_sekunden: hp, faktor }, { onConflict: 'woche_start', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
    return lesen()
  }

  private async teamWochenSekunden(wocheStart: string): Promise<Map<string, number>> {
    const ergebnis = new Map<string, number>()
    const { data, error } = await supabase().rpc('team_wochen', { von: wocheStart, bis: wocheStart })
    if (error) throw new Error(error.message)
    for (const z of (data ?? []) as Array<{ user_id: string; produktive_sekunden: number | string }>) ergebnis.set(z.user_id, Number(z.produktive_sekunden))
    return ergebnis
  }

  /** Stand des laufenden Bosses; schließt nebenbei alte offene Bosse ab und meldet Siege. */
  async boss(jetzt = new Date()): Promise<BossStand> {
    if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
    const wocheStart = berlinDatum(wochenanfang(jetzt))
    const zeile = await this.bossZeile(wocheStart)
    if (!zeile) throw new Error('Boss konnte nicht angelegt werden.')
    const sekunden = await this.teamWochenSekunden(wocheStart)
    // Eigene Zahl live vom Rechner, die der anderen aus der Datenbank.
    sekunden.set(this.userId, this.speicher.produktiveSekunden(wochenanfang(jetzt), jetzt))
    const anteile = this.profile
      .filter((p) => p.aktiv)
      .map((p) => ({ userId: p.user_id, name: p.name, sekunden: Math.round(sekunden.get(p.user_id) ?? 0), istIch: p.user_id === this.userId }))
      .sort((a, b) => b.sekunden - a.sekunden)
    const schaden = anteile.reduce((s, a) => s + a.sekunden, 0)
    const hp = Number(zeile.hp_sekunden)
    let besiegt = zeile.besiegt
    if (besiegt === null && schaden >= hp) {
      const { error } = await supabase()
        .from('boss')
        .update({ besiegt: true, ergebnis_sekunden: schaden, geaendert_am: new Date().toISOString() })
        .eq('woche_start', wocheStart)
        .is('besiegt', null)
      if (!error) {
        besiegt = true
        void this.posten('boss', `${zeile.name} ist gefallen! Das Team hat ${Math.round(schaden / 360) / 10} Stunden Schaden gemacht.`, `boss:${wocheStart}`)
      }
    }
    // Zwischenstände in den Feed (wer es zuerst sieht, postet; der Schlüssel verhindert Doppelte).
    for (const stufe of [25, 50, 75]) {
      if (besiegt === null && schaden >= (hp * stufe) / 100) {
        void this.posten('boss-schaden', `${zeile.name} hat nur noch ${100 - stufe} % Leben. Weiter so!`, `boss:${wocheStart}:${stufe}`)
      }
    }
    const def = bossFuerWoche(wochenIndex(wocheStart))
    const halle = await this.bossHalle(jetzt)
    return {
      wocheStart,
      schluessel: zeile.schluessel,
      name: zeile.name,
      spruch: def.schluessel === zeile.schluessel ? def.spruch : '',
      hpSekunden: hp,
      schadenSekunden: schaden,
      faktor: Number(zeile.faktor),
      anteile,
      besiegt,
      siege: halle.filter((h) => h.besiegt).length,
      niederlagen: halle.filter((h) => !h.besiegt).length
    }
  }

  /** Alle abgeschlossenen Bosse; offene Vorwochen werden hier abgerechnet. */
  async bossHalle(jetzt = new Date()): Promise<BossHalleEintrag[]> {
    if (!supabaseKonfiguriert()) return []
    const laufende = berlinDatum(wochenanfang(jetzt))
    const { data, error } = await supabase().from('boss').select('*').lt('woche_start', laufende).order('woche_start', { ascending: false })
    if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? SKRIPT_HINWEIS : error.message)
    const zeilen = (data ?? []) as BossZeile[]
    const ergebnis: BossHalleEintrag[] = []
    for (const z of zeilen) {
      let besiegt = z.besiegt
      let ergebnisSekunden = Number(z.ergebnis_sekunden ?? 0)
      if (besiegt === null) {
        try {
          const sekunden = await this.teamWochenSekunden(z.woche_start)
          ergebnisSekunden = [...sekunden.values()].reduce((s, v) => s + v, 0)
          besiegt = ergebnisSekunden >= Number(z.hp_sekunden)
          await supabase()
            .from('boss')
            .update({ besiegt, ergebnis_sekunden: Math.round(ergebnisSekunden), geaendert_am: new Date().toISOString() })
            .eq('woche_start', z.woche_start)
            .is('besiegt', null)
          if (besiegt) void this.posten('boss', `${z.name} ist gefallen! Das Team hat ${Math.round(ergebnisSekunden / 360) / 10} Stunden Schaden gemacht.`, `boss:${z.woche_start}`)
          else void this.posten('boss', `${z.name} hat die Woche überlebt (${Math.round(ergebnisSekunden / 360) / 10} von ${Math.round(Number(z.hp_sekunden) / 360) / 10} Stunden). Nächste Woche wird er schwächer.`, `boss:${z.woche_start}:ueberlebt`)
        } catch {
          continue
        }
      }
      ergebnis.push({ wocheStart: z.woche_start, schluessel: z.schluessel, name: z.name, hpSekunden: Number(z.hp_sekunden), ergebnisSekunden, besiegt: !!besiegt })
    }
    return ergebnis
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Duelle
  // -------------------------------------------------------------------------------------------------------------------

  private duellVonZeile(z: DuellZeile): Duell {
    return {
      id: z.id,
      vonUser: z.von_user,
      vonName: this.nameVon(z.von_user),
      anUser: z.an_user,
      anName: this.nameVon(z.an_user),
      art: z.art,
      taetigkeit: z.taetigkeit,
      kunde: z.kunde ?? null,
      zielStunden: z.ziel_stunden === null || z.ziel_stunden === undefined ? null : Number(z.ziel_stunden),
      beschreibung: z.beschreibung ?? null,
      von: new Date(z.von).toISOString(),
      bis: new Date(z.bis).toISOString(),
      einsatz: z.einsatz,
      status: z.status,
      gewinner: z.gewinner,
      unentschieden: z.unentschieden,
      vonWert: z.von_wert === null ? null : Number(z.von_wert),
      anWert: z.an_wert === null ? null : Number(z.an_wert),
      eingeloestAm: z.eingeloest_am ? new Date(z.eingeloest_am).toISOString() : null,
      erstelltAm: new Date(z.erstellt_am).toISOString()
    }
  }

  async duelle(): Promise<Duell[]> {
    if (!supabaseKonfiguriert()) return []
    const { data, error } = await supabase().from('duell').select('*').order('erstellt_am', { ascending: false }).limit(40)
    if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? SKRIPT_HINWEIS : error.message)
    const zeilen = (data ?? []) as DuellZeile[]
    // Laufende Duelle bekommen ihren aktuellen Stand mit.
    const ergebnis: Duell[] = []
    for (const z of zeilen) {
      const d = this.duellVonZeile(z)
      if (d.status === 'angenommen') {
        try {
          const stand = await this.duellStand(d.id)
          d.vonWert = stand.get(d.vonUser) ?? null
          d.anWert = stand.get(d.anUser) ?? null
        } catch {
          /* Stand bleibt leer */
        }
      }
      ergebnis.push(d)
    }
    return ergebnis
  }

  private async duellStand(id: string): Promise<Map<string, number | null>> {
    const { data, error } = await supabase().rpc('duell_stand', { duell_id: id })
    if (error) throw new Error(error.message)
    const m = new Map<string, number | null>()
    for (const z of (data ?? []) as Array<{ user_id: string; wert: number | string | null }>) m.set(z.user_id, z.wert === null ? null : Number(z.wert))
    return m
  }

  async duellErstellen(neu: NeuesDuell, jetzt = new Date()): Promise<Duell> {
    if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
    if (neu.anUser === this.userId) throw new Error('Gegen dich selbst geht nicht.')
    let von: Date
    let bis: Date
    if (neu.art === 'fruehstart') {
      // Der gewählte Kalendertag (JJJJ-MM-TT), frühestens morgen: heute wäre schon entschieden.
      const tag = /^\d{4}-\d{2}-\d{2}$/.test(neu.bis) ? neu.bis : datumVerschieben(berlinDatum(jetzt), 1)
      if (tag <= berlinDatum(jetzt)) throw new Error('Der Tag muss in der Zukunft liegen, frühestens morgen.')
      von = datumZuTagesanfang(tag)
      bis = datumZuTagesanfang(datumVerschieben(tag, 1))
    } else {
      von = jetzt
      bis = new Date(neu.bis)
      if (!(bis.getTime() > jetzt.getTime() + 5 * 60_000)) throw new Error('Das Ende muss mindestens fünf Minuten in der Zukunft liegen.')
    }
    if (neu.art === 'ziel' && !(neu.zielStunden && neu.zielStunden > 0)) throw new Error('Bitte eine Stundenzahl für den Wettlauf wählen.')
    const zeile: Record<string, unknown> = {
      von_user: this.userId,
      an_user: neu.anUser,
      art: neu.art,
      taetigkeit: neu.art === 'fruehstart' ? null : neu.taetigkeit,
      von: von.toISOString(),
      bis: bis.toISOString(),
      einsatz: neu.einsatz.trim() || 'einen Kaffee'
    }
    // Die Spalten aus Skript 22 nur mitschicken, wenn sie gebraucht werden (sonst scheitert es ohne das Skript).
    if (neu.kunde && neu.art !== 'fruehstart') zeile.kunde = neu.kunde
    if (neu.art === 'ziel') zeile.ziel_stunden = neu.zielStunden
    if (neu.beschreibung?.trim()) zeile.beschreibung = neu.beschreibung.trim()
    const { data, error } = await supabase().from('duell').insert(zeile).select('*').single()
    if (error) {
      if (/kunde|ziel_stunden|beschreibung|duell_art_check|schema cache/i.test(error.message)) throw new Error('Dafür muss in Supabase einmal das Skript 22 (22_duell_genauer.sql) ausgeführt werden.')
      throw new Error(/does not exist/i.test(error.message) ? SKRIPT_HINWEIS : error.message)
    }
    const d = this.duellVonZeile(data as DuellZeile)
    void this.posten('duell', `${this.eigenerName()} fordert ${d.anName} heraus: ${this.duellText(d)}. Einsatz: ${d.einsatz}.`, `duell:${d.id}:neu`)
    return d
  }

  /** "worum es geht" in einem Satzteil, für Feed und Einblendung. */
  duellText(d: Duell): string {
    const filter = [d.taetigkeit ? `in „${d.taetigkeit}“` : '', d.kunde ? `für ${d.kunde}` : ''].filter(Boolean).join(' ')
    const zusatz = d.beschreibung ? ` (${d.beschreibung})` : ''
    if (d.art === 'fruehstart') return `wer am ${this.tagText(d.von)} früher am Start ist${zusatz}`
    if (d.art === 'ziel') return `wer zuerst ${d.zielStunden ?? '?'} Stunden ${filter ? filter + ' ' : ''}hat, bis spätestens ${this.zeitText(d.bis)}${zusatz}`
    if (d.art === 'taetigkeit') return `mehr Stunden in „${d.taetigkeit}“ bis ${this.zeitText(d.bis)}${zusatz}`
    return `mehr produktive Stunden ${filter ? filter + ' ' : ''}bis ${this.zeitText(d.bis)}${zusatz}`
  }

  private zeitText(iso: string): string {
    return new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit' })
  }

  private tagText(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' })
  }

  async duellAntworten(id: string, annehmen: boolean): Promise<void> {
    const { data, error } = await supabase()
      .from('duell')
      .update({ status: annehmen ? 'angenommen' : 'abgelehnt', geaendert_am: new Date().toISOString() })
      .eq('id', id)
      .eq('an_user', this.userId)
      .eq('status', 'offen')
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    const d = this.duellVonZeile(data as DuellZeile)
    if (annehmen) void this.posten('duell', `${d.anName} nimmt das Duell gegen ${d.vonName} an. Es geht um ${d.einsatz}!`, `duell:${d.id}:an`)
  }

  async duellEinloesen(id: string): Promise<void> {
    const { error } = await supabase().from('duell').update({ eingeloest_am: new Date().toISOString() }).eq('id', id)
    if (error) throw new Error(error.message)
  }

  /** Abgelaufene, angenommene Duelle abrechnen (jeder Rechner darf das, der Erste gewinnt). */
  private async duelleAbrechnen(jetzt: Date): Promise<SpielEreignis[]> {
    const ereignisse: SpielEreignis[] = []
    const { data, error } = await supabase().from('duell').select('*').in('status', ['angenommen', 'beendet', 'offen']).order('erstellt_am', { ascending: false }).limit(40)
    if (error) return ereignisse
    for (const z of (data ?? []) as DuellZeile[]) {
      const d = this.duellVonZeile(z)
      if (d.status === 'offen' && d.anUser === this.userId && !this.lokal.gemeldeteDuelle.includes(d.id)) {
        this.lokal.gemeldeteDuelle = [...this.lokal.gemeldeteDuelle.slice(-30), d.id]
        this.lokalSpeichern()
        ereignisse.push({
          art: 'duell-anfrage',
          text: `${d.vonName} fordert dich heraus: ${this.duellText(d)}. Einsatz: ${d.einsatz}.`,
          punkte: 0,
          duell: { gegner: d.vonName, worum: this.duellText(d), einsatz: d.einsatz }
        })
        continue
      }
      // Der Herausforderer erfährt hier, dass angenommen wurde (der Angenommene feiert direkt im Fenster).
      if (d.status === 'angenommen' && d.vonUser === this.userId && !(this.lokal.gefeierteAnnahmen ?? []).includes(d.id)) {
        this.lokal.gefeierteAnnahmen = [...(this.lokal.gefeierteAnnahmen ?? []).slice(-30), d.id]
        this.lokalSpeichern()
        ereignisse.push({
          art: 'duell-angenommen',
          text: `${d.anName} nimmt dein Duell an: ${this.duellText(d)}.`,
          punkte: 0,
          duell: { gegner: d.anName, worum: this.duellText(d), einsatz: d.einsatz }
        })
      }
      // Wettlauf: sobald jemand die Marke erreicht, ist es entschieden, sonst am Ende.
      let entscheiden = d.status === 'angenommen' && Date.parse(d.bis) <= jetzt.getTime()
      let standVorab: Map<string, number | null> | null = null
      if (d.status === 'angenommen' && d.art === 'ziel' && d.zielStunden && !entscheiden) {
        try {
          standVorab = await this.duellStand(d.id)
          const marke = d.zielStunden * 3600
          if ((standVorab.get(d.vonUser) ?? 0) >= marke || (standVorab.get(d.anUser) ?? 0) >= marke) entscheiden = true
        } catch {
          /* dann eben später */
        }
      }
      if (entscheiden) {
        try {
          const stand = standVorab ?? (await this.duellStand(d.id))
          const vonWert = stand.get(d.vonUser) ?? null
          const anWert = stand.get(d.anUser) ?? null
          let gewinner: string | null = null
          let unentschieden = false
          if (d.art === 'fruehstart') {
            if (vonWert === null && anWert === null) unentschieden = true
            else if (anWert === null || (vonWert !== null && vonWert < anWert)) gewinner = d.vonUser
            else if (vonWert === null || anWert < vonWert) gewinner = d.anUser
            else unentschieden = true
          } else {
            const a = vonWert ?? 0
            const b = anWert ?? 0
            if (Math.abs(a - b) < 60) unentschieden = true
            else gewinner = a > b ? d.vonUser : d.anUser
          }
          const { error: fehler } = await supabase()
            .from('duell')
            .update({ status: 'beendet', gewinner, unentschieden, von_wert: vonWert, an_wert: anWert, geaendert_am: new Date().toISOString() })
            .eq('id', d.id)
            .eq('status', 'angenommen')
          if (fehler) continue
          d.status = 'beendet'
          d.gewinner = gewinner
          d.unentschieden = unentschieden
          const text = unentschieden
            ? `Unentschieden im Duell ${d.vonName} gegen ${d.anName} (${this.duellText(d)}).`
            : `${this.nameVon(gewinner!)} gewinnt das Duell gegen ${gewinner === d.vonUser ? d.anName : d.vonName} (${this.duellText(d)}). ${
                gewinner === d.vonUser ? d.anName : d.vonName
              } schuldet ${d.einsatz}.`
          void this.posten('duell', text, `duell:${d.id}:ende`)
        } catch {
          continue
        }
      }
      if (d.status === 'beendet' && d.gewinner === this.userId) {
        const gegner = d.gewinner === d.vonUser ? d.anName : d.vonName
        const neu = await this.vergeben('duell', d.id, PUNKTE.duell, `Duell gegen ${gegner} gewonnen`, berlinDatum(jetzt))
        if (neu)
          ereignisse.push({
            art: 'duell',
            text: `Duell gewonnen! ${gegner} schuldet dir ${d.einsatz}.`,
            punkte: PUNKTE.duell,
            duell: { gegner, worum: this.duellText(d), einsatz: d.einsatz }
          })
      }
    }
    return ereignisse
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Auszeichnungen und Ränge aus index.ts
  // -------------------------------------------------------------------------------------------------------------------

  async auszeichnungMelden(typ: string, titel: string, text: string, wocheStart: string, jetzt = new Date()): Promise<void> {
    void this.posten('auszeichnung', `${this.eigenerName()} hat die Medaille „${titel}“ freigeschaltet: ${text}`, `ausz:${this.userId}:${typ}:${wocheStart}`)
    const neu = await this.vergeben('auszeichnung', `${typ}:${wocheStart}`, PUNKTE.auszeichnung, `Medaille „${titel}“`, berlinDatum(jetzt))
    if (neu) this.melden([{ art: 'quest', text: `Medaille „${titel}“`, punkte: PUNKTE.auszeichnung }])
  }

  async rangMelden(rang: number, name: string, wocheStart: string): Promise<void> {
    if (rang % 5 !== 0) return
    void this.posten('rang', `${this.eigenerName()} hat diese Woche Rang ${rang} erreicht: ${name}.`, `rang:${this.userId}:${wocheStart}:${rang}`)
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Die regelmäßige Prüfung: Quests, Streak, Boss-Punkte, Duelle
  // -------------------------------------------------------------------------------------------------------------------

  async pruefen(jetzt = new Date()): Promise<void> {
    if (!supabaseKonfiguriert() || this.laeuft) return
    this.laeuft = true
    try {
      const heute = berlinDatum(jetzt)
      const season = seasonVon(heute)
      if (this.punkteSeason !== season.start || !this.profile.length) await this.laden(jetzt)
      if (this.fehler === SKRIPT_HINWEIS) return
      const levelVorher = seasonLevel(this.punkteSumme())
      const ereignisse: SpielEreignis[] = []
      const bloecke = this.speicher.alle()

      // Quests von heute und gestern (abendliche Quests entscheiden sich erst am Tagesende).
      for (const datum of [datumVerschieben(heute, -1), heute]) {
        const quests = tagesQuests(this.userId, datum)
        const stand = questsBewerten(quests, bloecke, datum, jetzt.getTime())
        for (const q of stand) {
          if (!q.erfuellt) continue
          const neu = await this.vergeben('quest', `${datum}:${q.id}`, q.punkte, `Quest „${q.titel}“`, datum)
          if (neu && datum === heute) ereignisse.push({ art: 'quest', text: `Quest geschafft: ${q.titel}`, punkte: q.punkte })
        }
        if (stand.length === 3 && stand.every((q) => q.erfuellt)) {
          const neu = await this.vergeben('quest-tag', datum, PUNKTE.questTag, 'Alle drei Quests des Tages', datum)
          if (neu) {
            ereignisse.push({ art: 'quest-tag', text: 'Alle drei Quests des Tages geschafft!', punkte: PUNKTE.questTag })
            void this.posten('quests', `${this.eigenerName()} hat alle drei Daily Quests geschafft.`, `quests:${this.userId}:${datum}`)
          }
        }
      }

      // Streak: Tage mit mindestens STREAK_STUNDEN produktiv, Meilensteine mit Bonus.
      const streak = streakBerechnen(bloecke, heute)
      for (const datum of [datumVerschieben(heute, -1), heute]) {
        if (produktivAmTag(bloecke, datum) >= STREAK_STUNDEN * 3600) {
          const neu = await this.vergeben('streak-tag', datum, PUNKTE.streakTag, `${STREAK_STUNDEN} Stunden am Tag`, datum)
          if (neu && datum === heute) ereignisse.push({ art: 'streak', text: `${STREAK_STUNDEN} Stunden heute, Streak ${streak.laenge} ${streak.laenge === 1 ? 'Tag' : 'Tage'}`, punkte: PUNKTE.streakTag })
        }
      }
      if (streak.laenge >= 1) {
        const letzterTag = streak.heuteErreicht ? heute : datumVerschieben(heute, -1)
        const streakStart = datumVerschieben(letzterTag, -(streak.laenge - 1))
        for (const m of STREAK_MEILENSTEINE) {
          if (streak.laenge < m.tage) continue
          const neu = await this.vergeben('streak', `${streakStart}:${m.tage}`, m.punkte, `${m.tage} Tage in Folge`, letzterTag)
          if (neu) {
            ereignisse.push({ art: 'streak', text: `${m.tage} Tage in Folge mit ${STREAK_STUNDEN}+ Stunden!`, punkte: m.punkte })
            void this.posten('streak', `${this.eigenerName()} hat ${m.tage} Tage in Folge mit mindestens ${STREAK_STUNDEN} Stunden geschafft.`, `streak:${this.userId}:${streakStart}:${m.tage}`)
          }
        }
      }

      // Boss: besiegte Bosse dieser und der letzten Woche bringen jedem im Team Punkte.
      try {
        const wocheStart = berlinDatum(wochenanfang(jetzt))
        const { data } = await supabase().from('boss').select('*').in('woche_start', [wocheStart, datumVerschieben(wocheStart, -7)]).eq('besiegt', true)
        for (const z of (data ?? []) as BossZeile[]) {
          const neu = await this.vergeben('boss', z.woche_start, PUNKTE.boss, `Boss „${z.name}“ besiegt`, z.woche_start === wocheStart ? heute : datumVerschieben(wocheStart, -1))
          if (neu)
            ereignisse.push({
              art: 'boss',
              text: `${z.name} ist besiegt!`,
              punkte: PUNKTE.boss,
              boss: { name: z.name, schluessel: z.schluessel, ergebnisSekunden: Number(z.ergebnis_sekunden ?? 0), hpSekunden: Number(z.hp_sekunden) }
            })
        }
      } catch {
        /* Boss-Tabelle fehlt oder keine Verbindung */
      }

      ereignisse.push(...(await this.duelleAbrechnen(jetzt)))

      const levelNachher = seasonLevel(this.punkteSumme())
      if (levelNachher > levelVorher) {
        const belohnung = belohnungenBisLevel(levelNachher).find((b) => b.level > levelVorher) ?? null
        ereignisse.push({ art: 'level', text: `Season-Level ${levelNachher} erreicht`, punkte: 0, level: levelNachher, belohnung })
        if (levelNachher % 5 === 0) void this.posten('season', `${this.eigenerName()} ist jetzt Season-Level ${levelNachher}.`, `season:${this.userId}:${season.start}:${levelNachher}`)
      }
      if (ereignisse.length) this.melden(ereignisse)
    } catch (fehler) {
      console.warn('Spiel: Prüfung fehlgeschlagen:', fehler instanceof Error ? fehler.message : fehler)
    } finally {
      this.laeuft = false
    }
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Stand fürs Fenster und Kosmetik
  // -------------------------------------------------------------------------------------------------------------------

  async stand(jetzt = new Date()): Promise<SeasonStand> {
    const heute = berlinDatum(jetzt)
    const season = seasonVon(heute)
    if (this.punkteSeason !== season.start || !this.profile.length) await this.laden(jetzt)
    if (this.fehler === SKRIPT_HINWEIS) throw new Error(SKRIPT_HINWEIS)
    const bloecke = this.speicher.alle()
    const team: SeasonPerson[] = []
    try {
      const { data, error } = await supabase().from('season_punkt').select('user_id, punkte').eq('season_start', season.start)
      if (error) throw new Error(error.message)
      const summen = new Map<string, number>()
      for (const z of (data ?? []) as Array<{ user_id: string; punkte: number }>) summen.set(z.user_id, (summen.get(z.user_id) ?? 0) + z.punkte)
      for (const p of this.profile.filter((x) => x.aktiv)) {
        const punkte = p.user_id === this.userId ? this.punkteSumme() : (summen.get(p.user_id) ?? 0)
        team.push({ userId: p.user_id, name: p.name, punkte, level: seasonLevel(punkte), istIch: p.user_id === this.userId, titel: p.titel ?? null, rahmen: p.rahmen ?? null })
      }
      team.sort((a, b) => b.punkte - a.punkte)
    } catch {
      /* Teamstand bleibt leer */
    }
    const ich = this.profile.find((p) => p.user_id === this.userId)
    return {
      season,
      punkte: this.punkteSumme(),
      level: seasonLevel(this.punkteSumme()),
      team,
      quests: questsBewerten(tagesQuests(this.userId, heute), bloecke, heute, jetzt.getTime()),
      streak: streakBerechnen(bloecke, heute),
      kosmetik: { titel: ich?.titel ?? null, rahmen: ich?.rahmen ?? null, hintergrund: this.lokal.hintergrund },
      heutePunkte: this.punkteHeute(heute)
    }
  }

  /** Nur freigeschaltete Belohnungen lassen sich wählen; Titel und Rahmen gehen ins Profil, der Hintergrund bleibt lokal. */
  async kosmetikSetzen(k: Partial<Kosmetik>): Promise<Kosmetik> {
    const level = seasonLevel(this.punkteSumme())
    const frei = belohnungenBisLevel(level)
    const erlaubt = (art: Belohnung['art'], schluessel: string | null): boolean => schluessel === null || frei.some((b) => b.art === art && b.schluessel === schluessel)
    if (k.hintergrund !== undefined) {
      if (!erlaubt('hintergrund', k.hintergrund === 'standard' ? null : k.hintergrund)) throw new Error('Dieser Hintergrund ist noch nicht freigeschaltet.')
      this.lokal.hintergrund = k.hintergrund === 'standard' ? null : k.hintergrund
      this.lokalSpeichern()
    }
    const aenderung: Record<string, string | null> = {}
    if (k.titel !== undefined) {
      if (!erlaubt('titel', k.titel)) throw new Error('Dieser Titel ist noch nicht freigeschaltet.')
      aenderung.titel = k.titel
    }
    if (k.rahmen !== undefined) {
      if (!erlaubt('rahmen', k.rahmen)) throw new Error('Dieser Rahmen ist noch nicht freigeschaltet.')
      aenderung.rahmen = k.rahmen
    }
    if (Object.keys(aenderung).length) {
      const { error } = await supabase().from('profile').update(aenderung).eq('user_id', this.userId)
      if (error) throw new Error(/titel|rahmen|schema cache/i.test(error.message) ? SKRIPT_HINWEIS : error.message)
      const ich = this.profile.find((p) => p.user_id === this.userId)
      if (ich) {
        if (aenderung.titel !== undefined) ich.titel = aenderung.titel
        if (aenderung.rahmen !== undefined) ich.rahmen = aenderung.rahmen
      }
    }
    const ich = this.profile.find((p) => p.user_id === this.userId)
    return { titel: ich?.titel ?? null, rahmen: ich?.rahmen ?? null, hintergrund: this.lokal.hintergrund }
  }

  /** Goldenes Tray-Symbol ab Level 10 (Belohnung "tray"). */
  trayGold(): boolean {
    return belohnungenBisLevel(seasonLevel(this.punkteSumme())).some((b) => b.art === 'tray')
  }

  naechsteBelohnung(): Belohnung | null {
    return naechsteBelohnung(seasonLevel(this.punkteSumme()))
  }
}
