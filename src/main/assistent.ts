/*
 * KI-Assistent in der App (16. September 2026, Auftraggeber: "eine KI, die man rund um die App fragen kann und die
 * wirklich alles drauf hat"): Fragen gehen über die Claude-API an das Modell KI_MODELL. Als Wissen bekommt es die
 * komplette Anleitung (README.md, beim Bauen eingebettet), die Änderungsliste und einen kurzen aktuellen Stand der
 * App (Version, Fokus, heutige Stunden, Einstellungen). Der API-Schlüssel kommt vom Nutzer (Einstellungen →
 * KI-Assistent), liegt verschlüsselt im Datenordner (safeStorage wie die Anmeldung) und verlässt den Rechner nur
 * Richtung api.anthropic.com. Ohne Schlüssel gibt es eine klare Meldung statt einer Antwort.
 */
import Anthropic from '@anthropic-ai/sdk'
import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import anleitung from '../../README.md?raw'
import { AENDERUNGEN } from '@shared/aenderungen'
import { AUSZEICHNUNGEN, AUSZEICHNUNG_GRUPPEN, AUSZEICHNUNG_REIHENFOLGE } from '@shared/auszeichnungen'
import { LIGA_FAKTOR, LIGA_MAX_DELTA, LIGA_MIN_DELTA, LIGA_NEUTRAL_ABSTAND, LIGA_START_DATUM, LIGEN } from '@shared/liga'
import { MAX_RANG, RANG_NAMEN, RANG_ZIEL, STANDARD_GESAMTZIEL, rangSchwelle } from '@shared/rang'
import type { KiNachricht } from '@shared/typen'
import { wissenAlsText, wissenLaden } from './wissen'

export const KI_MODELL = 'claude-opus-5'
/** So viele Nachrichten des Gesprächs gehen mit (die letzten), damit die Anfrage klein bleibt. */
const MAX_VERLAUF = 12

function schluesselDatei(): string {
  return join(app.getPath('userData'), 'ki-schluessel.bin')
}

