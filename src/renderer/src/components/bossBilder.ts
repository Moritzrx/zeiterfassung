import prokrastinator from '../assets/wappen/boss-prokrastinator.png'
import scrolldaemon from '../assets/wappen/boss-scrolldaemon.png'
import meetinghydra from '../assets/wappen/boss-meetinghydra.png'
import tabkraken from '../assets/wappen/boss-tabkraken.png'
import deadlinedrache from '../assets/wappen/boss-deadlinedrache.png'
import chaostitan from '../assets/wappen/boss-chaostitan.png'

/** Die Boss-Bilder (Higgsfield, 22. September 2026, 384 px mit Alphakanal wie die Wappen), Schlüssel wie in BOSSE. */
export const BOSS_BILDER: Record<string, string> = { prokrastinator, scrolldaemon, meetinghydra, tabkraken, deadlinedrache, chaostitan }

/** Farbe je Boss für Leuchten und Balken. */
export const BOSS_FARBEN: Record<string, string> = {
  prokrastinator: '#A78BFA',
  scrolldaemon: '#EC4899',
  meetinghydra: '#2DD4BF',
  tabkraken: '#38BDF8',
  deadlinedrache: '#FF4D4D',
  chaostitan: '#FE5303'
}

export function bossBild(schluessel: string): string {
  return BOSS_BILDER[schluessel] ?? chaostitan
}

export function bossFarbe(schluessel: string): string {
  return BOSS_FARBEN[schluessel] ?? '#FE5303'
}
