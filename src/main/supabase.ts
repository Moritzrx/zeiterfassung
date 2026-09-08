import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Beide Werte kommen beim Bauen aus der .env (lokal) bzw. aus den GitHub-Secrets.
const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

export function supabaseKonfiguriert(): boolean {
  return SUPABASE_URL.startsWith('https://') && SUPABASE_KEY.length > 20
}

/**
 * Die Anmeldung wird im Datenordner der App gespeichert, damit man nach einem
 * Neustart angemeldet bleibt. Wo das System es kann, liegt sie verschlüsselt
 * (Windows: DPAPI, Mac: Schlüsselbund).
 */
type Speicher = Record<string, string>

function sitzungsDatei(): string {
  return join(app.getPath('userData'), 'sitzung.bin')
}

function verschluesselungVerfuegbar(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function lesen(): Speicher {
  const pfad = sitzungsDatei()
  if (!existsSync(pfad)) return {}
  try {
    const roh = readFileSync(pfad)
    const text = verschluesselungVerfuegbar() ? safeStorage.decryptString(roh) : roh.toString('utf8')
    return JSON.parse(text) as Speicher
  } catch {
    return {}
  }
}

function schreiben(daten: Speicher): void {
  const pfad = sitzungsDatei()
  mkdirSync(dirname(pfad), { recursive: true })
  const text = JSON.stringify(daten)
  const inhalt = verschluesselungVerfuegbar() ? safeStorage.encryptString(text) : Buffer.from(text, 'utf8')
  writeFileSync(pfad, inhalt)
}

const sitzungsSpeicher = {
  getItem: (schluessel: string): string | null => lesen()[schluessel] ?? null,
  setItem: (schluessel: string, wert: string): void => {
    const daten = lesen()
    daten[schluessel] = wert
    schreiben(daten)
  },
  removeItem: (schluessel: string): void => {
    const daten = lesen()
    delete daten[schluessel]
    schreiben(daten)
  }
}

let client: SupabaseClient | null = null

/** Der eine Supabase-Client der App. Erst nach app.whenReady() benutzen. */
export function supabase(): SupabaseClient {
  if (!client) {
    if (!supabaseKonfiguriert()) {
      throw new Error('Supabase ist nicht konfiguriert (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY fehlen).')
    }
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: sitzungsSpeicher,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  }
  return client
}
