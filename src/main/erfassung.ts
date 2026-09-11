import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { hostname } from 'os'
import { join } from 'path'
import { app, powerMonitor, systemPreferences } from 'electron'
import { activeWindow } from 'get-windows'
import type { Abwesenheit, Bewertung, Bildschirmrecht, Block, ErfassungsZustand, Fokus, LaufenderBlock, Weg } from '@shared/typen'
import type { Zuordnung } from '@shared/regeln'
import { naechsterTagesanfang } from '@shared/zeit'
import { istEigenesProgramm, istSchreibtisch, istSystemUeberlagerung, programmNormalisieren } from './programme'
import type { Speicher } from './speicher'

const TAKT_MS = 5_000 // alle 5 Sekunden das aktive Fenster abfragen
const LUECKE_MS = 30_000 // längere Pause zwischen zwei Abfragen = Rechner hat geschlafen
const KURZ_MS = 60_000 // Blöcke darunter werden in den Nachbarblock eingerechnet
const ANSCHLUSS_MS = 5_000 // so nah muss ein Nachbarblock liegen
const MAX_BLOCK_MS = 4 * 3_600_000 // Sicherung: nie länger als 4 Stunden
// Zeit ohne Eingabe (Entscheidung des Auftraggebers vom 10. September 2026):
//   bis ABWESEND_MS ist sie "Nicht am Rechner" und zählt als unproduktiv (rot): Handy, Sofa, lange Pause;
//   dauert die Abwesenheit länger, wird der ganze Block "Abwesend" (Bewertung inaktiv, blau, zählt nicht):
//   Schlafen, Feierabend, langer Termin. Läuft der Rechner wach weiter, endet der blaue Block spätestens
//   nach MAX_INAKTIV_MS; danach wird bis zur nächsten Eingabe nichts mehr aufgezeichnet.
const ABWESEND_MS = 90 * 60_000
const MAX_INAKTIV_MS = 12 * 3_600_000
// Lücken ohne Aufzeichnung (Zuklappen, Sperren, Ruhezustand, App aus) werden beim Weitermachen nachträglich
// gefüllt: unter 90 Minuten rot "Nicht am Rechner", darüber blau "Abwesend" (Auftraggeber, 10. September 2026:
// "sobald der Rechner zugeklappt wird, blau, bis er wieder läuft"). Höchstens so weit zurück.
const LUECKE_MAX_MS = 7 * 24 * 3_600_000
const EIGENES_KURZ_MS = 2 * 60_000 // so lange läuft beim Blick in die eigene App der vorherige Block weiter
// "Ich bin weg" (11. September 2026): eine angekündigte Abwesenheit läuft als produktiver Hand-Block. Als wirklich
// weg gilt man, sobald WEG_ABWESEND_S Sekunden keine Eingabe kam (sonst würde der Klick auf den Knopf selbst als
// Rückkehr zählen); die nächste Eingabe (letzte Eingabe unter WEG_ZURUECK_S Sekunden her) beendet die Abwesenheit
// rückwirkend zum Zeitpunkt der Eingabe. Spätestens nach WEG_MAX_MS oder um Mitternacht ist Schluss.
const WEG_ABWESEND_S = 60
const WEG_ZURUECK_S = 10
const WEG_MAX_MS = 12 * 3_600_000
// Rückfrage nach einer Abwesenheit (11. September 2026, "Abwesenheit ist immer rot"): Nach der Rückkehr fragt die
// App, was das war (Pause, Termin, privat). Nur für Abwesenheiten von der Untätigkeits-Schwelle bis RUECKFRAGE_MAX_MS
// und aus den letzten RUECKFRAGE_FENSTER_MS; "Später" wird SPAETER_MERKEN_MS lang gemerkt.
const RUECKFRAGE_MAX_MS = 3 * 3_600_000
const RUECKFRAGE_FENSTER_MS = 24 * 3_600_000
const SPAETER_MERKEN_MS = 2 * 24 * 3_600_000

/** Stand der macOS-Berechtigung "Bildschirmaufnahme" (für Fenstertitel); unter Windows nicht nötig. */
export function bildschirmrecht(): Bildschirmrecht {
  if (process.platform !== 'darwin') return 'nicht-noetig'
  const stand = systemPreferences.getMediaAccessStatus('screen')
  if (stand === 'granted') return 'erteilt'
  if (stand === 'not-determined') return 'offen'
  return 'fehlt'
}

function bildschirmrechtErteilt(): boolean {
  return process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('screen') === 'granted'
}

