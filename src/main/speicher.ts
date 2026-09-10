import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { Block } from '@shared/typen'

interface Datei {
  version: 1
  userId: string
  bloecke: Block[]
  ausstehend: string[]
}

/** So viele Wochen bleiben lokal liegen; Älteres kommt bei Bedarf aus der Datenbank. */
const WOCHEN_VORHALTEN = 13
const ANSCHLUSS_MS = 5000

/**
 * Der lokale Zwischenspeicher: eine JSON-Datei je Konto im Datenordner der App.
 * Geschrieben wird erst in eine Hilfsdatei, dann umbenannt; die vorherige
 * Fassung bleibt als .bak liegen. So geht bei einem Absturz nichts kaputt.
 */
export class Speicher {
  private readonly pfad: string
  private daten: Datei
  private ausstehend: Set<string>
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly userId: string) {
    this.pfad = join(app.getPath('userData'), `bloecke-${userId}.json`)
    this.daten = this.laden()
    this.ausstehend = new Set(this.daten.ausstehend)
  }

  private laden(): Datei {
    for (const kandidat of [this.pfad, this.pfad + '.bak']) {
      try {
        if (!existsSync(kandidat)) continue
        const d = JSON.parse(readFileSync(kandidat, 'utf8')) as Datei
        if (d && d.version === 1 && Array.isArray(d.bloecke)) return d
      } catch {
        // beschädigt: nächste Datei versuchen
      }
    }
    return { version: 1, userId: this.userId, bloecke: [], ausstehend: [] }
  }

  /** Schreibt gebündelt, spätestens eine Sekunde nach der letzten Änderung. */
  speichernBald(): void {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.speichern()
    }, 1000)
  }

  speichern(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.daten.ausstehend = [...this.ausstehend]
    mkdirSync(dirname(this.pfad), { recursive: true })
    const hilfsdatei = this.pfad + '.tmp'
    writeFileSync(hilfsdatei, JSON.stringify(this.daten))
    try {
      if (existsSync(this.pfad)) copyFileSync(this.pfad, this.pfad + '.bak')
    } catch {
      // Sicherungskopie ist optional
    }
    renameSync(hilfsdatei, this.pfad)
  }

  get(id: string): Block | undefined {
    return this.daten.bloecke.find((b) => b.id === id)
  }

  /** Alle Blöcke, auch gelöschte. Nur für Neubewertung und Aufräumen. */
  alle(): Block[] {
    return this.daten.bloecke
  }

  /** Von Hand eingetragene Blöcke, neueste zuerst. */
  manuelleListe(maximal = 10): Block[] {
    return this.daten.bloecke
      .filter((b) => !b.geloeschtAm && b.quelle === 'manuell')
      .sort((a, b) => b.start.localeCompare(a.start))
      .slice(0, maximal)
  }

  /** Nicht eingeordnete automatische Blöcke, neueste zuerst, ohne den laufenden. */
  ungeklaerteListe(maximal = 300): Block[] {
    const grenze = new Date(Date.now() - 15_000).toISOString()
    return this.daten.bloecke
      .filter(
        (b) =>
          !b.geloeschtAm &&
          b.quelle === 'auto' &&
          b.bewertung === 'ungeklaert' &&
          !b.manuellGeprueft &&
          b.ende <= grenze
      )
      .sort((a, b) => b.start.localeCompare(a.start))
      .slice(0, maximal)
  }

  hinzufuegen(block: Block): void {
    this.daten.bloecke.push(block)
    this.ausstehend.add(block.id)
    this.speichernBald()
  }

  aktualisieren(block: Block): void {
    block.geaendertAm = new Date().toISOString()
    this.ausstehend.add(block.id)
    this.speichernBald()
  }

  /** Entfernt einen Block, der nie gesendet wurde (z. B. ein aufgesogener Kurzblock). */
  entfernen(id: string): void {
    const i = this.daten.bloecke.findIndex((b) => b.id === id)
    if (i >= 0) this.daten.bloecke.splice(i, 1)
    this.ausstehend.delete(id)
    this.speichernBald()
  }

  /** Nicht gelöschte Blöcke, die den Zeitraum berühren, nach Start sortiert. */
  /** Ende des zuletzt endenden, nicht gelöschten Blocks (ISO), sonst null. Für das Füllen von Lücken nach App-Start. */
  letztesEnde(): string | null {
    let ende: string | null = null
    for (const b of this.daten.bloecke) if (!b.geloeschtAm && (!ende || b.ende > ende)) ende = b.ende
    return ende
  }

  imZeitraum(von: Date, bis: Date): Block[] {
    const v = von.toISOString()
    const b = bis.toISOString()
    return this.daten.bloecke
      .filter((x) => !x.geloeschtAm && x.start < b && x.ende > v)
      .sort((x, y) => x.start.localeCompare(y.start))
  }

  /** Der Block, der unmittelbar vor dem gegebenen endet (für die Kurzblock-Regel). */
  vorgaenger(block: Block): Block | undefined {
    const start = Date.parse(block.start)
    let bester: Block | undefined
    for (const b of this.daten.bloecke) {
      if (b.id === block.id || b.geloeschtAm || b.quelle !== 'auto') continue
      const abstand = start - Date.parse(b.ende)
      if (abstand >= 0 && abstand <= ANSCHLUSS_MS && (!bester || b.ende > bester.ende)) bester = b
    }
    return bester
  }

  /** Produktive Sekunden im Zeitraum, anteilig bei Überlappung am Rand. */
  produktiveSekunden(von: Date, bis: Date): number {
    const v = von.getTime()
    const b = bis.getTime()
    let summe = 0
    for (const x of this.daten.bloecke) {
      if (x.geloeschtAm || x.bewertung !== 'produktiv') continue
      const s = Math.max(Date.parse(x.start), v)
      const e = Math.min(Date.parse(x.ende), b)
      if (e > s) summe += (e - s) / 1000
    }
    return Math.round(summe)
  }

  /** Automatische Blöcke, die noch niemand eingeordnet hat (ohne den gerade laufenden). */
  anzahlUngeklaert(): number {
    const grenze = new Date(Date.now() - 15_000).toISOString()
    let n = 0
    for (const b of this.daten.bloecke) {
      if (b.geloeschtAm || b.quelle !== 'auto' || b.bewertung !== 'ungeklaert' || b.manuellGeprueft) continue
      if (b.ende > grenze) continue
      n++
    }
    return n
  }

  ausstehende(): Block[] {
    const liste: Block[] = []
    for (const id of this.ausstehend) {
      const b = this.get(id)
      if (b) liste.push(b)
      else this.ausstehend.delete(id)
    }
    return liste
  }

  anzahlAusstehend(): number {
    return this.ausstehend.size
  }

  /** Nach erfolgreichem Senden; Blöcke, die sich währenddessen geändert haben, bleiben ausstehend. */
  alsGesendet(ids: string[], standBeimSenden: Map<string, string>): void {
    for (const id of ids) {
      const b = this.get(id)
      if (!b || b.geaendertAm === standBeimSenden.get(id)) this.ausstehend.delete(id)
    }
    this.speichernBald()
  }

  /** Blöcke aus der Datenbank übernehmen. Lokal Ausstehendes gewinnt, sonst die jüngere Fassung. */
  vomServerUebernehmen(zeilen: Block[]): number {
    let uebernommen = 0
    for (const z of zeilen) {
      const lokal = this.get(z.id)
      if (!lokal) {
        this.daten.bloecke.push(z)
        uebernommen++
      } else if (!this.ausstehend.has(z.id) && z.geaendertAm > lokal.geaendertAm) {
        Object.assign(lokal, z)
        uebernommen++
      }
    }
    if (uebernommen) this.speichernBald()
    return uebernommen
  }

  /**
   * Wirft lokale Blöcke weg, die die Datenbank im abgefragten Zeitfenster nicht mehr kennt,
   * zum Beispiel nach dem Entfernen der Testdaten oder nach dem Löschen auf einem anderen Gerät.
   * Ausstehende (noch nicht gesendete) und ganz frische Blöcke bleiben unangetastet.
   */
  verwaisteEntfernen(bekannt: Set<string>, von: string, bisEnde: string): number {
    const vorher = this.daten.bloecke.length
    this.daten.bloecke = this.daten.bloecke.filter(
      (b) => bekannt.has(b.id) || this.ausstehend.has(b.id) || b.ende < von || b.ende > bisEnde
    )
    const entfernt = vorher - this.daten.bloecke.length
    if (entfernt) this.speichernBald()
    return entfernt
  }

  /** Blendet automatische Blöcke aus, die nur durch ein Systemfenster entstanden sind. */
  fehlbloeckeAusblenden(istFehlblock: (programmRoh: string | null) => boolean): number {
    let n = 0
    const jetzt = new Date().toISOString()
    for (const b of this.daten.bloecke) {
      if (b.geloeschtAm || b.quelle !== 'auto' || b.manuellGeprueft || !istFehlblock(b.programmRoh)) continue
      b.geloeschtAm = jetzt
      b.fenstertitel = null
      this.aktualisieren(b)
      n++
    }
    return n
  }

  /** Wirft Blöcke weg, die älter als das Zeitfenster sind und längst gesendet wurden. */
  aufraeumen(): void {
    const grenze = new Date(Date.now() - WOCHEN_VORHALTEN * 7 * 86400000).toISOString()
    const vorher = this.daten.bloecke.length
    this.daten.bloecke = this.daten.bloecke.filter((b) => b.ende >= grenze || this.ausstehend.has(b.id))
    if (this.daten.bloecke.length !== vorher) this.speichernBald()
  }
}
