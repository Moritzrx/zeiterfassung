/*
 * Die Töne der App. Alle Klänge entstehen mit der Web-Audio-API direkt im Fenster,
 * es gibt keine Audiodateien: kurze Sinus- und Dreieckstöne mit weichem Ein- und
 * Ausschwingen, dazu ein Hauch gefiltertes Rauschen für Klick und Wischen. Ein kleiner
 * Hall (Verzögerung mit Rückkopplung, tiefpassgefiltert) gibt Aufstieg und Auszeichnung Raum.
 * Ein- und Ausschalten sowie die Lautstärke liegen in localStorage (toene.an, toene.lautstaerke).
 */

export type Ton = 'tick' | 'wischen' | 'oeffnen' | 'schliessen' | 'erfolg' | 'auszeichnung' | 'aufstieg'

export interface ToneEinstellung {
  an: boolean
  /** 0 bis 1 */
  lautstaerke: number
}

const SCHLUESSEL_AN = 'toene.an'
const SCHLUESSEL_LAUT = 'toene.lautstaerke'
const STANDARD: ToneEinstellung = { an: true, lautstaerke: 0.5 }

let kontext: AudioContext | null = null
let master: GainNode | null = null
let hallEingang: GainNode | null = null
let rauschPuffer: AudioBuffer | null = null
let letzterTick = 0

export function toneEinstellung(): ToneEinstellung {
  try {
    const an = localStorage.getItem(SCHLUESSEL_AN)
    const laut = localStorage.getItem(SCHLUESSEL_LAUT)
    return {
      an: an === null ? STANDARD.an : an === '1',
      lautstaerke: laut === null ? STANDARD.lautstaerke : Math.max(0, Math.min(1, Number(laut)))
    }
  } catch {
    return STANDARD
  }
}

export function toneEinstellungSetzen(neu: Partial<ToneEinstellung>): ToneEinstellung {
  const alt = toneEinstellung()
  const ergebnis = { ...alt, ...neu }
  try {
    localStorage.setItem(SCHLUESSEL_AN, ergebnis.an ? '1' : '0')
    localStorage.setItem(SCHLUESSEL_LAUT, String(ergebnis.lautstaerke))
  } catch {
    /* localStorage nicht verfügbar */
  }
  if (master) master.gain.value = ergebnis.lautstaerke
  return ergebnis
}

/** Baut den Audio-Graphen beim ersten Ton auf: Master-Lautstärke und der kleine Hall. */
function bereit(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!kontext) {
    kontext = new AudioContext()
    master = kontext.createGain()
    master.gain.value = toneEinstellung().lautstaerke
    master.connect(kontext.destination)

    hallEingang = kontext.createGain()
    const verzoegerung = kontext.createDelay(1)
    verzoegerung.delayTime.value = 0.16
    const rueckkopplung = kontext.createGain()
    rueckkopplung.gain.value = 0.34
    const tiefpass = kontext.createBiquadFilter()
    tiefpass.type = 'lowpass'
    tiefpass.frequency.value = 2600
    const hallPegel = kontext.createGain()
    hallPegel.gain.value = 0.4
    hallEingang.connect(verzoegerung)
    verzoegerung.connect(tiefpass)
    tiefpass.connect(rueckkopplung)
    rueckkopplung.connect(verzoegerung)
    tiefpass.connect(hallPegel)
    hallPegel.connect(master)
  }
  if (kontext.state === 'suspended') void kontext.resume()
  return kontext
}

interface TonOptionen {
  typ?: OscillatorType
  von: number
  bis?: number
  /** Beginn in Sekunden ab jetzt */
  start?: number
  dauer: number
  pegel?: number
  /** Einschwingzeit in Sekunden */
  anstieg?: number
  hall?: boolean
}

function ton(k: AudioContext, o: TonOptionen): void {
  const osz = k.createOscillator()
  osz.type = o.typ ?? 'sine'
  const g = k.createGain()
  const t0 = k.currentTime + (o.start ?? 0)
  const anstieg = o.anstieg ?? 0.006
  osz.frequency.setValueAtTime(o.von, t0)
  if (o.bis !== undefined && o.bis !== o.von) osz.frequency.exponentialRampToValueAtTime(o.bis, t0 + o.dauer)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(o.pegel ?? 0.2, t0 + anstieg)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dauer)
  osz.connect(g)
  g.connect(master!)
  if (o.hall && hallEingang) g.connect(hallEingang)
  osz.start(t0)
  osz.stop(t0 + o.dauer + 0.05)
}

interface RauschOptionen {
  start?: number
  dauer: number
  pegel: number
  filterVon: number
  filterBis?: number
  guete?: number
  anstieg?: number
}

function rauschen(k: AudioContext, o: RauschOptionen): void {
  if (!rauschPuffer) {
    rauschPuffer = k.createBuffer(1, k.sampleRate, k.sampleRate)
    const daten = rauschPuffer.getChannelData(0)
    for (let i = 0; i < daten.length; i++) daten[i] = Math.random() * 2 - 1
  }
  const quelle = k.createBufferSource()
  quelle.buffer = rauschPuffer
  const filter = k.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = o.guete ?? 1
  const g = k.createGain()
  const t0 = k.currentTime + (o.start ?? 0)
  filter.frequency.setValueAtTime(o.filterVon, t0)
  if (o.filterBis !== undefined) filter.frequency.exponentialRampToValueAtTime(o.filterBis, t0 + o.dauer)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(o.pegel, t0 + (o.anstieg ?? 0.01))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dauer)
  quelle.connect(filter)
  filter.connect(g)
  g.connect(master!)
  quelle.start(t0)
  quelle.stop(t0 + o.dauer + 0.05)
}