function verschluesselungVerfuegbar(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function schluesselLesen(): string | null {
  const pfad = schluesselDatei()
  if (!existsSync(pfad)) return null
  try {
    const roh = readFileSync(pfad)
    const text = verschluesselungVerfuegbar() ? safeStorage.decryptString(roh) : roh.toString('utf8')
    return text.trim() || null
  } catch (fehler) {
    console.error('KI-Schlüssel lesen:', fehler)
    return null
  }
}

export function schluesselSetzen(text: string): void {
  const sauber = text.trim()
  if (!sauber) throw new Error('Bitte den Schlüssel einfügen.')
  if (!/^sk-ant-/.test(sauber)) throw new Error('Das sieht nicht wie ein Anthropic-Schlüssel aus (er beginnt mit sk-ant-).')
  const pfad = schluesselDatei()
  mkdirSync(dirname(pfad), { recursive: true })
  const inhalt = verschluesselungVerfuegbar() ? safeStorage.encryptString(sauber) : Buffer.from(sauber, 'utf8')
  writeFileSync(pfad, inhalt)
}

export function schluesselEntfernen(): void {
  const pfad = schluesselDatei()
  if (existsSync(pfad)) unlinkSync(pfad)
}

export function eingerichtet(): boolean {
  return schluesselLesen() !== null
}

/** Ränge, Ligen und Auszeichnungen aus denselben Konstanten wie die App, damit der Assistent nie veraltete Zahlen nennt. */
function spielregelnText(): string {
  const z: string[] = []
  z.push('# Ränge (je Woche, aus produktiven Stunden)')
  z.push(`Rang 1 bis ${RANG_ZIEL}: alle 5 produktive Stunden ein Rang, Rang ${RANG_ZIEL} = ${STANDARD_GESAMTZIEL} Stunden = Wochenziel (Standard). Rang ${RANG_ZIEL + 1} bis ${MAX_RANG}: alle 2 Stunden ein Rang. Rang 0 = noch kein Rang (unter 5 Stunden). Der Rang beginnt jede Woche (Montag) bei 0.`)
  for (let r = 1; r <= MAX_RANG; r++) {
    const stufe = r <= 3 ? 'Bronze' : r <= 6 ? 'Silber' : r <= 9 ? 'Gold' : r === 10 ? 'Champion (orange)' : 'Diamant'
    z.push(`- Rang ${r} „${RANG_NAMEN[r]}“ ab ${rangSchwelle(r) / 3600} Stunden (${stufe})`)
  }
  z.push('')
  z.push('# Liga (Langzeit über alle Wochen)')
  z.push(
    `Je abgeschlossener Woche: Trophäen = (produktive Stunden − (Wochenziel − ${LIGA_NEUTRAL_ABSTAND})) × ${LIGA_FAKTOR}, höchstens ${LIGA_MAX_DELTA} dazu und höchstens ${Math.abs(LIGA_MIN_DELTA)} weg. Bei 50 Stunden Ziel ist der neutrale Punkt 40 Stunden. Wochen ohne einen einzigen Block zählen nicht. Urlaubstage senken den neutralen Punkt anteilig (7 Urlaubstage = die Woche kostet nichts). Der Stand fällt nie unter 0. Gezählt wird seit dem ${LIGA_START_DATUM}. Es gibt keine Rücksetzung.`
  )
  for (const l of LIGEN) if (l.index > 0) z.push(`- ${l.name} ab ${l.ab} Trophäen`)
  z.push('')
  z.push('# Auszeichnungen (Medaillen, bleiben für immer)')
  for (const g of AUSZEICHNUNG_GRUPPEN) {
    z.push(`Gruppe „${g.titel}“ (${g.hinweis})`)
    for (const typ of AUSZEICHNUNG_REIHENFOLGE) {
      const a = AUSZEICHNUNGEN[typ]
      if (a.gruppe === g.id) z.push(`- ${a.titel}: ${a.text}`)
    }
  }
  return z.join('\n')
}

/** Der feste Teil des Systemprompts: Rolle, Regeln, Anleitung, Spielregeln, Änderungsliste. Bleibt je Version gleich und wird zwischengespeichert. */
const SYSTEM_FEST = [
  'Du heißt Tempo und bist der eingebaute Assistent der Desktop-App "wessamedia Zeit", der Zeiterfassung der Werbeagentur wessamedia (Wessa und Stoner GmbH; drei Personen: Moritz unter Windows, Filipo und Leon am Mac).',
  'Du hilfst bei allen Fragen rund um die App (was ein Knopf macht, wie man etwas einträgt oder korrigiert, was Ränge, Liga, Fokus, Medaillen bedeuten, warum etwas so angezeigt wird, was bei Problemen zu tun ist) und rund um wessamedia (Team, Rollen, Leistungen, Kunden, Abläufe), soweit es im Abschnitt „Wissen über wessamedia“ steht.',
  'Regeln: Antworte auf Deutsch und per du. Kurz und konkret, sag genau, wo man klicken muss (zum Beispiel „Einstellungen → Tätigkeiten und Symbole“). Keine Fachbegriffe, keine Codewörter, keine Dateinamen, außer jemand fragt danach.',
  'Deine Quellen sind ausschließlich: die Anleitung, die Spielregeln, die Änderungsliste, das Wissen über wessamedia und der aktuelle Stand unten. Erfinde keine Funktionen, keine Kunden, keine Preise. Wenn etwas dort nicht steht, sag ehrlich, dass du es nicht weißt, und schlag vor, Moritz zu fragen (er betreut die App zusammen mit Claude) oder es unter Einstellungen → KI-Assistent → Wissen über wessamedia einzutragen, damit du es beim nächsten Mal weißt.',
  'Zahlen aus dem aktuellen Stand (Stunden, Rang, Fokus) darfst du direkt nennen und einordnen (zum Beispiel wie viele Stunden bis zum nächsten Rang fehlen). Für alles, was du nicht siehst (einzelne Blöcke, Fenstertitel, Daten der anderen), verweise auf den passenden Screen.',
  'Nutze kurze Absätze oder eine kurze Aufzählung; keine Überschriften. Bei Schritt-für-Schritt-Anleitungen nummerierte Schritte.',
  '',
  '# Anleitung der App (README)',
  anleitung,
  '',
  spielregelnText(),
  '',
  '# Änderungsliste (neueste zuerst)',
  ...AENDERUNGEN.map((a) => `Version ${a.version} (${a.datum}): ${a.titel}\n${a.punkte.map((p) => `- ${p}`).join('\n')}`)
].join('\n')

function fehlerErklaeren(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) return new Error('Der Schlüssel wird nicht angenommen. Unter Einstellungen → KI-Assistent prüfen oder neu einfügen.')
  if (e instanceof Anthropic.PermissionDeniedError) return new Error('Der Schlüssel darf dieses Modell nicht nutzen. Im Anthropic-Konto prüfen.')
  if (e instanceof Anthropic.RateLimitError) return new Error('Gerade zu viele Anfragen. Einen Moment warten und noch einmal fragen.')
  if (e instanceof Anthropic.BadRequestError) {
    const text = e.message.toLowerCase()
    if (text.includes('credit') || text.includes('balance')) return new Error('Das Guthaben im Anthropic-Konto ist aufgebraucht. Unter console.anthropic.com aufladen.')
    return new Error('Die Anfrage wurde abgelehnt: ' + e.message)
  }
  if (e instanceof Anthropic.APIConnectionError) return new Error('Keine Verbindung zu Anthropic. Internet prüfen und noch einmal versuchen.')
  if (e instanceof Anthropic.APIError) return new Error(`Anthropic meldet einen Fehler (${e.status ?? '?'}): ${e.message}`)
  return e instanceof Error ? e : new Error(String(e))
}

