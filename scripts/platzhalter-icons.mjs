// Erzeugt graue Platzhalter für die Symbole in Menüleiste (Mac) und Infobereich (Windows),
// bis die echten Grafiken geliefert werden. Aufruf: node scripts/platzhalter-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ORDNER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'tray')

const TABELLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(puffer) {
  let c = 0xffffffff
  for (const b of puffer) c = TABELLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function abschnitt(typ, daten) {
  const laenge = Buffer.alloc(4)
  laenge.writeUInt32BE(daten.length)
  const inhalt = Buffer.concat([Buffer.from(typ, 'ascii'), daten])
  const pruefsumme = Buffer.alloc(4)
  pruefsumme.writeUInt32BE(crc32(inhalt))
  return Buffer.concat([laenge, inhalt, pruefsumme])
}

/** PNG mit Transparenz aus einer Funktion (x, y) -> [r, g, b, a]. */
function png(breite, hoehe, pixel) {
  const roh = Buffer.alloc((breite * 4 + 1) * hoehe)
  for (let y = 0; y < hoehe; y++) {
    const zeile = y * (breite * 4 + 1)
    roh[zeile] = 0
    for (let x = 0; x < breite; x++) {
      const [r, g, b, a] = pixel(x, y)
      roh.set([r, g, b, a], zeile + 1 + x * 4)
    }
  }
  const kopf = Buffer.alloc(13)
  kopf.writeUInt32BE(breite, 0)
  kopf.writeUInt32BE(hoehe, 4)
  kopf[8] = 8 // Bittiefe
  kopf[9] = 6 // Farbtyp RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    abschnitt('IHDR', kopf),
    abschnitt('IDAT', deflateSync(roh)),
    abschnitt('IEND', Buffer.alloc(0))
  ])
}

/** Gefüllter Kreis mit weichem Rand. */
function kreis(groesse, farbe) {
  const mitte = groesse / 2
  const radius = groesse / 2 - 1
  return png(groesse, groesse, (x, y) => {
    const abstand = Math.hypot(x + 0.5 - mitte, y + 0.5 - mitte)
    const deckung = Math.max(0, Math.min(1, radius - abstand + 0.5))
    return [...farbe, Math.round(255 * deckung)]
  })
}

mkdirSync(ORDNER, { recursive: true })
const GRAU = [142, 142, 147]
const SCHWARZ = [0, 0, 0]
writeFileSync(join(ORDNER, 'tray-win.png'), kreis(32, GRAU))
writeFileSync(join(ORDNER, 'tray-win-paused.png'), kreis(32, [90, 90, 96]))
// Grün (#00C076 wie "produktiv"), solange Zeit gezählt wird: Fokus oder "Ich bin weg" läuft.
writeFileSync(join(ORDNER, 'tray-win-fokus.png'), kreis(32, [0, 192, 118]))
writeFileSync(join(ORDNER, 'trayTemplate.png'), kreis(16, SCHWARZ))
writeFileSync(join(ORDNER, 'trayTemplate@2x.png'), kreis(32, SCHWARZ))
console.log('Platzhalter geschrieben nach', ORDNER)
