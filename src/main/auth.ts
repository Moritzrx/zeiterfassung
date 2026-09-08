import { ipcMain } from 'electron'
import type { AuthErgebnis, AuthStatus } from '@shared/api'
import { supabase, supabaseKonfiguriert } from './supabase'

export interface AuthHaken {
  /** Wird nach erfolgreicher Anmeldung aufgerufen. */
  onAngemeldet: (userId: string) => void
  /** Wird nach dem Abmelden aufgerufen. */
  onAbgemeldet: () => void
}

/** Übersetzt Fehlermeldungen von Supabase in verständliches Deutsch. */
function fehlerText(meldung: string): string {
  const m = meldung.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort stimmt nicht.'
  if (m.includes('email not confirmed')) {
    return 'Das Konto ist noch nicht bestätigt. Es muss im Supabase-Dashboard bestätigt werden.'
  }
  if (m.includes('fetch') || m.includes('network') || m.includes('enotfound') || m.includes('econn')) {
    return 'Keine Verbindung zur Datenbank. Bitte Internetverbindung prüfen.'
  }
  return 'Anmeldung fehlgeschlagen: ' + meldung
}

export async function authStatus(): Promise<AuthStatus> {
  const leer: AuthStatus = {
    konfiguriert: supabaseKonfiguriert(),
    angemeldet: false,
    userId: null,
    email: null,
    name: null
  }
  if (!leer.konfiguriert) return leer

  const { data } = await supabase().auth.getSession()
  const sitzung = data.session
  if (!sitzung) return leer

  let name: string | null = null
  try {
    const { data: profil } = await supabase()
      .from('profile')
      .select('name')
      .eq('user_id', sitzung.user.id)
      .maybeSingle()
    name = (profil as { name: string } | null)?.name ?? null
  } catch {
    // Offline: der Name bleibt vorerst leer, die Anmeldung gilt trotzdem.
  }

  return { ...leer, angemeldet: true, userId: sitzung.user.id, email: sitzung.user.email ?? null, name }
}

export function authIpcRegistrieren(haken: AuthHaken): void {
  ipcMain.handle('auth:status', () => authStatus())

  ipcMain.handle('auth:anmelden', async (_ereignis, email: string, passwort: string): Promise<AuthErgebnis> => {
    if (!supabaseKonfiguriert()) {
      return {
        ok: false,
        fehler: 'Die Zugangsdaten zu Supabase fehlen. Die Datei .env muss beim Bauen der App vorhanden sein.'
      }
    }
    try {
      const { data, error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: passwort })
      if (error) return { ok: false, fehler: fehlerText(error.message) }
      if (data.user) haken.onAngemeldet(data.user.id)
      return { ok: true, fehler: null }
    } catch (e) {
      return { ok: false, fehler: fehlerText(e instanceof Error ? e.message : String(e)) }
    }
  })

  ipcMain.handle('auth:abmelden', async (): Promise<void> => {
    haken.onAbgemeldet()
    try {
      // scope 'local' verwirft die Sitzung auch ohne Internet.
      await supabase().auth.signOut({ scope: 'local' })
    } catch {
      // Ohne Konfiguration gibt es nichts abzumelden.
    }
  })
}