/**
 * Löst auf dem Mac die Systemabfrage für "Bildschirmaufnahme" aus (get-windows fragt sie an, wenn die Prüfung
 * eingeschaltet ist und die Berechtigung noch nicht entschieden wurde). Ein Fehler ist hier erwartbar und egal.
 */
export async function bildschirmrechtAnfragen(): Promise<Bildschirmrecht> {
  if (process.platform === 'darwin') {
    try {
      await activeWindow({ screenRecordingPermission: true, accessibilityPermission: false })
    } catch {
      // Ohne Berechtigung wirft get-windows; die Abfrage von macOS ist trotzdem erschienen bzw. der Stand steht fest.
    }
  }
  return bildschirmrecht()
}

/** Was zwischen zwei App-Starts überlebt: die laufende Abwesenheit und die "später" weggeklickten Rückfragen. */
interface Ablage {
  weg: (Weg & { blockId: string }) | null
  spaeter: Record<string, number>
}

type Zustand = Exclude<ErfassungsZustand, 'nicht-angemeldet'>

/**
 * Die automatische Erfassung. Läuft im Hintergrundprozess, auch bei geschlossenem Fenster.
 * Ereignisse: 'status' (bei jedem Takt), 'bloecke' (wenn sich die Blockliste ändert).
 */
export class Erfassung extends EventEmitter {
  zustand: Zustand = 'gestoppt'
  inaktivSeit: Date | null = null
  pausiertSeit: Date | null = null
  idleSchwelleSekunden = 180
  fenstertitelSpeichern = true

  private aktuell: Block | null = null
  private inaktiv: Block | null = null
  private kurz: Block | null = null // fertiger Block unter 60 s, wartet auf den Anschlussblock
  /** Seit wann das eigene App-Fenster ununterbrochen den Fokus hat (ms), sonst null. */
  private eigenesSeit: number | null = null
  /** Laufender Fokus: jeder neue Arbeitsblock bekommt diese Tätigkeit und ist produktiv. */
  private fokus: Fokus | null = null
  /** Laufende angekündigte Abwesenheit ("Ich bin weg") und ihr produktiver Hand-Block. */
  private weg: Weg | null = null
  private wegBlock: Block | null = null
  /** Längste Eingabepause (Sekunden) seit dem Start der Abwesenheit: erst ab WEG_ABWESEND_S zählt eine Eingabe als Rückkehr. */
  private wegLaengsteRuhe = 0
  /** Rückfragen, die mit "Später" weggeklickt wurden: Block-Kennung → Zeitpunkt (ms). */
  private spaeter = new Map<string, number>()
  private readonly ablagePfad: string
  private letzterTakt = 0
  /** Wann der Rechner in den Ruhezustand ging oder gesperrt wurde (ms), 0 = nicht unterbrochen. */
  private unterbrochenUm = 0
  /** Vor diesen Zeitpunkt darf Untätigkeit nie rückwirkend gebucht werden (Start, Aufwachen, Fortsetzen). */
  private zeitgrenze = 0
  private timer: NodeJS.Timeout | null = null
  private taktLaeuft = false
  private readonly geraet = hostname()

  constructor(
    private readonly speicher: Speicher,
    private readonly userId: string,
    /** Bewertet Programm und Fenstertitel nach den Regeln; null = ungeklärt. */
    private readonly bewerter: (programm: string | null, titel: string | null) => Zuordnung | null
  ) {
    super()
    this.ablagePfad = join(app.getPath('userData'), `abwesenheit-${userId}.json`)
    this.ablageLaden()
  }

  /** Kennung des gerade laufenden Blocks, falls einer läuft. */
  laufendeId(): string | null {
    return this.aktuell?.id ?? null
  }

  start(): void {
    if (this.timer) return
    this.zustand = 'laeuft'
    this.letzterTakt = 0
    this.zeitgrenze = Date.now()
    if (this.weg) {
      // Eine angekündigte Abwesenheit läuft über einen Neustart hinweg weiter (Termin, Rechner war aus).
      this.zustand = 'weg'
    } else {
      // Die Zeit seit dem letzten bekannten Block (App war aus, Rechner aus) nachtragen.
      const letztes = this.speicher.letztesEnde()
      if (letztes) this.lueckeFuellen(Date.parse(letztes), Date.now())
    }
    this.timer = setInterval(() => void this.takt(), TAKT_MS)
    void this.takt()
  }

