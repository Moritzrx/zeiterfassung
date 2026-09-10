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

/** Bekannte Seiten, damit die Schreibweise überall gleich ist. Speziellere Muster stehen vor allgemeinen. */
const SEITEN: Array<[RegExp, string]> = [
  [/youtube/i, 'YouTube'],
  [/google sheets|tabellen/i, 'Google Sheets'],
  [/google docs|google-docs/i, 'Google Docs'],
  [/google slides|präsentationen/i, 'Google Slides'],
  [/google drive/i, 'Google Drive'],
  [/google forms|google formulare/i, 'Google Forms'],
  [/google fotos|google photos/i, 'Google Fotos'],
  [/google keep/i, 'Google Keep'],
  [/google meet/i, 'Google Meet'],
  [/google maps/i, 'Google Maps'],
  [/google analytics/i, 'Google Analytics'],
  [/search console/i, 'Search Console'],
  [/tag manager/i, 'Google Tag Manager'],
  [/looker studio/i, 'Looker Studio'],
  [/google trends/i, 'Google Trends'],
  [/unternehmensprofil|google business|business profile/i, 'Google Unternehmensprofil'],
  [/gmail/i, 'Gmail'],
  [/google kalender|google calendar/i, 'Google Kalender'],
  [/google ads/i, 'Google Ads'],
  [/google suche|google search|^google$/i, 'Google Suche'],
  [/business suite|business-suite|meta business/i, 'Meta Business Suite'],
  [/werbeanzeigenmanager|ads manager|meta ads/i, 'Meta Ads'],
  [/instagram/i, 'Instagram'],
  [/tiktok/i, 'TikTok'],
  [/facebook/i, 'Facebook'],
  [/threads/i, 'Threads'],
  [/linkedin/i, 'LinkedIn'],
  [/pinterest/i, 'Pinterest'],
  [/snapchat/i, 'Snapchat'],
  [/whatsapp/i, 'WhatsApp'],
  [/telegram/i, 'Telegram'],
  [/asana/i, 'Asana'],
  [/notion/i, 'Notion'],
  [/trello/i, 'Trello'],
  [/clickup/i, 'ClickUp'],
  [/monday\.com/i, 'monday'],
  [/jira/i, 'Jira'],
  [/slack/i, 'Slack'],
  [/microsoft teams|\bteams\b/i, 'Microsoft Teams'],
  [/zoom/i, 'Zoom'],
  [/calendly/i, 'Calendly'],
  [/canva/i, 'Canva'],
  [/adobe express/i, 'Adobe Express'],
  [/capcut/i, 'CapCut'],
  [/figma/i, 'Figma'],
  [/miro/i, 'Miro'],
  [/frame\.io|frameio/i, 'Frame.io'],
  [/vimeo/i, 'Vimeo'],
  [/dropbox/i, 'Dropbox'],
  [/wetransfer/i, 'WeTransfer'],
  [/onedrive/i, 'OneDrive'],
  [/sharepoint/i, 'SharePoint'],
  [/outlook/i, 'Outlook'],
  [/icloud/i, 'iCloud'],
  [/chatgpt|openai/i, 'ChatGPT'],
  [/claude/i, 'Claude'],
  [/gemini/i, 'Gemini'],
  [/perplexity/i, 'Perplexity'],
  [/copilot/i, 'Copilot'],
  [/higgsfield/i, 'Higgsfield'],
  [/midjourney/i, 'Midjourney'],
  [/runway/i, 'Runway'],
  [/elevenlabs/i, 'ElevenLabs'],
  [/\bsuno\b/i, 'Suno'],
  [/deepl/i, 'DeepL'],
  [/supabase/i, 'Supabase'],
  [/github/i, 'GitHub'],
  [/vercel/i, 'Vercel'],
  [/stack overflow|stackoverflow/i, 'Stack Overflow'],
  [/shopify/i, 'Shopify'],
  [/wordpress/i, 'WordPress'],
  [/elementor/i, 'Elementor'],
  [/wix\b/i, 'Wix'],
  [/squarespace/i, 'Squarespace'],
  [/mailchimp/i, 'Mailchimp'],
  [/brevo/i, 'Brevo'],
  [/hubspot/i, 'HubSpot'],
  [/lexoffice/i, 'lexoffice'],
  [/sevdesk/i, 'sevDesk'],
  [/datev/i, 'DATEV'],
  [/paypal/i, 'PayPal'],
  [/stripe/i, 'Stripe'],
  [/fiverr/i, 'Fiverr'],
  [/upwork/i, 'Upwork'],
  [/freepik/i, 'Freepik'],
  [/envato/i, 'Envato'],
  [/shutterstock/i, 'Shutterstock'],
  [/unsplash/i, 'Unsplash'],
  [/pexels/i, 'Pexels'],
  [/artlist/i, 'Artlist'],
  [/epidemic sound/i, 'Epidemic Sound'],
  [/kleinanzeigen/i, 'Kleinanzeigen'],
  [/ebay/i, 'eBay'],
  [/^x$|twitter/i, 'X'],
  [/reddit/i, 'Reddit'],
  [/twitch/i, 'Twitch'],
  [/discord/i, 'Discord'],
  [/netflix/i, 'Netflix'],
  [/prime video/i, 'Prime Video'],
  [/disney/i, 'Disney+'],
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

export interface Anzeigename {
  /** Was vorne steht: im Browser die Seite ("YouTube"), sonst das Programm */
  haupt: string
  /** Kleiner daneben: im Browser der Browser selbst ("Google Chrome"), sonst null */
  neben: string | null
  /** Der Tab- oder Fenstertitel darunter, ohne Browser- und Seitenanhang; leer, wenn nichts übrig bleibt */
  titel: string
}

/**
 * Wie ein Block in Listen und auf der Gerade-Karte heißt: Im Browser steht die Seite vorne
 * ("YouTube · Google Chrome"), weil sie sagt, was gemacht wurde; der Browser ist nur das Werkzeug.
 * Ohne erkannte Seite bleibt das Programm vorne (auf dem Mac immer, dort gibt es keine Fenstertitel).
 */
export function anzeigeName(programm: string | null | undefined, fenstertitel: string | null | undefined): Anzeigename {
  const info = fensterInfo(programm, fenstertitel)
  const p = programm ?? 'Unbekanntes Programm'
  if (info.seite) return { haupt: info.seite, neben: p, titel: info.titel }
  return { haupt: p, neben: null, titel: info.titel }
}

/** Kurzform für Listen: "YouTube" oder null. Für Gruppierung im Postfach. */
export function seiteVon(programm: string | null | undefined, fenstertitel: string | null | undefined): string | null {
  return fensterInfo(programm, fenstertitel).seite
}
