import type { SymbolInfo } from './typen'

/**
 * Passendes Symbol für einen Tätigkeitsnamen (15. September 2026, "gib allen Tätigkeiten passende Icons"):
 * Neue Tätigkeiten bekommen damit automatisch ein Symbol statt des neutralen Etiketts, vorhandene mit Etikett
 * werden beim Laden einmal nachgezogen. Die Namen müssen in LUCIDE_SYMBOLE bzw. MARKEN (symbole.tsx) existieren.
 * Reihenfolge ist wichtig: speziellere Regeln (Teamcall vor Call, Google Ads vor Ads) stehen vorne.
 */
const REGELN: Array<{ muster: RegExp; symbol: SymbolInfo }> = [
  { muster: /instagram|insta\b|reels?\b/, symbol: { typ: 'marke', name: 'instagram' } },
  { muster: /tiktok|tik tok/, symbol: { typ: 'marke', name: 'tiktok' } },
  { muster: /youtube|yt\b|zyrix/, symbol: { typ: 'marke', name: 'youtube' } },
  { muster: /facebook|meta\b/, symbol: { typ: 'marke', name: 'meta' } },
  { muster: /google ?ads|adwords/, symbol: { typ: 'marke', name: 'googleads' } },
  { muster: /linkedin/, symbol: { typ: 'marke', name: 'linkedin' } },
  { muster: /canva/, symbol: { typ: 'marke', name: 'canva' } },
  { muster: /figma/, symbol: { typ: 'marke', name: 'figma' } },
  { muster: /photoshop/, symbol: { typ: 'marke', name: 'adobephotoshop' } },
  { muster: /premiere/, symbol: { typ: 'marke', name: 'adobepremierepro' } },
  { muster: /after ?effects/, symbol: { typ: 'marke', name: 'adobeaftereffects' } },
  { muster: /lightroom/, symbol: { typ: 'marke', name: 'adobelightroom' } },
  { muster: /davinci|resolve/, symbol: { typ: 'marke', name: 'davinciresolve' } },
  { muster: /\bki\b|künstlich|claude|chatgpt|openai|\bai\b/, symbol: { typ: 'lucide', name: 'brain' } },
  { muster: /teamcall|team-call|meeting|besprechung|jour ?fixe|standup|daily/, symbol: { typ: 'lucide', name: 'users' } },
  { muster: /kundentermin|kundenbesuch|vor ?ort|au(ß|ss)entermin/, symbol: { typ: 'lucide', name: 'handshake' } },
  { muster: /\bcall\b|telefon|anruf|phone/, symbol: { typ: 'lucide', name: 'phone' } },
  { muster: /briefing|absprache/, symbol: { typ: 'lucide', name: 'message-square' } },
  { muster: /nachricht|mail|antworten|kommunikation/, symbol: { typ: 'lucide', name: 'mail' } },
  { muster: /schneiden|schnitt|\bcut\b|editing|editieren/, symbol: { typ: 'lucide', name: 'scissors' } },
  { muster: /hochladen|upload|posten|veröffentlichen/, symbol: { typ: 'lucide', name: 'upload' } },
  // "Fahrt zum Dreh" ist eine Fahrt, "Grumbeere Dreh + Fahrt" ein Dreh: Fahrt gewinnt nur am Namensanfang.
  { muster: /fahrrad|\bbike\b|e-bike|radsport/, symbol: { typ: 'lucide', name: 'bike' } },
  { muster: /^fahrt|anreise|\bauto\b|unterwegs/, symbol: { typ: 'lucide', name: 'car' } },
  { muster: /\bdreh|filmen|shooting/, symbol: { typ: 'lucide', name: 'clapperboard' } },
  { muster: /videograf|kamera|foto/, symbol: { typ: 'lucide', name: 'camera' } },
  { muster: /video/, symbol: { typ: 'lucide', name: 'video' } },
  { muster: /fahrt|fahren/, symbol: { typ: 'lucide', name: 'car' } },
  { muster: /konzept|idee|content ?plan|kontent|strategie|planung/, symbol: { typ: 'lucide', name: 'lightbulb' } },
  { muster: /\borga|organisation|koordination|verwaltung|admin/, symbol: { typ: 'lucide', name: 'list-checks' } },
  { muster: /buchhaltung|rechnung|finanz|steuer|abrechnung|angebot/, symbol: { typ: 'lucide', name: 'calculator' } },
  { muster: /website|webseite|homepage|wordpress|\bweb\b|seo/, symbol: { typ: 'lucide', name: 'globe' } },
  { muster: /\bapp\b|entwicklung|software|code|programmier/, symbol: { typ: 'lucide', name: 'code' } },
  { muster: /learning|lernen|kurs|schulung|weiterbildung|tutorial/, symbol: { typ: 'lucide', name: 'graduation-cap' } },
  { muster: /\bads\b|werbung|anzeige|kampagne|marketing/, symbol: { typ: 'lucide', name: 'megaphone' } },
  { muster: /design|grafik|gestaltung|layout/, symbol: { typ: 'lucide', name: 'palette' } },
  { muster: /text|schreiben|copy|caption/, symbol: { typ: 'lucide', name: 'pencil' } },
  { muster: /recherche|research|suche/, symbol: { typ: 'lucide', name: 'search' } },
  { muster: /analyse|auswertung|zahlen|report|statistik/, symbol: { typ: 'lucide', name: 'chart-column' } },
  { muster: /präsentation|pitch|vortrag/, symbol: { typ: 'lucide', name: 'presentation' } },
  { muster: /angucken|anschauen|ansehen|sichten|review/, symbol: { typ: 'lucide', name: 'eye' } },
  { muster: /pause|kaffee|mittag/, symbol: { typ: 'lucide', name: 'coffee' } },
  { muster: /bowling|spiel|gaming|zocken/, symbol: { typ: 'lucide', name: 'gamepad' } },
  { muster: /podcast|audio|ton\b|voice/, symbol: { typ: 'lucide', name: 'mic' } },
  { muster: /allgemein|sonstiges|diverses/, symbol: { typ: 'lucide', name: 'briefcase' } }
]