  /**
   * Füllt eine Lücke ohne Aufzeichnung: ab der Untätigkeits-Schwelle als "Nicht am Rechner" (unproduktiv),
   * ab 90 Minuten als "Abwesend" (inaktiv, blau); an Mitternacht geteilt, höchstens LUECKE_MAX_MS zurück.
   * Liefert die angelegten Blöcke (für die Rückfrage nach der Rückkehr).
   */
  private lueckeFuellen(von: number, bis: number): Block[] {
    const dauer = bis - von
    if (dauer < this.idleSchwelleSekunden * 1000) return []
    const blau = dauer >= ABWESEND_MS
    const angelegt: Block[] = []
    let a = Math.max(von, bis - LUECKE_MAX_MS)
    while (a < bis) {
      const e = Math.min(bis, naechsterTagesanfang(new Date(a)).getTime())
      const b = this.neuerBlock(new Date(a), 'inaktiv', null, null, null)
      if (blau) b.bewertung = 'inaktiv'
      b.ende = new Date(e).toISOString()
      this.speicher.aktualisieren(b)
      angelegt.push(b)
      a = e
    }
    this.emit('bloecke')
    return angelegt
  }

  /** Meldet eine abgeschlossene Abwesenheit, wenn sie in den Rahmen der Rückfrage fällt (für die Systemmeldung). */
  private abwesenheitMelden(block: Block): void {
    const dauer = Date.parse(block.ende) - Date.parse(block.start)
    if (dauer < this.idleSchwelleSekunden * 1000 || dauer > RUECKFRAGE_MAX_MS) return
    if (this.speicher.get(block.id)?.geloeschtAm) return
    const a: Abwesenheit = { id: block.id, start: block.start, ende: block.ende }
    this.emit('abwesenheit', a)
  }

  /**
   * Abgeschlossene Abwesenheiten der letzten 24 Stunden (Untätigkeits-Schwelle bis 3 Stunden), die noch niemand
   * eingeordnet hat: nicht von Hand geprüft, nicht gelöscht, nicht die gerade laufende, nicht "später" weggeklickt.
   */
  offeneAbwesenheiten(jetzt = new Date()): Abwesenheit[] {
    const mindestens = this.idleSchwelleSekunden * 1000
    const ab = new Date(jetzt.getTime() - RUECKFRAGE_FENSTER_MS)
    return this.speicher
      .imZeitraum(ab, jetzt)
      .filter((b) => b.quelle === 'auto' && b.programm === null && !b.manuellGeprueft && b.id !== this.inaktiv?.id && !this.spaeter.has(b.id))
      .filter((b) => {
        const dauer = Date.parse(b.ende) - Date.parse(b.start)
        if (dauer < mindestens || dauer > RUECKFRAGE_MAX_MS) return false
        // An Mitternacht geteilte Stücke einer Nacht (beginnen oder enden genau um 0 Uhr) sind Schlaf, keine Frage wert.
        const start = new Date(b.start)
        const ende = new Date(b.ende)
        return start.getTime() !== naechsterTagesanfang(new Date(start.getTime() - 1)).getTime() && ende.getTime() !== naechsterTagesanfang(new Date(ende.getTime() - 1)).getTime()
      })
      // Doppelte Blöcke über denselben Zeitraum (kommen in alten Daten vor) nur einmal fragen; die Antwort gilt für alle.
      .filter((b, i, alle) => alle.findIndex((x) => x.start === b.start && x.ende === b.ende) === i)
      .map((b) => ({ id: b.id, start: b.start, ende: b.ende }))
  }

  /** "Später": die Rückfrage zu dieser Abwesenheit verschwindet, der Block bleibt in der Liste änderbar. */
  spaeterEinordnen(id: string): void {
    this.spaeter.set(id, Date.now())
    this.ablageSpeichern()
    this.melden()
  }

  wegStand(): Weg | null {
    return this.weg
  }

