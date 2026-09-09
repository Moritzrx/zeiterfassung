/**
 * Fenstertitel lesbar machen: Bei Browsern steckt im Titel, welche Seite und welcher
 * Tab offen war ("Video-Titel - YouTube - Google Chrome"). Daraus werden Seite
 * ("YouTube") und Tab-Titel ("Video-Titel") getrennt, damit Listen und Postfach
 * zeigen, was genau gemacht wurde.
 */

export const BROWSER = ['Google Chrome', 'Microsoft Edge', 'Mozilla Firefox', 'Firefox', 'Safari', 'Opera', 'Brave', 'Arc']

export function istBrowser(programm: string | null | undefined): boolean {
  return !!programm && BROWSER.includes(programm)
}

export interface Fensterinfo {
  /** Die Seite oder Web-App, z. B. "YouTube", "Google Sheets"; null, wenn nicht erkennbar */
  seite: string | null
  /** Der eigentliche Tab- oder Dokumenttitel ohne Browser- und Seitenanhang */
  titel: string
}

/** Bekannte Seiten, damit die Schreibweise überall gleich ist. */
const SEITEN: Array<[RegExp, string]> = [
  [/youtube/i, 'YouTube'],
  [/google sheets|tabellen/i, 'Google Sheets'],
  [/google docs|google-docs/i, 'Google Docs'],
  [/google slides|präsentationen/i, 'Google Slides'],
  [/google drive/i, 'Google Drive'],
  [/gmail/i, 'Gmail'],
  [/google kalender|google calendar/i, 'Google Kalender'],
  [/google ads/i, 'Google Ads'],
  [/google suche|google search|^google$/i, 'Google Suche'],
  [/instagram/i, 'Instagram'],
  [/tiktok/i, 'TikTok'],
  [/facebook/i, 'Facebook'],
  [/linkedin/i, 'LinkedIn'],
  [/whatsapp/i, 'WhatsApp'],
  [/asana/i, 'Asana'],
  [/notion/i, 'Notion'],
  [/canva/i, 'Canva'],
  [/chatgpt|openai/i, 'ChatGPT'],
  [/claude/i, 'Claude'],
  [/supabase/i, 'Supabase'],
  [/github/i, 'GitHub'],
  [/^x$|twitter/i, 'X'],
  [/netflix/i, 'Netflix'],
  [/amazon/i, 'Amazon'],
  [/spotify/i, 'Spotify']
]

function seiteErkennen(text: string): string | null {
  for (const [muster, name] of SEITEN) if (muster.test(text)) return name
  return null
}

/** Browser-Anhang ("- Google Chrome", "- Persönlich - Microsoft Edge") und Zähler ("(3) ") entfernen. */
function bereinigen(titel: string): string {
  return titel
    .replace(/​/g, '')
    .replace(/\s[–—-]\s(Google Chrome|Microsoft Edge|Mozilla Firefox|Firefox|Safari|Opera|Brave|Arc)\s*$/i, '')
    .replace(/\s[–—-]\s(Persönlich|Personal|Geschäftlich|Arbeit|Work|Profil \d+)\s*$/i, '')
    .replace(/^\(\d+\)\s*/, '')
    .trim()
}

export function fensterInfo(programm: string | null | undefined, fenstertitel: string | null | undefined): Fensterinfo {
  if (!fenstertitel) return { seite: null, titel: '' }
  if (!istBrowser(programm)) return { seite: null, titel: fenstertitel }
  const sauber = bereinigen(fenstertitel)
  const teile = sauber
    .split(/\s[–—-]\s|\s\|\s|\s[•·]\s/)
    .map((t) => t.trim())
    .filter(Boolean)
  if (teile.length === 0) return { seite: null, titel: sauber }
  if (teile.length === 1) {
    const seite = seiteErkennen(teile[0])
    return seite && seite.toLowerCase() === teile[0].toLowerCase() ? { seite, titel: '' } : { seite, titel: teile[0] }
  }
  const letzter = teile[teile.length - 1]
  const seite = seiteErkennen(letzter) ?? (letzter.length <= 30 ? letzter : null)
  const titel = seite ? teile.slice(0, -1).join(' · ') : teile.join(' · ')
  return { seite, titel }
}

/** Kurzform für Listen: "YouTube" oder null. Für Gruppierung im Postfach. */
export function seiteVon(programm: string | null | undefined, fenstertitel: string | null | undefined): string | null {
  return fensterInfo(programm, fenstertitel).seite
}