/**
 * Feste Zuordnungen für Namen, die kein Stichwort enthalten (die Kundennamen des Teams als Tätigkeit). Vergleich
 * ohne Groß/Klein; greifen erst, wenn keine Tätigkeits-Regel passt ("Grumbeere Dreh" bleibt die Filmklappe).
 */
const FESTE: Array<{ muster: RegExp; symbol: SymbolInfo }> = [
  { muster: /lavendel/, symbol: { typ: 'lucide', name: 'leaf' } },
  { muster: /wine ?bank|wein/, symbol: { typ: 'lucide', name: 'wine' } },
  { muster: /quelle|wasser/, symbol: { typ: 'lucide', name: 'droplets' } },
  { muster: /blume|flower|garten/, symbol: { typ: 'lucide', name: 'flower' } },
  { muster: /grumbeere/, symbol: { typ: 'lucide', name: 'shopping-cart' } },
  { muster: /\bsiz\b|solar|photovoltaik/, symbol: { typ: 'lucide', name: 'sun' } },
  { muster: /bellari|sprinx|nuri|vollbrecht/, symbol: { typ: 'lucide', name: 'briefcase' } }
]

/** Liefert einen Vorschlag oder null, wenn kein Stichwort passt. */
export function symbolVorschlag(name: string): SymbolInfo | null {
  const n = name.toLowerCase()
  for (const r of REGELN) if (r.muster.test(n)) return { ...r.symbol }
  for (const r of FESTE) if (r.muster.test(n)) return { ...r.symbol }
  // Zwei Wörter, die wie ein Personenname aussehen (Vorname Nachname) → Person.
  if (/^[a-zäöüß]+ [a-zäöüß]+$/.test(n) && !/ und | mit /.test(n)) return { typ: 'lucide', name: 'user' }
  return null
}