  /**
   * "Ich bin weg": ab `beginn` (darf bis zu drei Stunden zurückliegen) läuft ein produktiver Hand-Block mit dieser
   * Tätigkeit, bis die erste Eingabe die Rückkehr meldet. Laufende Blöcke enden am Beginn, automatische Blöcke im
   * Zeitraum weichen (Zeit ohne Eingabe, die schon rot gebucht war, gehört zum Termin). Ein Fokus endet.
   */
  wegStarten(taetigkeit: string, beginn: Date, jetzt: Date): void {
    if (this.zustand === 'gestoppt') return
    if (this.weg) this.wegBeenden(beginn)
    if (this.zustand === 'pausiert') {
      this.zustand = 'laeuft'
      this.pausiertSeit = null
    }
    this.fokus = null
    this.alleSchliessen(beginn)
    for (const b of this.speicher.imZeitraum(beginn, jetzt)) {
      if (b.quelle !== 'auto') continue
      if (Date.parse(b.start) < beginn.getTime()) {
        b.ende = beginn.toISOString()
        this.speicher.aktualisieren(b)
      } else {
        b.geloeschtAm = new Date().toISOString()
        b.fenstertitel = null
        b.notiz = null
        this.speicher.aktualisieren(b)
      }
    }
    const stempel = new Date().toISOString()
    this.wegBlock = {
      id: randomUUID(),
      userId: this.userId,
      start: beginn.toISOString(),
      ende: jetzt.toISOString(),
      quelle: 'manuell',
      programm: null,
      programmRoh: null,
      fenstertitel: null,
      taetigkeit,
      bewertung: 'produktiv',
      notiz: null,
      manuellGeprueft: true,
      geraet: this.geraet,
      geaendertAm: stempel,
      geloeschtAm: null
    }
    this.speicher.hinzufuegen(this.wegBlock)
    this.weg = { taetigkeit, seit: beginn.toISOString() }
    this.wegLaengsteRuhe = 0
    this.zustand = 'weg'
    this.inaktivSeit = null
    this.letzterTakt = 0
    this.zeitgrenze = jetzt.getTime()
    this.ablageSpeichern()
    this.emit('bloecke')
    this.melden()
  }

  /** Rückkehr: der Hand-Block endet zu diesem Zeitpunkt, die Erfassung läuft normal weiter. */
  wegBeenden(jetzt: Date): void {
    if (!this.weg) return
    if (this.wegBlock) {
      const start = Date.parse(this.wegBlock.start)
      if (jetzt.getTime() - start < KURZ_MS) {
        // Doch nicht weg gewesen: kein Eintrag.
        this.wegBlock.geloeschtAm = new Date().toISOString()
      } else {
        this.wegBlock.ende = jetzt.toISOString()
      }
      this.speicher.aktualisieren(this.wegBlock)
    }
    this.weg = null
    this.wegBlock = null
    this.wegLaengsteRuhe = 0
    if (this.zustand === 'weg') this.zustand = 'laeuft'
    this.letzterTakt = 0
    this.zeitgrenze = jetzt.getTime()
    this.ablageSpeichern()
    this.emit('bloecke')
    this.melden()
  }

  /** Solange man weg ist: den Hand-Block verlängern, die Rückkehr an der ersten Eingabe erkennen. */
  private wegVerarbeiten(jetzt: Date): void {
    if (!this.weg || !this.wegBlock) return
    const seit = Date.parse(this.weg.seit)
    const ruhe = powerMonitor.getSystemIdleTime()
    // Nur Ruhe SEIT dem Start zählt: Wer den Knopf drückt, war davor vielleicht schon minutenlang untätig
    // (Rückwirkend gestartet, Dialog per Fernsteuerung), sonst gälte die nächste Mausbewegung sofort als Rückkehr.
    const seitStart = (Date.now() - Math.max(seit, this.zeitgrenze)) / 1000
    this.wegLaengsteRuhe = Math.max(this.wegLaengsteRuhe, Math.min(ruhe, seitStart))
    if (this.wegLaengsteRuhe >= WEG_ABWESEND_S && ruhe < WEG_ZURUECK_S) {
      this.wegBeenden(new Date(jetzt.getTime() - ruhe * 1000))
      return
    }
    const grenze = Math.min(seit + WEG_MAX_MS, naechsterTagesanfang(new Date(seit)).getTime())
    if (jetzt.getTime() >= grenze) {
      this.wegBeenden(new Date(grenze))
      return
    }
    this.wegBlock.ende = jetzt.toISOString()
    this.speicher.aktualisieren(this.wegBlock)
  }

  private ablageLaden(): void {
    try {
      if (!existsSync(this.ablagePfad)) return
      const daten = JSON.parse(readFileSync(this.ablagePfad, 'utf8')) as Partial<Ablage>
      const jetzt = Date.now()
      for (const [id, zeit] of Object.entries(daten.spaeter ?? {})) {
        if (jetzt - zeit < SPAETER_MERKEN_MS) this.spaeter.set(id, zeit)
      }
      if (daten.weg && jetzt - Date.parse(daten.weg.seit) < WEG_MAX_MS) {
        const block = this.speicher.get(daten.weg.blockId)
        if (block && !block.geloeschtAm) {
          this.weg = { taetigkeit: daten.weg.taetigkeit, seit: daten.weg.seit }
          this.wegBlock = block
          this.wegLaengsteRuhe = WEG_ABWESEND_S
        }
      }
    } catch (fehler) {
      console.error('Abwesenheits-Ablage:', fehler)
    }
  }

