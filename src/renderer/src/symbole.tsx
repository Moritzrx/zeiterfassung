import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import {
  Book,
  Bot,
  Brain,
  Briefcase,
  Calendar,
  Camera,
  Car,
  ChartColumn,
  Clapperboard,
  Clock,
  Coffee,
  FileText,
  Film,
  Globe,
  GraduationCap,
  Headphones,
  Image,
  Lightbulb,
  ListChecks,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Mic,
  Monitor,
  Music,
  Newspaper,
  Palette,
  Pencil,
  Phone,
  Presentation,
  Scissors,
  Search,
  ShoppingCart,
  Smartphone,
  Tag,
  Target,
  Users,
  Video,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import {
  siAnthropic,
  siAsana,
  siClaude,
  siDavinciresolve,
  siFigma,
  siGmail,
  siGoogleads,
  siGooglechrome,
  siGoogledrive,
  siGooglegemini,
  siInstagram,
  siMeta,
  siNetflix,
  siNotion,
  siSpotify,
  siTiktok,
  siTwitch,
  siWhatsapp,
  siYoutube,
  type SimpleIcon
} from 'simple-icons'
import { taetigkeitSchluessel } from '@shared/regeln'
import type { SymbolInfo } from '@shared/typen'

/** Kuratierte lucide-Symbole mit deutschen Suchwörtern für die Auswahl in den Einstellungen. */
export const LUCIDE_SYMBOLE: Record<string, { Icon: LucideIcon; suche: string }> = {
  tag: { Icon: Tag, suche: 'Etikett Standard neutral' },
  brain: { Icon: Brain, suche: 'Gehirn KI Lernen Denken' },
  clapperboard: { Icon: Clapperboard, suche: 'Filmklappe Video Schnitt Videografie' },
  film: { Icon: Film, suche: 'Film Rolle Kino' },
  video: { Icon: Video, suche: 'Videokamera Aufnahme' },
  camera: { Icon: Camera, suche: 'Kamera Foto Dreh' },
  image: { Icon: Image, suche: 'Bild Foto Grafik' },
  scissors: { Icon: Scissors, suche: 'Schere Schnitt CapCut' },
  palette: { Icon: Palette, suche: 'Palette Design Farbe Canva' },
  pencil: { Icon: Pencil, suche: 'Stift Konzept Schreiben Text' },
  'file-text': { Icon: FileText, suche: 'Dokument Datei Angebot Rechnung' },
  'list-checks': { Icon: ListChecks, suche: 'Liste Häkchen Orga Aufgaben' },
  calendar: { Icon: Calendar, suche: 'Kalender Termin Planung' },
  clock: { Icon: Clock, suche: 'Uhr Zeit' },
  mail: { Icon: Mail, suche: 'Mail E-Mail Post' },
  'message-circle': { Icon: MessageCircle, suche: 'Chat Nachricht WhatsApp' },
  'message-square': { Icon: MessageSquare, suche: 'Chat Nachricht Slack Teams' },
  phone: { Icon: Phone, suche: 'Telefon Anruf Kundengespräch' },
  users: { Icon: Users, suche: 'Personen Kunde Termin Meeting' },
  briefcase: { Icon: Briefcase, suche: 'Aktenkoffer Business LinkedIn Vertrieb' },
  car: { Icon: Car, suche: 'Auto Fahrt Reise' },
  coffee: { Icon: Coffee, suche: 'Kaffee Pause' },
  globe: { Icon: Globe, suche: 'Welt Website Internet' },
  monitor: { Icon: Monitor, suche: 'Bildschirm Computer' },
  smartphone: { Icon: Smartphone, suche: 'Handy Smartphone Social' },
  megaphone: { Icon: Megaphone, suche: 'Megafon Werbung Ads Marketing' },
  target: { Icon: Target, suche: 'Ziel Zielscheibe Kampagne' },
  'chart-column': { Icon: ChartColumn, suche: 'Diagramm Auswertung Zahlen Analyse' },
  presentation: { Icon: Presentation, suche: 'Präsentation Pitch Vortrag' },
  lightbulb: { Icon: Lightbulb, suche: 'Idee Glühbirne Konzept' },
  'graduation-cap': { Icon: GraduationCap, suche: 'Lernen Kurs Weiterbildung' },
  book: { Icon: Book, suche: 'Buch Lesen Recherche' },
  search: { Icon: Search, suche: 'Suche Recherche' },
  newspaper: { Icon: Newspaper, suche: 'Zeitung News Presse' },
  mic: { Icon: Mic, suche: 'Mikrofon Podcast Aufnahme Ton' },
  headphones: { Icon: Headphones, suche: 'Kopfhörer Musik Audio' },
  music: { Icon: Music, suche: 'Musik Note' },
  'shopping-cart': { Icon: ShoppingCart, suche: 'Einkauf Shop Bestellung' },
  wrench: { Icon: Wrench, suche: 'Werkzeug Technik Einrichtung' },
  bot: { Icon: Bot, suche: 'Roboter KI ChatGPT OpenAI' }
}

/** Markenlogos aus simple-icons, Schlüssel = Kurzname der Marke. */
export const MARKEN: Record<string, SimpleIcon> = {
  instagram: siInstagram,
  tiktok: siTiktok,
  youtube: siYoutube,
  meta: siMeta,
  googleads: siGoogleads,
  davinciresolve: siDavinciresolve,
  asana: siAsana,
  notion: siNotion,
  whatsapp: siWhatsapp,
  figma: siFigma,
  googlechrome: siGooglechrome,
  gmail: siGmail,
  googledrive: siGoogledrive,
  netflix: siNetflix,
  twitch: siTwitch,
  anthropic: siAnthropic,
  claude: siClaude,
  googlegemini: siGooglegemini,
  spotify: siSpotify
}

/** Marken, die simple-icons nicht (mehr) enthält: passendes Ersatzsymbol in Weiß. */
export const MARKEN_ERSATZ: Record<string, LucideIcon> = {
  linkedin: Briefcase,
  adobepremierepro: Clapperboard,
  adobeaftereffects: Film,
  adobephotoshop: Image,
  capcut: Scissors,
  canva: Palette,
  slack: MessageSquare,
  openai: Bot
}

/** Marken, deren Markenfarbe auf dem fast schwarzen Grund unsichtbar wäre: in Weiß. */
const HELL = new Set(['tiktok', 'notion', 'anthropic', 'davinciresolve'])

const STANDARD: SymbolInfo = { typ: 'lucide', name: 'tag' }
const Kontext = createContext<Record<string, SymbolInfo>>({})

/** Lädt die Symbol-Zuordnung des Teams und stellt sie allen Screens bereit. */
export function SymbolProvider({ children }: { children: ReactNode }): ReactElement {
  const [zuordnung, setZuordnung] = useState<Record<string, SymbolInfo>>({})
  useEffect(() => {
    if (!window.api) return
    const laden = (): void => {
      void window.api.taetigkeiten.symbole().then(setZuordnung)
    }
    laden()
    return window.api.bloecke.onAenderung(laden)
  }, [])
  return <Kontext.Provider value={zuordnung}>{children}</Kontext.Provider>
}

export function useSymbol(name: string | null | undefined): SymbolInfo {
  const zuordnung = useContext(Kontext)
  if (!name) return STANDARD
  return zuordnung[taetigkeitSchluessel(name)] ?? STANDARD
}

/** Zeichnet ein Symbol: Markenlogo in Markenfarbe, sonst lucide in Weiß, unbekannt in Grau. */
export function SymbolBild({ symbol, groesse = 18 }: { symbol: SymbolInfo; groesse?: number }): ReactElement {
  if (symbol.typ === 'marke') {
    const marke = MARKEN[symbol.name]
    if (marke) {
      const farbe = HELL.has(symbol.name) ? '#F2F2F3' : `#${marke.hex}`
      return (
        <svg width={groesse} height={groesse} viewBox="0 0 24 24" role="img" aria-label={marke.title} className="shrink-0">
          <path d={marke.path} fill={farbe} />
        </svg>
      )
    }
    const Ersatz = MARKEN_ERSATZ[symbol.name] ?? Tag
    return <Ersatz size={groesse} strokeWidth={1.75} className="shrink-0 text-ink" />
  }
  const eintrag = LUCIDE_SYMBOLE[symbol.name]
  const Icon = eintrag?.Icon ?? Tag
  return <Icon size={groesse} strokeWidth={1.75} className={`shrink-0 ${eintrag ? 'text-ink' : 'text-dim'}`} />
}

/** Das Symbol einer Tätigkeit, überall gleich: in Listen, Legenden, Karten. */
export function TaetigkeitSymbol({ name, groesse = 18 }: { name: string | null | undefined; groesse?: number }): ReactElement {
  const symbol = useSymbol(name)
  return <SymbolBild symbol={symbol} groesse={groesse} />
}