const KLAENGE: Record<Ton, (k: AudioContext) => void> = {
  // Ein sauberer, kurzer Tastenklick: ein fallender Sinus-Tupfer plus ein Hauch Rauschen.
  tick: (k) => {
    ton(k, { von: 1900, bis: 1250, dauer: 0.045, pegel: 0.11 })
    rauschen(k, { dauer: 0.025, pegel: 0.045, filterVon: 5200, filterBis: 3200, guete: 0.8 })
  },
  // Das Wischen beim Screen-Wechsel: ein weiches, aufsteigendes Rauschen mit leisem Ton darunter.
  wischen: (k) => {
    rauschen(k, { dauer: 0.24, pegel: 0.05, filterVon: 500, filterBis: 2800, guete: 1.4, anstieg: 0.05 })
    ton(k, { von: 420, bis: 660, dauer: 0.2, pegel: 0.035, anstieg: 0.04 })
  },
  oeffnen: (k) => {
    ton(k, { von: 520, dauer: 0.1, pegel: 0.07 })
    ton(k, { von: 780, start: 0.05, dauer: 0.14, pegel: 0.07 })
  },
  schliessen: (k) => {
    ton(k, { von: 780, dauer: 0.1, pegel: 0.06 })
    ton(k, { von: 520, start: 0.05, dauer: 0.14, pegel: 0.06 })
  },
  erfolg: (k) => {
    ton(k, { typ: 'triangle', von: 784, dauer: 0.28, pegel: 0.09, hall: true })
    ton(k, { typ: 'triangle', von: 1175, start: 0.09, dauer: 0.4, pegel: 0.09, hall: true })
  },
  // Ein Glitzern: vier schnelle, hohe Töne aufwärts mit Hall.
  auszeichnung: (k) => {
    ;[1319, 1568, 1976, 2637].forEach((f, i) => ton(k, { von: f, start: i * 0.07, dauer: 0.35, pegel: 0.06, hall: true }))
    ton(k, { typ: 'triangle', von: 659, start: 0.05, dauer: 0.6, pegel: 0.05, hall: true })
  },
  // Der Aufstieg: dumpfer Aufschlag, ein Wischen, dann ein Dreiklang aufwärts und ein glitzernder Schlussakkord.
  aufstieg: (k) => {
    ton(k, { von: 150, bis: 48, dauer: 0.4, pegel: 0.28, anstieg: 0.01 })
    rauschen(k, { dauer: 0.55, pegel: 0.06, filterVon: 220, filterBis: 2200, guete: 1.2, anstieg: 0.08 })
    ;[523, 659, 784, 1047].forEach((f, i) => ton(k, { typ: 'triangle', von: f, start: 0.28 + i * 0.13, dauer: 0.9, pegel: 0.11, hall: true }))
    ;[1047, 1319, 1568].forEach((f) => ton(k, { von: f, start: 0.85, dauer: 1.7, pegel: 0.065, anstieg: 0.03, hall: true }))
    ton(k, { von: 3136, start: 0.95, dauer: 1.3, pegel: 0.025, anstieg: 0.05, hall: true })
  }
}

/** Spielt einen Ton, wenn Töne eingeschaltet sind. Klicks höchstens alle 40 ms. */
export function tonSpielen(name: Ton): void {
  const e = toneEinstellung()
  if (!e.an || e.lautstaerke <= 0) return
  if (name === 'tick') {
    const jetzt = performance.now()
    if (jetzt - letzterTick < 40) return
    letzterTick = jetzt
  }
  const k = bereit()
  if (!k) return
  try {
    KLAENGE[name](k)
  } catch {
    /* Audio nicht verfügbar */
  }
}

/** Zum Probehören in den Einstellungen: spielt unabhängig vom Schalter, aber mit der Lautstärke. */
export function tonProbe(name: Ton, lautstaerke: number): void {
  const k = bereit()
  if (!k || !master) return
  master.gain.value = lautstaerke
  try {
    KLAENGE[name](k)
  } catch {
    /* Audio nicht verfügbar */
  }
}

/** Welche Elemente beim Drücken klicken sollen. */
const KLICKBAR = 'button:not(:disabled), [role="button"], .druckbar, a[href], select, input[type="checkbox"], input[type="radio"]'

/** Hängt den Klick-Ton an alle Knöpfe und klickbaren Zeilen; liefert die Abmeldefunktion. */
export function klickToeneEinrichten(): () => void {
  const handler = (e: PointerEvent): void => {
    if (e.button !== 0) return
    const ziel = e.target as Element | null
    if (!ziel || !ziel.closest(KLICKBAR)) return
    // Knöpfe mit data-stumm (z. B. Probehören) klicken nicht, sonst überlagert der Klick den Probeton.
    if (ziel.closest('[data-stumm]')) return
    tonSpielen('tick')
  }
  document.addEventListener('pointerdown', handler, true)
  return () => document.removeEventListener('pointerdown', handler, true)
}