  private ablageSpeichern(): void {
    const daten: Ablage = {
      weg: this.weg && this.wegBlock ? { ...this.weg, blockId: this.wegBlock.id } : null,
      spaeter: Object.fromEntries(this.spaeter)
    }
    try {
      writeFileSync(this.ablagePfad, JSON.stringify(daten))
    } catch (fehler) {
      console.error('Abwesenheits-Ablage:', fehler)
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.alleSchliessen(new Date())
    this.fokus = null
    this.zustand = 'gestoppt'
    this.melden()
  }

  fokusStand(): Fokus | null {
    return this.fokus
  }

  /**
   * Startet einen Fokus: ab `beginn` (darf in der Vergangenheit liegen) zählt alles als produktiv mit dieser
   * Tätigkeit. Der laufende Block wird am Beginn geteilt bzw. ganz übernommen; die schon gespeicherten
   * Blöcke behandelt `fokusRueckwirkend` (src/main/fokus.ts).
   */
  fokusStarten(taetigkeit: string, beginn: Date, jetzt: Date): void {
    this.fokus = { taetigkeit, seit: beginn.toISOString() }
    const b = this.aktuell
    if (b) {
      if (Date.parse(b.start) < beginn.getTime() - KURZ_MS) {
        // Vorne bleibt der alte Block, ab dem Beginn läuft ein neuer mit dem Fokus weiter.
        const { programm, programmRoh, fenstertitel } = b
        this.schliessen(b, beginn)
        this.aktuell = this.neuerBlock(beginn, 'ungeklaert', programm, programmRoh, fenstertitel)
        this.aktuell.ende = jetzt.toISOString()
        this.speicher.aktualisieren(this.aktuell)
      } else {
        this.fokusAnwenden(b)
        this.speicher.aktualisieren(b)
        this.emit('bloecke')
      }
    }
    this.melden()
  }

  /** Beendet den Fokus; der laufende Block endet jetzt, der nächste wird wieder nach den Regeln bewertet. */
  fokusBeenden(jetzt: Date): void {
    if (!this.fokus) return
    this.fokus = null
    if (this.aktuell) {
      this.schliessen(this.aktuell, jetzt)
      this.aktuell = null
    }
    this.melden()
  }

  private fokusAnwenden(block: Block): void {
    // Zeit ohne Eingabe ("Nicht am Rechner", programm null) bleibt auch im Fokus unproduktiv.
    if (!this.fokus || block.programm === null) return
    block.taetigkeit = this.fokus.taetigkeit
    block.bewertung = 'produktiv'
    block.manuellGeprueft = true
  }

  pause(): void {
    if (this.zustand === 'pausiert' || this.zustand === 'gestoppt') return
    this.alleSchliessen(new Date())
    this.zustand = 'pausiert'
    this.pausiertSeit = new Date()
    this.melden()
  }

  fortsetzen(): void {
    if (this.zustand !== 'pausiert') return
    this.zustand = 'laeuft'
    this.pausiertSeit = null
    this.letzterTakt = 0
    this.zeitgrenze = Date.now()
    this.melden()
    void this.takt()
  }

  /** Rechner schläft ein oder wird gesperrt: laufende Blöcke sofort beenden. */
  unterbrechen(): void {
    this.alleSchliessen(new Date())
    this.letzterTakt = 0
    this.zeitgrenze = Date.now()
    this.unterbrochenUm = Date.now()
    this.melden()
  }

  /** Nach dem Aufwachen: nächster Takt beginnt sauber neu, nichts wird rückwirkend gebucht. */
  weiter(): void {
    this.letzterTakt = 0
    this.zeitgrenze = Date.now()
    // Die Zeit im Ruhezustand oder am Sperrbildschirm nachtragen (rot unter 90 Minuten, sonst blau);
    // während "Ich bin weg" gehört sie zum Termin, der Hand-Block läuft einfach weiter.
    if (this.unterbrochenUm && this.zustand !== 'pausiert' && this.zustand !== 'gestoppt' && !this.weg) {
      for (const b of this.lueckeFuellen(this.unterbrochenUm, Date.now())) this.abwesenheitMelden(b)
    }
    this.unterbrochenUm = 0
  }

  status(): {
    zustand: Zustand
    laufenderBlock: LaufenderBlock | null
    inaktivSeit: string | null
    pausiertSeit: string | null
    eigenesFenster: boolean
    fokus: Fokus | null
    weg: Weg | null
    offeneAbwesenheiten: Abwesenheit[]
  } {
    const b = this.aktuell
    return {
      zustand: this.zustand,
      laufenderBlock: b
        ? {
            id: b.id,
            start: b.start,
            programm: b.programm,
            fenstertitel: b.fenstertitel,
            taetigkeit: b.taetigkeit,
            bewertung: b.bewertung
          }
        : null,
      inaktivSeit: this.inaktivSeit?.toISOString() ?? null,
      pausiertSeit: this.pausiertSeit?.toISOString() ?? null,
      eigenesFenster: this.eigenesSeit !== null,
      fokus: this.fokus,
      weg: this.weg,
      offeneAbwesenheiten: this.zustand === 'gestoppt' ? [] : this.offeneAbwesenheiten()
    }
  }

  private melden(): void {
    this.emit('status')
  }

  private async takt(): Promise<void> {
    if (this.taktLaeuft) return
    this.taktLaeuft = true
    try {
      await this.verarbeiten(new Date())
    } catch (fehler) {
      console.error('Erfassung:', fehler)
    } finally {
      this.taktLaeuft = false
    }
  }

  private async verarbeiten(jetzt: Date): Promise<void> {
    if (this.zustand === 'gestoppt') return

    // Lücke ohne Ereignis (z. B. Zuklappen ohne Ruhezustands-Meldung): alles zum letzten bekannten
    // Zeitpunkt beenden und die Lücke nachtragen (rot unter 90 Minuten, sonst blau).
    if (this.letzterTakt && jetzt.getTime() - this.letzterTakt > LUECKE_MS) {
      const ab = this.letzterTakt
      this.alleSchliessen(new Date(ab))
      this.zeitgrenze = jetzt.getTime()
      // Während "Ich bin weg" gehört die Lücke zum Termin (der Hand-Block wird unten verlängert).
      if (this.zustand !== 'pausiert' && !this.weg) {
        for (const b of this.lueckeFuellen(ab, jetzt.getTime())) this.abwesenheitMelden(b)
      }
    }
    this.letzterTakt = jetzt.getTime()

    if (this.zustand === 'pausiert') {
      // Eine Pause endet spätestens um Mitternacht.
      if (this.pausiertSeit && jetzt >= naechsterTagesanfang(this.pausiertSeit)) this.fortsetzen()
      return
    }

    // Angekündigte Abwesenheit: nur den Hand-Block verlängern und auf die Rückkehr warten.
    if (this.weg) {
      this.wegVerarbeiten(jetzt)
      this.melden()
      return
    }

    // Ein Fokus endet spätestens um Mitternacht, damit er nicht vergessen am nächsten Tag weiterläuft.
    if (this.fokus && jetzt >= naechsterTagesanfang(new Date(this.fokus.seit))) this.fokusBeenden(jetzt)

    const idleSekunden = powerMonitor.getSystemIdleTime()
    if (idleSekunden >= this.idleSchwelleSekunden) {
      this.inaktivVerarbeiten(jetzt, idleSekunden)
      this.melden()
      return
    }

    // Wieder Eingaben: inaktiven Block beenden und nach der Abwesenheit fragen.
    if (this.inaktiv) {
      const abwesenheit = this.inaktiv
      this.schliessen(abwesenheit, jetzt)
      this.inaktiv = null
      this.abwesenheitMelden(abwesenheit)
    }
    this.inaktivSeit = null
    this.zustand = 'laeuft'

    const fenster = await this.aktivesFenster()
    const roh = fenster?.owner?.name ?? null

    // Diktat, Emoji-Fenster, Startmenü und Co.: kein eigener Block, der laufende läuft weiter.
    if (istSystemUeberlagerung(roh)) {
      if (this.aktuell) {
        this.aktuell.ende = jetzt.toISOString()
        this.speicher.aktualisieren(this.aktuell)
      }
      this.melden()
      return
    }

    // Das eigene Fenster dieser App ist keine Arbeit: nie ein eigener Block. Ein kurzer Blick
    // (bis 2 Minuten) zählt zum vorherigen Programm weiter, ein längerer Aufenthalt beendet den
    // vorherigen Block rückwirkend beim Wechsel in die App.
    if (fenster?.owner?.processId === process.pid || istEigenesProgramm(roh)) {
      this.eigenesVerarbeiten(jetzt)
      this.melden()
      return
    }
    this.eigenesSeit = null

    const programm = programmNormalisieren(roh)
    const titel = this.fenstertitelSpeichern && fenster?.title ? fenster.title : null

    // Kein Fenster mit Fokus (Schreibtisch, Sperrbildschirm): kein Arbeitsblock.
    if (!programm || istSchreibtisch(programm, fenster?.title)) {
      if (this.aktuell) {
        this.schliessen(this.aktuell, jetzt)
        this.aktuell = null
      }
      this.melden()
      return
    }

    // Anderes Programm oder anderer Fenstertitel: neuer Block.
    if (this.aktuell && (this.aktuell.programm !== programm || this.aktuell.fenstertitel !== titel)) {
      this.schliessen(this.aktuell, jetzt)
      this.aktuell = null
    }

    if (!this.aktuell) {
      this.aktuell = this.neuerBlock(jetzt, 'ungeklaert', programm, roh, titel)
    } else {
      const start = Date.parse(this.aktuell.start)
      const grenze = Math.min(naechsterTagesanfang(new Date(start)).getTime(), start + MAX_BLOCK_MS)
      if (jetzt.getTime() >= grenze) {
        // Mitternacht oder 4-Stunden-Grenze: an der Grenze teilen.
        const g = new Date(grenze)
        this.schliessen(this.aktuell, g)
        this.aktuell = this.neuerBlock(g, 'ungeklaert', programm, roh, titel)
        this.aktuell.ende = jetzt.toISOString()
        this.speicher.aktualisieren(this.aktuell)
      } else {
        this.aktuell.ende = jetzt.toISOString()
        this.speicher.aktualisieren(this.aktuell)
      }
    }
    this.melden()
  }

  private eigenesVerarbeiten(jetzt: Date): void {
    if (this.eigenesSeit === null) this.eigenesSeit = jetzt.getTime()
    if (!this.aktuell) return
    if (jetzt.getTime() - this.eigenesSeit <= EIGENES_KURZ_MS) {
      this.aktuell.ende = jetzt.toISOString()
      this.speicher.aktualisieren(this.aktuell)
    } else {
      this.schliessen(this.aktuell, new Date(this.eigenesSeit))
      this.aktuell = null
    }
  }

  private inaktivVerarbeiten(jetzt: Date, idleSekunden: number): void {
    // Die Untätigkeit begann beim letzten Tastendruck, nicht erst jetzt,
    // aber nie vor dem Start der Erfassung oder dem letzten Aufwachen.
    const inaktivStart = new Date(Math.max(jetzt.getTime() - idleSekunden * 1000, this.zeitgrenze))
    if (this.aktuell) {
      this.schliessen(this.aktuell, inaktivStart)
      this.aktuell = null
    }
    // Höchstdauer erreicht: bis zur nächsten Eingabe wird nichts mehr aufgezeichnet.
    if (this.zustand === 'abwesend' && !this.inaktiv) return

    if (!this.inaktiv) {
      this.inaktiv = this.neuerBlock(inaktivStart, 'inaktiv', null, null, null)
      this.inaktivSeit = inaktivStart
      this.zustand = 'inaktiv'
    }

    // Ab 90 Minuten Abwesenheit (seit dem letzten Tastendruck) wird der ganze Block "Abwesend" und zählt nicht.
    const abwesendSeit = this.inaktivSeit?.getTime() ?? Date.parse(this.inaktiv.start)
    if (jetzt.getTime() - abwesendSeit >= ABWESEND_MS) {
      if (this.inaktiv.bewertung !== 'inaktiv') {
        this.inaktiv.bewertung = 'inaktiv'
        this.speicher.aktualisieren(this.inaktiv)
        this.emit('bloecke')
      }
      this.zustand = 'abwesend'
      // Wer so lange weg ist, hat den Fokus beendet; sonst zählt der Abend nach der Rückkehr falsch.
      this.fokus = null
    }

    const start = Date.parse(this.inaktiv.start)
    const mitternacht = naechsterTagesanfang(new Date(start)).getTime()
    const maxEnde = abwesendSeit + MAX_INAKTIV_MS
    if (jetzt.getTime() >= mitternacht && mitternacht < maxEnde) {
      const m = new Date(mitternacht)
      const blau = this.inaktiv.bewertung === 'inaktiv'
      this.schliessen(this.inaktiv, m)
      this.inaktiv = this.neuerBlock(m, 'inaktiv', null, null, null)
      if (blau) this.inaktiv.bewertung = 'inaktiv'
      this.inaktiv.ende = jetzt.toISOString()
      this.speicher.aktualisieren(this.inaktiv)
    } else if (jetzt.getTime() >= maxEnde) {
      this.schliessen(this.inaktiv, new Date(maxEnde))
      this.inaktiv = null
      this.zustand = 'abwesend'
    } else {
      this.inaktiv.ende = jetzt.toISOString()
      this.speicher.aktualisieren(this.inaktiv)
    }
  }

  private async aktivesFenster(): Promise<Awaited<ReturnType<typeof activeWindow>> | undefined> {
    try {
      // Auf dem Mac gibt es Fenstertitel nur mit der Berechtigung "Bildschirmaufnahme" (seit 11. September 2026 gewollt:
      // YouTube, Sheets und Co. sollen auch dort erkannt werden). Ohne erteilte Berechtigung wird bewusst OHNE Prüfung
      // abgefragt (nur Programmname), sonst wirft get-windows und die Erfassung stünde still; die Anfrage der Berechtigung
      // löst `bildschirmrechtAnfragen` in index.ts einmalig aus. Bedienungshilfen werden weiterhin nicht angefordert.
      return await activeWindow({ screenRecordingPermission: bildschirmrechtErteilt(), accessibilityPermission: false })
    } catch {
      return undefined
    }
  }

  private neuerBlock(
    start: Date,
    bewertung: Bewertung,
    programm: string | null,
    programmRoh: string | null,
    fenstertitel: string | null
  ): Block {
    let beginn = start
    // Ein wartender Kurzblock wird an diesen Block vorne angehängt.
    if (this.kurz) {
      if (Math.abs(Date.parse(this.kurz.ende) - start.getTime()) <= ANSCHLUSS_MS) {
        beginn = new Date(this.kurz.start)
        this.speicher.entfernen(this.kurz.id)
      }
      this.kurz = null
    }
    const jetzt = new Date().toISOString()
    // Arbeitsblöcke werden sofort nach den Regeln bewertet. Zeit ohne Eingabe (intern "inaktiv" angefragt)
    // wird seit 10. September 2026 als UNPRODUKTIV gespeichert, ohne Programm ("Nicht am Rechner"): der
    // Rechner sieht Handy und Sofa nicht, und neutrales Grau ließ diese Zeit verschwinden (Auftraggeber).
    const ruhe = bewertung === 'inaktiv'
    const zuordnung = ruhe ? null : this.bewerter(programm, fenstertitel)
    const block: Block = {
      id: randomUUID(),
      userId: this.userId,
      start: beginn.toISOString(),
      ende: start.toISOString(),
      quelle: 'auto',
      programm,
      programmRoh,
      fenstertitel,
      taetigkeit: zuordnung?.taetigkeit ?? null,
      bewertung: ruhe ? 'unproduktiv' : (zuordnung?.bewertung ?? 'ungeklaert'),
      notiz: null,
      manuellGeprueft: false,
      geraet: this.geraet,
      geaendertAm: jetzt,
      geloeschtAm: null
    }
    // Ein laufender Fokus schlägt die Regeln: Tätigkeit des Fokus, produktiv, von Hand geprüft.
    this.fokusAnwenden(block)
    this.speicher.hinzufuegen(block)
    this.emit('bloecke')
    return block
  }

  private schliessen(block: Block, ende: Date): void {
    const startMs = Date.parse(block.start)
    const endeMs = ende.getTime()
    if (endeMs <= startMs) {
      // Leerer Block (z. B. Untätigkeit begann vor dem Blockstart): weg damit.
      this.speicher.entfernen(block.id)
      if (this.kurz?.id === block.id) this.kurz = null
      this.emit('bloecke')
      return
    }
    block.ende = new Date(endeMs).toISOString()

    if (endeMs - startMs < KURZ_MS) {
      const vorher = this.speicher.vorgaenger(block)
      if (vorher) {
        // In den vorherigen Block einrechnen.
        vorher.ende = block.ende
        this.speicher.aktualisieren(vorher)
        this.speicher.entfernen(block.id)
        this.emit('bloecke')
        return
      }
      // Sonst auf den nächsten Block warten.
      this.kurz = block
    }
    this.speicher.aktualisieren(block)
    this.emit('bloecke')
  }

  private alleSchliessen(zeit: Date): void {
    if (this.aktuell) {
      this.schliessen(this.aktuell, zeit)
      this.aktuell = null
    }
    if (this.inaktiv) {
      this.schliessen(this.inaktiv, zeit)
      this.inaktiv = null
    }
    this.inaktivSeit = null
    this.eigenesSeit = null
    if (this.zustand === 'inaktiv' || this.zustand === 'abwesend') this.zustand = 'laeuft'
  }
}
