import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { hostname } from 'os'
import { powerMonitor } from 'electron'
import { activeWindow } from 'get-windows'
import type { Bewertung, Block, ErfassungsZustand, LaufenderBlock } from '@shared/typen'
import { naechsterTagesanfang } from '@shared/zeit'
import { programmNormalisieren } from './programme'
import type { Speicher } from './speicher'

const TAKT_MS = 5_000 // alle 5 Sekunden das aktive Fenster abfragen
const LUECKE_MS = 30_000 // längere Pause zwischen zwei Abfragen = Rechner hat geschlafen
const KURZ_MS = 60_000 // Blöcke darunter werden in den Nachbarblock eingerechnet
const ANSCHLUSS_MS = 5_000 // so nah muss ein Nachbarblock liegen
const MAX_BLOCK_MS = 4 * 3_600_000 // Sicherung: nie länger als 4 Stunden
const MAX_INAKTIV_MS = 60 * 60_000 // danach gilt man als abwesend, kein Block mehr

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
  private letzterTakt = 0
  private timer: NodeJS.Timeout | null = null
  private taktLaeuft = false
  private readonly geraet = hostname()

  constructor(
    private readonly speicher: Speicher,
    private readonly userId: string
  ) {
    super()
  }

  start(): void {
    if (this.timer) return
    this.zustand = 'laeuft'
    this.letzterTakt = 0
    this.timer = setInterval(() => void this.takt(), TAKT_MS)
    void this.takt()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.alleSchliessen(new Date())
    this.zustand = 'gestoppt'
    this.melden()
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
    this.melden()
    void this.takt()
  }

  /** Rechner schläft ein oder wird gesperrt: laufende Blöcke sofort beenden. */
  unterbrechen(): void {
    this.alleSchliessen(new Date())
    this.letzterTakt = 0
    this.melden()
  }

  /** Nach dem Aufwachen: nächster Takt beginnt sauber neu. */
  weiter(): void {
    this.letzterTakt = 0
  }

  status(): {
    zustand: Zustand
    laufenderBlock: LaufenderBlock | null
    inaktivSeit: string | null
    pausiertSeit: string | null
  } {
    const b = this.aktuell
    return {
      zustand: this.zustand,
      laufenderBlock: b
        ? { start: b.start, programm: b.programm, fenstertitel: b.fenstertitel, bewertung: b.bewertung }
        : null,
      inaktivSeit: this.inaktivSeit?.toISOString() ?? null,
      pausiertSeit: this.pausiertSeit?.toISOString() ?? null
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

    // Lücke ohne Ereignis (z. B. Zuklappen): alles zum letzten bekannten Zeitpunkt beenden.
    if (this.letzterTakt && jetzt.getTime() - this.letzterTakt > LUECKE_MS) {
      this.alleSchliessen(new Date(this.letzterTakt))
    }
    this.letzterTakt = jetzt.getTime()

    if (this.zustand === 'pausiert') {
      // Eine Pause endet spätestens um Mitternacht.
      if (this.pausiertSeit && jetzt >= naechsterTagesanfang(this.pausiertSeit)) this.fortsetzen()
      return
    }

    const idleSekunden = powerMonitor.getSystemIdleTime()
    if (idleSekunden >= this.idleSchwelleSekunden) {
      this.inaktivVerarbeiten(jetzt, idleSekunden)
      this.melden()
      return
    }

    // Wieder Eingaben: inaktiven Block beenden.
    if (this.inaktiv) {
      this.schliessen(this.inaktiv, jetzt)
      this.inaktiv = null
    }
    this.inaktivSeit = null
    this.zustand = 'laeuft'

    const fenster = await this.aktivesFenster()
    const roh = fenster?.owner?.name ?? null
    const programm = programmNormalisieren(roh)
    const titel = this.fenstertitelSpeichern && fenster?.title ? fenster.title : null

    // Kein Fenster mit Fokus (Schreibtisch, Sperrbildschirm): kein Arbeitsblock.
    if (!programm) {
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

  private inaktivVerarbeiten(jetzt: Date, idleSekunden: number): void {
    // Die Untätigkeit begann beim letzten Tastendruck, nicht erst jetzt.
    const inaktivStart = new Date(jetzt.getTime() - idleSekunden * 1000)
    if (this.aktuell) {
      this.schliessen(this.aktuell, inaktivStart)
      this.aktuell = null
    }
    if (this.zustand === 'abwesend') return

    if (!this.inaktiv) {
      this.inaktiv = this.neuerBlock(inaktivStart, 'inaktiv', null, null, null)
      this.inaktivSeit = inaktivStart
      this.zustand = 'inaktiv'
    }

    const start = Date.parse(this.inaktiv.start)
    const mitternacht = naechsterTagesanfang(new Date(start)).getTime()
    const maxEnde = start + MAX_INAKTIV_MS
    if (jetzt.getTime() >= mitternacht && mitternacht < maxEnde) {
      const m = new Date(mitternacht)
      this.schliessen(this.inaktiv, m)
      this.inaktiv = this.neuerBlock(m, 'inaktiv', null, null, null)
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
      // Auf dem Mac bewusst ohne Berechtigungsabfragen: nur der Programmname, kein Fenstertitel.
      return await activeWindow({ screenRecordingPermission: false, accessibilityPermission: false })
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
    const block: Block = {
      id: randomUUID(),
      userId: this.userId,
      start: beginn.toISOString(),
      ende: start.toISOString(),
      quelle: 'auto',
      programm,
      programmRoh,
      fenstertitel,
      taetigkeit: null,
      bewertung,
      notiz: null,
      manuellGeprueft: false,
      geraet: this.geraet,
      geaendertAm: jetzt,
      geloeschtAm: null
    }
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
    if (this.zustand === 'inaktiv' || this.zustand === 'abwesend') this.zustand = 'laeuft'
  }
}
