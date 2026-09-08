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
// Ältere Ausgabe der Bibliothek: enthält Marken, die aus der aktuellen entfernt wurden. Nur für den internen Gebrauch.
import {
  siAdobeaftereffects,
  siAdobelightroom,
  siAdobephotoshop,
  siAdobepremierepro,
  siCanva,
  siLinkedin,
  siOpenai,
  siSlack
} from 'simple-icons-13'
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
  palette: { Icon: Palette, suche: 'Palette Design Farbe' },
  pencil: { Icon: Pencil, suche: 'Stift Konzept Schreiben Text' },
  'file-text': { Icon: FileText, suche: 'Dokument Datei Angebot Rechnung' },
  'list-checks': { Icon: ListChecks, suche: 'Liste Häkchen Orga Aufgaben' },
  calendar: { Icon: Calendar, suche: 'Kalender Termin Planung' },
  clock: { Icon: Clock, suche: 'Uhr Zeit' },
  mail: { Icon: Mail, suche: 'Mail E-Mail Post' },
  'message-circle': { Icon: MessageCircle, suche: 'Chat Nachricht' },
  'message-square': { Icon: MessageSquare, suche: 'Chat Nachricht Teams' },
  phone: { Icon: Phone, suche: 'Telefon Anruf Kundengespräch' },
  users: { Icon: Users, suche: 'Personen Kunde Termin Meeting' },
  briefcase: { Icon: Briefcase, suche: 'Aktenkoffer Business Vertrieb' },
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
  bot: { Icon: Bot, suche: 'Roboter KI' }
}

/** Markenlogos, Schlüssel = Kurzname der Marke. */
export const MARKEN: Record<string, SimpleIcon> = {
  instagram: siInstagram,
  tiktok: siTiktok,
  youtube: siYoutube,
  meta: siMeta,
  googleads: siGoogleads,
  linkedin: siLinkedin,
  adobepremierepro: siAdobepremierepro,
  adobeaftereffects: siAdobeaftereffects,
  adobephotoshop: siAdobephotoshop,
  adobelightroom: siAdobelightroom,
  davinciresolve: siDavinciresolve,
  canva: siCanva,
  figma: siFigma,
  asana: siAsana,
  notion: siNotion,
  slack: siSlack,
  whatsapp: siWhatsapp,
  googlechrome: siGooglechrome,
  gmail: siGmail,
  googledrive: siGoogledrive,
  netflix: siNetflix,
  twitch: siTwitch,
  openai: siOpenai,
  anthropic: siAnthropic,
  claude: siClaude,
  googlegemini: siGooglegemini,
  spotify: siSpotify
}

/** Marken ohne Logo in der Bibliothek: passendes Ersatzsymbol in Weiß. */
export const MARKEN_ERSATZ: Record<string, LucideIcon> = {
  capcut: Scissors
}

/**
 * Anzeigefarbe je Marke. Meist die Markenfarbe; bei zu dunklen Marken eine
 * helle Variante, damit auf dem fast schwarzen Grund etwas zu sehen ist.
 */
export const MARKEN_FARBEN: Record<string, string> = {
  tiktok: '#69C9D0',
  notion: '#F2F2F3',
  anthropic: '#D97757',
  davinciresolve: '#5B8DEF',
  slack: '#E01E5A',
  openai: '#10A37F'
}

/** Farbpalette für Tätigkeiten ohne Marke, gedacht für Diagramme. */
export const PALETTE = ['#FE5303', '#2DD4BF', '#A78BFA', '#FBBF24', '#FB7185', '#38BDF8', '#A3E635', '#E879F9', '#F97316', '#34D399']

export function markenFarbe(marke: string): string | null {
  const si = MARKEN[marke]
  if (!si) return null
  return MARKEN_FARBEN[marke] ?? `#${si.hex}`
}

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

/** Die ganze Zuordnung, für Diagramme mit vielen Einträgen. */
export function useSymbolZuordnung(): Record<string, SymbolInfo> {
  return useContext(Kontext)
}

export function symbolFuer(zuordnung: Record<string, SymbolInfo>, name: string | null | undefined): SymbolInfo {
  if (!name) return STANDARD
  return zuordnung[taetigkeitSchluessel(name)] ?? STANDARD
}

export function useSymbol(name: string | null | undefined): SymbolInfo {
  return symbolFuer(useContext(Kontext), name)
}

/** Diagrammfarbe einer Tätigkeit: Markenfarbe, sonst Palette nach Position. */
export function taetigkeitFarbe(zuordnung: Record<string, SymbolInfo>, name: string, position: number): string {
  const symbol = symbolFuer(zuordnung, name)
  if (symbol.typ === 'marke') {
    const farbe = markenFarbe(symbol.name)
    if (farbe) return farbe
  }
  return PALETTE[position % PALETTE.length]
}

/** Zeichnet ein Symbol: Markenlogo in Markenfarbe, sonst lucide in Weiß, unbekannt in Grau. */
export function SymbolBild({ symbol, groesse = 18 }: { symbol: SymbolInfo; groesse?: number }): ReactElement {
  if (symbol.typ === 'marke') {
    const marke = MARKEN[symbol.name]
    if (marke) {
      return (
        <svg width={groesse} height={groesse} viewBox="0 0 24 24" role="img" aria-label={marke.title} className="shrink-0">
          <path d={marke.path} fill={markenFarbe(symbol.name) ?? '#F2F2F3'} />
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
