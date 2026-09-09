import type { Urlaub } from '@shared/typen'
import { supabase, supabaseKonfiguriert } from './supabase'

interface Zeile {
  id: string
  user_id: string
  von: string
  bis: string
  notiz: string | null
}

function vonZeile(z: Zeile): Urlaub {
  return { id: z.id, userId: z.user_id, von: z.von, bis: z.bis, notiz: z.notiz }
}

/** Die eigenen Urlaube aus der Datenbank, neueste zuerst. */
export async function urlaubListe(userId: string): Promise<Urlaub[]> {
  if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
  const { data, error } = await supabase().from('urlaub').select('id, user_id, von, bis, notiz').eq('user_id', userId).order('von', { ascending: false })
  if (error) {
    if (/urlaub/.test(error.message)) throw new Error('Für den Urlaub muss in Supabase einmal das Skript 9 (09_urlaub.sql) ausgeführt werden.')
    throw new Error('Datenbank nicht erreichbar: ' + error.message)
  }
  return ((data ?? []) as Zeile[]).map(vonZeile)
}

/** Urlaub eintragen. Kalendertage "JJJJ-MM-TT", bis muss von erreichen. */
export async function urlaubAnlegen(userId: string, von: string, bis: string, notiz: string | null): Promise<Urlaub> {
  if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(von) || !/^\d{4}-\d{2}-\d{2}$/.test(bis)) throw new Error('Bitte beide Tage angeben.')
  if (bis < von) throw new Error('Das Ende liegt vor dem Anfang.')
  const { data, error } = await supabase()
    .from('urlaub')
    .insert({ user_id: userId, von, bis, notiz: notiz?.trim() || null })
    .select('id, user_id, von, bis, notiz')
    .single()
  if (error) throw new Error('Datenbank nicht erreichbar: ' + error.message)
  return vonZeile(data as Zeile)
}

export async function urlaubLoeschen(id: string): Promise<void> {
  if (!supabaseKonfiguriert()) throw new Error('Keine Datenbank konfiguriert.')
  const { error } = await supabase().from('urlaub').delete().eq('id', id)
  if (error) throw new Error('Datenbank nicht erreichbar: ' + error.message)
}
