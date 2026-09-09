/*
 * Die Töne der App. Alle Klänge entstehen mit der Web-Audio-API direkt im Fenster,
 * es gibt keine Audiodateien: kurze Sinus- und Dreieckstöne mit weichem Ein- und
 * Ausschwingen, dazu ein Hauch gefiltertes Rauschen für Klick und Wischen. Ein kleiner
 * Hall (Verzögerung mit Rückkopplung, tiefpassgefiltert) gibt Aufstieg und Auszeichnung Raum.
 * Ein- und Ausschalten sowie die Lautstärke liegen in localStorage (toene.an, toene.lautstaerke).
 */

export type Ton = 'tick' | 'wischen' | 'oeffnen' | 'schliessen' | 'erfolg' | 'auszeichnung' | 'aufstieg'

/** Die Klick-Arten zur Auswahl in den Einstellungen; der Auftraggeber hört sie an und wählt (Claude kann nicht hören). */
export type KlickArt = 'tock' | 'pop' | 'tap' | 'fein' | 'keiner'

export const KLICK_ARTEN: { art: KlickArt; label: string; hinweis: string }[] = [
  { art: 'tock', label: 'Tock', hinweis: 'warm und tief, wie eine gute Taste' },
  { art: 'pop', label: 'Pop', hinweis: 'rund und kurz' },
  { art: 'tap', label: 'Tap', hinweis: 'dumpf, wie ein Tippen auf Filz' },
  { art: 'fein', label: 'Fein', hinweis: 'sehr leise und hell, wie Glas' },
  { art: 'keiner', label: 'Kein Klick', hinweis: 'nur Wischen, Aufstieg und Auszeichnungen' }
]

export interface ToneEinstellung {
  an: boolean
  /** 0 bis 1 */
  lautstaerke: number
  klick: KlickArt
}

const SCHLUESSEL_AN = 'toene.an'
const SCHLUESSEL_LAUT = 'toene.lautstaerke'
const SCHLUESSEL_KLICK = 'toene.klick'
const STANDARD: ToneEinstellung = { an: true, lautstaerke: 0.5, klick: 'tock' }

function klickArtLesen(wert: string | null): KlickArt {
  return KLICK_ARTEN.some((k) => k.art === wert) ? (wert as KlickArt) : STANDARD.klick
}

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
      lautstaerke: laut === null ? STANDARD.lautstaerke : Math.max(0, Math.min(1, Number(laut))),
      klick: klickArtLesen(localStorage.getItem(SCHLUESSEL_KLICK))
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
    localStorage.setItem(SCHLUESSEL_KLICK, ergebnis.klick)
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
  /** Filterart: bandpass (Standard) für Zischen, lowpass für weiches, dumpfes Rauschen */
  filter?: BiquadFilterType
  filterVon: number
  /** Ziel der Filterfrequenz; ohne `filterZurueck` am Ende erreicht, sonst nach 55 % der Dauer */
  filterBis?: number
  /** Filterfrequenz am Ende, wenn der Bogen wieder zurückgehen soll (auf und ab wie ein Wischen) */
  filterZurueck?: number
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
  filter.type = o.filter ?? 'bandpass'
  filter.Q.value = o.guete ?? 1
  const g = k.createGain()
  const t0 = k.currentTime + (o.start ?? 0)
  filter.frequency.setValueAtTime(o.filterVon, t0)
  if (o.filterBis !== undefined) {
    if (o.filterZurueck !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(o.filterBis, t0 + o.dauer * 0.55)
      filter.frequency.exponentialRampToValueAtTime(o.filterZurueck, t0 + o.dauer)
    } else {
      filter.frequency.exponentialRampToValueAtTime(o.filterBis, t0 + o.dauer)
    }
  }
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(o.pegel, t0 + (o.anstieg ?? 0.01))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dauer)
  quelle.connect(filter)
  filter.connect(g)
  g.connect(master!)
  quelle.start(t0)
  quelle.stop(t0 + o.dauer + 0.05)
}

/*
 * Die Klick-Arten. Die ersten beiden Fassungen (heller Sinus 1900→1250 Hz, dann 1400→950 Hz) gefielen
 * dem Auftraggeber nicht; deshalb mehrere Arten zur Auswahl, alle kurz und ohne scharfe Höhen.
 */
const KLICKS: Record<KlickArt, (k: AudioContext) => void> = {
  // Warm und tief: ein schneller Tonfall von 520 auf 300 Hz plus ein winziger dumpfer Anschlag.
  tock: (k) => {
    ton(k, { von: 520, bis: 300, dauer: 0.055, pegel: 0.1, anstieg: 0.002 })
    rauschen(k, { dauer: 0.016, pegel: 0.04, filter: 'lowpass', filterVon: 1500, filterBis: 500, guete: 0.5, anstieg: 0.002 })
  },
  // Rund und kurz: ein Sinus von 800 auf 420 Hz, wie eine Blase.
  pop: (k) => {
    ton(k, { von: 800, bis: 420, dauer: 0.04, pegel: 0.09, anstieg: 0.003 })
  },
  // Dumpf wie Filz: fast nur ein tiefes, sehr kurzes Rauschen plus ein Hauch Grundton.
  tap: (k) => {
    rauschen(k, { dauer: 0.03, pegel: 0.07, filter: 'lowpass', filterVon: 900, filterBis: 300, guete: 0.6, anstieg: 0.002 })
    ton(k, { von: 220, bis: 160, dauer: 0.04, pegel: 0.05, anstieg: 0.002 })
  },
  // Sehr leise und hell, wie ein Fingernagel auf Glas.
  fein: (k) => {
    ton(k, { von: 2200, dauer: 0.03, pegel: 0.025 })
    ton(k, { von: 3300, dauer: 0.02, pegel: 0.012 })
  },
  keiner: () => {}
}

const KLAENGE: Record<Ton, (k: AudioContext) => void> = {
  // Der Klick in der gewählten Art.
  tick: (k) => KLICKS[toneEinstellung().klick](k),
  // Das Wischen beim Screen-Wechsel, auf die 380 ms des Übergangs abgestimmt: weiches, tiefes Luftrauschen
  // (Tiefpass, öffnet sich bis 1,1 kHz und schließt wieder), darunter ein sehr leiser, sanft steigender Ton.
  // Bewusst ohne Höhen und mit langsamem Einschwingen, die erste Fassung war zu hell und scharf.
  wischen: (k) => {
    rauschen(k, { dauer: 0.36, pegel: 0.032, filter: 'lowpass', filterVon: 220, filterBis: 1100, filterZurueck: 260, guete: 0.6, anstieg: 0.09 })
    ton(k, { von: 260, bis: 330, dauer: 0.3, pegel: 0.018, anstieg: 0.08 })
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

/** Eine bestimmte Klick-Art probehören, unabhängig von der gewählten. */
export function klickProbe(art: KlickArt, lautstaerke: number): void {
  const k = bereit()
  if (!k || !master) return
  master.gain.value = lautstaerke
  try {
    KLICKS[art](k)
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
