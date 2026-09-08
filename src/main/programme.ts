/**
 * Windows und Mac liefern für dasselbe Programm verschiedene Namen
 * (z. B. "chrome.exe" gegenüber "Google Chrome"). Diese Tabelle bringt
 * beides auf einen Namen, bevor Regeln greifen.
 */
const TABELLE: Record<string, string> = {
  chrome: 'Google Chrome',
  'google chrome': 'Google Chrome',
  msedge: 'Microsoft Edge',
  'microsoft edge': 'Microsoft Edge',
  firefox: 'Firefox',
  'mozilla firefox': 'Firefox',
  safari: 'Safari',
  opera: 'Opera',
  brave: 'Brave',
  arc: 'Arc',
  code: 'Visual Studio Code',
  'visual studio code': 'Visual Studio Code',
  explorer: 'Windows Explorer',
  'windows explorer': 'Windows Explorer',
  finder: 'Finder',
  outlook: 'Microsoft Outlook',
  olk: 'Microsoft Outlook',
  'microsoft outlook': 'Microsoft Outlook',
  teams: 'Microsoft Teams',
  'ms-teams': 'Microsoft Teams',
  'microsoft teams': 'Microsoft Teams',
  'premiere pro': 'Adobe Premiere Pro',
  'adobe premiere pro': 'Adobe Premiere Pro',
  afterfx: 'Adobe After Effects',
  'after effects': 'Adobe After Effects',
  'adobe after effects': 'Adobe After Effects',
  photoshop: 'Adobe Photoshop',
  'adobe photoshop': 'Adobe Photoshop',
  lightroom: 'Adobe Lightroom',
  'adobe lightroom': 'Adobe Lightroom',
  'adobe lightroom classic': 'Adobe Lightroom',
  'adobe media encoder': 'Adobe Media Encoder',
  resolve: 'DaVinci Resolve',
  'davinci resolve': 'DaVinci Resolve',
  capcut: 'CapCut',
  filmora: 'Wondershare Filmora',
  'wondershare filmora': 'Wondershare Filmora',
  slack: 'Slack',
  discord: 'Discord',
  spotify: 'Spotify',
  steam: 'Steam',
  netflix: 'Netflix',
  notion: 'Notion',
  whatsapp: 'WhatsApp',
  zoom: 'Zoom',
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  canva: 'Canva',
  figma: 'Figma',
  obs64: 'OBS Studio',
  obs: 'OBS Studio',
  'obs studio': 'OBS Studio',
  winword: 'Microsoft Word',
  'microsoft word': 'Microsoft Word',
  excel: 'Microsoft Excel',
  'microsoft excel': 'Microsoft Excel',
  powerpnt: 'Microsoft PowerPoint',
  'microsoft powerpoint': 'Microsoft PowerPoint',
  notepad: 'Editor',
  editor: 'Editor',
  textedit: 'TextEdit',
  terminal: 'Terminal',
  'windows terminal': 'Terminal',
  windowsterminal: 'Terminal',
  applicationframehost: 'Windows-App'
}

/**
 * Normalisiert einen rohen Programmnamen: ".exe" weg, Jahreszahl und
 * "(Beta)" am Ende weg, dann Tabelle. Unbekannte Namen bleiben wie sie sind.
 */
export function programmNormalisieren(roh: string | null | undefined): string | null {
  if (!roh) return null
  const bereinigt = roh.trim().replace(/\.exe$/i, '')
  if (!bereinigt) return null
  const schluessel = bereinigt
    .toLowerCase()
    .replace(/\s+\(beta\)$/i, '')
    .replace(/\s+\d{4}$/, '')
    .trim()
  return TABELLE[schluessel] ?? bereinigt
}
