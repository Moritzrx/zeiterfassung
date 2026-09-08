// Erzeugt das App-Symbol build/icon.png (1024 × 1024) ohne Zusatzpakete:
// dunkles abgerundetes Quadrat, orangener Rang-Ring mit Lücke, grüner Punkt in der Lücke.
// Aufruf: node scripts/icon-erzeugen.mjs
// Wer ein eigenes Symbol hat, legt es einfach als build/icon.png (mindestens 1024 × 1024) ab.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const N = 1024
const SS = 4 // Unterabtastung je Achse für weiche Kanten

const HINTERGRUND = [0x15, 0x15, 0x17]
const ORANGE = [0xfe, 0x53, 0x03]
const GRUEN = [0x00, 0xc0, 0x76]

const MITTE = N / 2
const KANTE = 880 // Seitenlänge des abgerundeten Quadrats
const ECKE = 200 // Eckenradius
const RING_AUSSEN = 330
const RING_INNEN = 258
const RING_MITTE = (RING_AUSSEN + RING_INNEN) / 2
const RING_BREITE = RING_AUSSEN - RING_INNEN
const BOGEN_GRAD = 300 // der Ring ist zu fünf Sechsteln geschlossen
const PUNKT_RADIUS = 40

function imQuadrat(x, y) {
  const dx = Math.abs(x - MITTE)
  const dy = Math.abs(y - MITTE)
  const h = KANTE / 2
  if (dx > h || dy > h) return false
  if (dx <= h - ECKE || dy <= h - ECKE) return true
  const ex = dx - (h - ECKE)
  const ey = dy - (h - ECKE)
  return ex * ex + ey * ey <= ECKE * ECKE
}

/** Winkel im Uhrzeigersinn ab oben, 0 bis 360. */
function winkel(x, y) {
  const g = (Math.atan2(x - MITTE, MITTE - y) * 180) / Math.PI
  return g < 0 ? g + 360 : g
}

function punktAuf(grad) {
  const r = (grad * Math.PI) / 180
  return [MITTE + Math.sin(r) * RING_MITTE, MITTE - Math.cos(r) * RING_MITTE]
}

const [kappeAx, kappeAy] = punktAuf(0)
const [kappeBx, kappeBy] = punktAuf(BOGEN_GRAD)
const [punktX, punktY] = punktAuf(BOGEN_GRAD + (360 - BOGEN_GRAD) / 2)

function imRing(x, y) {
  const dx = x - MITTE
  const dy = y - MITTE
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d >= RING_INNEN && d <= RING_AUSSEN && winkel(x, y) <= BOGEN_GRAD) return true
  const kappe = RING_BREITE / 2
  const a = (x - kappeAx) ** 2 + (y - kappeAy) ** 2 <= kappe * kappe
  const b = (x - kappeBx) ** 2 + (y - kappeBy) ** 2 <= kappe * kappe
  return a || b
}

function imPunkt(x, y) {
  return (x - punktX) ** 2 + (y - punktY) ** 2 <= PUNKT_RADIUS * PUNKT_RADIUS
}

function farbe(x, y) {
  if (imPunkt(x, y)) return GRUEN
  if (imRing(x, y)) return ORANGE
  if (imQuadrat(x, y)) return HINTERGRUND
  return null
}

const bild = Buffer.alloc((N * 4 + 1) * N)
for (let y = 0; y < N; y++) {
  bild[y * (N * 4 + 1)] = 0 // Filter: keiner
  for (let x = 0; x < N; x++) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const f = farbe(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)
        if (!f) continue
        r += f[0]
        g += f[1]
        b += f[2]
        a += 1
      }
    }
    const o = y * (N * 4 + 1) + 1 + x * 4
    if (a === 0) continue
    bild[o] = Math.round(r / a)
    bild[o + 1] = Math.round(g / a)
    bild[o + 2] = Math.round(b / a)
    bild[o + 3] = Math.round((a / (SS * SS)) * 255)
  }
}

// PNG-Datei zusammensetzen
const crcTabelle = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTabelle[n] = c >>> 0
}
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTabelle[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(typ, daten) {
  const laenge = Buffer.alloc(4)
  laenge.writeUInt32BE(daten.length)
  const inhalt = Buffer.concat([Buffer.from(typ, 'ascii'), daten])
  const pruefsumme = Buffer.alloc(4)
  pruefsumme.writeUInt32BE(crc32(inhalt))
  return Buffer.concat([laenge, inhalt, pruefsumme])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(N, 0)
ihdr.writeUInt32BE(N, 4)
ihdr[8] = 8 // Bittiefe
ihdr[9] = 6 // Farbtyp RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(bild, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

mkdirSync('build', { recursive: true })
writeFileSync('build/icon.png', png)
console.log(`build/icon.png geschrieben, ${Math.round(png.length / 1024)} kB`)
