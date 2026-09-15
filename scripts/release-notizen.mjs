// Gibt die Änderungsliste einer Version als Markdown aus, für die GitHub-Veröffentlichung
// (der Ablauf installer.yml legt sie als Beschreibung an; die App zeigt sie in der Update-Leiste).
// Aufruf: node scripts/release-notizen.mjs 1.0.48   (auch "v1.0.48" erlaubt)
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const version = (process.argv[2] ?? '').replace(/^v/, '')
const datei = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shared', 'aenderungen.json')
const liste = JSON.parse(readFileSync(datei, 'utf8'))
const eintrag = liste.find((a) => a.version === version)

if (!eintrag) {
  process.stdout.write(`## Version ${version}\n\nKeine Änderungsliste hinterlegt.\n`)
} else {
  const zeilen = [`## Version ${eintrag.version}: ${eintrag.titel}`, '']
  for (const p of eintrag.punkte) zeilen.push(`- ${p}`)
  zeilen.push('')
  process.stdout.write(zeilen.join('\n'))
}