/**
 * Beantwortet die letzte Nutzerfrage im Verlauf. `kontext` ist der aktuelle Stand der App als Klartext (kommt aus
 * index.ts) und steht hinter dem zwischengespeicherten festen Teil, damit der Cache greift.
 */
export async function fragen(verlauf: KiNachricht[], kontext: string): Promise<string> {
  const schluessel = schluesselLesen()
  if (!schluessel) throw new Error('Noch kein Schlüssel hinterlegt. Unter Einstellungen → KI-Assistent einfügen.')
  const client = new Anthropic({ apiKey: schluessel, maxRetries: 1, timeout: 90_000 })
  const nachrichten: Anthropic.Beta.BetaMessageParam[] = verlauf
    .slice(-MAX_VERLAUF)
    .filter((n) => n.text.trim())
    .map((n) => ({ role: n.rolle === 'nutzer' ? 'user' : 'assistant', content: n.text.trim() }))
  if (nachrichten.length === 0 || nachrichten[nachrichten.length - 1].role !== 'user') throw new Error('Bitte eine Frage eingeben.')
  // Gemeinsames Wissen aus der Datenbank (höchstens alle 5 Minuten neu); eigener Cache-Block, weil es sich selten ändert.
  await wissenLaden().catch(() => undefined)
  const wissen = wissenAlsText()
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: SYSTEM_FEST, cache_control: { type: 'ephemeral' } },
    {
      type: 'text',
      text: `# Wissen über wessamedia (vom Team gepflegt)\n${wissen || 'Noch nichts eingetragen. Wer etwas über die Firma, das Team oder Kunden wissen will, kann es unter Einstellungen → KI-Assistent → Wissen über wessamedia eintragen.'}`,
      cache_control: { type: 'ephemeral' }
    },
    { type: 'text', text: `# Aktueller Stand der App\n${kontext}` }
  ]
  try {
    // Server-seitige Ausweichmodelle bei einer Sicherheitsablehnung (Standard laut Anthropic-Empfehlung für Opus 5).
    const antwort = await client.beta.messages.create({
      model: KI_MODELL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system,
      messages: nachrichten
    })
    if (antwort.stop_reason === 'refusal') return 'Das kann ich hier nicht beantworten.'
    const text = antwort.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    return text || 'Ich habe darauf keine Antwort bekommen. Bitte noch einmal anders fragen.'
  } catch (e) {
    throw fehlerErklaeren(e)
  }
}
