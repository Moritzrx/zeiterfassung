/*
 * Gemeinsames Wissen für den KI-Assistenten (16. September 2026, "dass er auch rund um wessamedia die ganzen
 * Infos hat"): Texte in der Tabelle `wissen` (Skript 20), die alle drei lesen und ändern können (Einstellungen →
 * KI-Assistent → Wissen über wessamedia). Sie stehen im Systemprompt hinter der Anleitung. Wird bei jeder Frage
 * höchstens alle fünf Minuten neu geladen.
 */
import type { Wissen } from '@shared/typen'
import { supabase, supabaseKonfiguriert } from './supabase'

const LADE_ABSTAND_MS = 5 * 60_000
const MAX_ZEICHEN = 40_000

interface Zeile {
  schluessel: string
  titel: string
  inhalt: string
  geaendert_am: string
}

let liste: Wissen[] = []
let geladenMs = 0
/** true, wenn die Tabelle fehlt (Skript 20 noch nicht ausgeführt). */
let tabelleFehlt = false

export async function wissenLaden(erzwingen = false): Promise<Wissen[]> {
  if (!supabaseKonfiguriert()) return liste
  if (!erzwingen && Date.now() - geladenMs < LADE_ABSTAND_MS) return liste
  const { data, error } = await supabase().from('wissen').select('schluessel, titel, inhalt, geaendert_am').order('schluessel')
  if (error) {
    tabelleFehlt = /wissen/.test(error.message) && /not find|does not exist|schema cache/i.test(error.message)
    if (!tabelleFehlt) console.warn('Wissen laden:', error.message)
    geladenMs = Date.now()
    return liste
  }
  tabelleFehlt = false
  liste = ((data ?? []) as Zeile[]).map((z) => ({ schluessel: z.schluessel, titel: z.titel, inhalt: z.inhalt ?? '', geaendertAm: z.geaendert_am }))
  geladenMs = Date.now()
  return liste
}

export function wissenTabelleFehlt(): boolean {
  return tabelleFehlt
}

export async function wissenSetzen(userId: string, schluessel: string, titel: string, inhalt: string): Promise<Wissen[]> {
  if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
  const sauberSchluessel = schluessel.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40)
  if (!sauberSchluessel) throw new Error('Ungültiger Eintrag.')
  const { error } = await supabase()
    .from('wissen')
    .upsert(
      { schluessel: sauberSchluessel, titel: titel.trim().slice(0, 80) || sauberSchluessel, inhalt: inhalt.slice(0, MAX_ZEICHEN), geaendert_von: userId, geaendert_am: new Date().toISOString() },
      { onConflict: 'schluessel' }
    )
  if (error) {
    if (/wissen/.test(error.message) && /not find|does not exist|schema cache/i.test(error.message)) {
      throw new Error('Dafür muss in Supabase einmal das Skript 20 (20_wissen.sql) ausgeführt werden.')
    }
    throw new Error('Wissen konnte nicht gespeichert werden: ' + error.message)
  }
  return wissenLaden(true)
}

/** Alle Einträge mit Inhalt als Text für den Systemprompt, leer wenn nichts eingetragen ist. */
export function wissenAlsText(): string {
  const mitInhalt = liste.filter((w) => w.inhalt.trim())
  if (mitInhalt.length === 0) return ''
  return mitInhalt.map((w) => `## ${w.titel}\n${w.inhalt.trim()}`).join('\n\n')
}
