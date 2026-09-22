import { useState, type ReactElement } from 'react'
import { Skull, Trophy } from 'lucide-react'
import { kalenderwoche, datumZuTagesanfang } from '@shared/zeit'
import { Karte } from './Karte'
import { TrophaeenHalle } from './TrophaeenHalle'
import { bossBild, bossFarbe } from './bossBilder'
import { useBoss } from '../spiel'
import { stundenText } from '../format'

function initialen(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Boss der Woche (22. September 2026, Team-Spiel): ein Boss mit Lebensbalken aus Teamstunden, jede produktive Stunde
 * ist Schaden. Wer wie viel beigetragen hat, steht darunter. Am Sonntag um Mitternacht ist die Runde vorbei.
 */
export function BossKarte(): ReactElement {
  const { boss, fehler } = useBoss()
  const [halleOffen, setHalleOffen] = useState(false)

  if (fehler) {
    return (
      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Boss der Woche</p>
        <p className="mt-2 text-sm text-mute">{fehler}</p>
      </Karte>
    )
  }
  if (!boss) {
    return (
      <Karte>
        <p className="text-xs tracking-wide text-mute uppercase">Boss der Woche</p>
        <p className="mt-2 text-sm text-dim">Der Boss wird gerufen …</p>
      </Karte>
    )
  }

  const farbe = bossFarbe(boss.schluessel)
  const anteil = Math.min(1, boss.hpSekunden > 0 ? boss.schadenSekunden / boss.hpSekunden : 0)
  const rest = Math.max(0, boss.hpSekunden - boss.schadenSekunden)
  const kw = kalenderwoche(datumZuTagesanfang(boss.wocheStart))
  const status = boss.besiegt === true ? 'besiegt' : boss.besiegt === false ? 'ueberlebt' : 'laeuft'

  return (
    <Karte className={status === 'besiegt' ? 'ring-1 ring-produktiv/40' : ''}>
      {halleOffen && <TrophaeenHalle onSchliessen={() => setHalleOffen(false)} />}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs tracking-wide text-mute uppercase">Boss der Woche · KW {kw}</p>
        <button
          type="button"
          onClick={() => setHalleOffen(true)}
          className="flex items-center gap-1.5 rounded-chip bg-panel-2 px-2.5 py-1 text-xs text-ink transition-colors hover:bg-inaktiv"
          title="Alle besiegten und überlebten Bosse"
        >
          <Trophy size={13} strokeWidth={1.8} />
          Trophäenhalle · {boss.siege} {boss.siege === 1 ? 'Sieg' : 'Siege'}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: 132, height: 132 }}>
          <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${farbe}55, transparent 68%)` }} />
          <img
            src={bossBild(boss.schluessel)}
            alt=""
            draggable={false}
            className={`relative h-full w-full select-none transition-all duration-700 ${status === 'besiegt' ? 'grayscale-[0.6] opacity-70' : ''}`}
            style={{ filter: status === 'besiegt' ? undefined : `drop-shadow(0 0 14px ${farbe}88)` }}
          />
          {status === 'besiegt' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Skull size={54} strokeWidth={1.5} className="text-produktiv drop-shadow-[0_0_12px_rgba(0,192,118,0.8)]" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl leading-tight">{boss.name}</p>
          {boss.spruch && <p className="mt-1 text-sm text-mute italic">„{boss.spruch}“</p>}
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${anteil * 100}%`, background: `linear-gradient(90deg, ${farbe}, #00C076)`, boxShadow: '0 0 12px rgba(0,192,118,0.6)' }}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
            <span>
              <span className="text-produktiv">{stundenText(boss.schadenSekunden)} h</span> <span className="text-mute">von {stundenText(boss.hpSekunden)} h Schaden</span>
            </span>
            <span className="text-mute">
              {status === 'besiegt'
                ? 'Besiegt! Jeder im Team bekommt 60 Season-Punkte.'
                : status === 'ueberlebt'
                  ? 'Der Boss hat überlebt.'
                  : `Noch ${stundenText(rest)} h bis zum Sieg, bis Sonntag 24 Uhr`}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {boss.anteile.map((a) => {
          const breite = boss.hpSekunden > 0 ? Math.min(100, (a.sekunden / boss.hpSekunden) * 100) : 0
          return (
            <div key={a.userId} className="flex items-center gap-3">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${a.istIch ? 'bg-produktiv text-ground' : 'bg-panel-2 text-ink'}`}>
                {initialen(a.name)}
              </span>
              <span className="w-20 shrink-0 truncate text-sm">{a.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                <div className={`h-full rounded-full transition-[width] duration-500 ${a.istIch ? 'bg-produktiv' : 'bg-ink/70'}`} style={{ width: `${breite}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-sm tabular-nums">{stundenText(a.sekunden)} h</span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-dim">
        Jede produktive Stunde von euch dreien ist Schaden. Fällt der Boss bis Sonntag, bekommt jeder 60 Season-Punkte und der nächste wird
        etwas stärker. Überlebt er, wird der nächste etwas schwächer.
      </p>
    </Karte>
  )
}
