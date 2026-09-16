import { memo, useMemo, type ReactElement } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Block } from '@shared/typen'
import {
  besteSpanne,
  minutenJeStunde,
  minutenJeWochentagStunde,
  schwaechsteStunde,
  staerksterWochentag,
  stundenprofilBerechnen,
  WOCHENTAGE,
  WOCHENTAGE_KURZ
} from '@shared/stundenprofil'
import { zahlText } from '../format'
import { DiagrammTooltip } from './DiagrammTooltip'

interface Props {
  bloecke: Block[]
  vonMs: number
  bisMs: number
}

function minutenFormat(wert: number): string {
  return `${Math.round(wert)} min`
}

/**
 * "Wann du arbeitest" (16. September 2026): Balken je Stunde des Tages (Schnitt an Arbeitstagen) und darunter ein
 * Raster Wochentag × Stunde, jede Zelle umso grüner, je mehr produktive Zeit dort im Schnitt liegt. Darüber drei Sätze:
 * produktivste Phase, schwächste Stunde, stärkster Wochentag. Rechnet aus den lokalen Blöcken des Zeitraums.
 */
function StundenprofilInnen({ bloecke, vonMs, bisMs }: Props): ReactElement | null {
  const profil = useMemo(() => stundenprofilBerechnen(bloecke, vonMs, bisMs), [bloecke, vonMs, bisMs])
  const jeStunde = useMemo(() => minutenJeStunde(profil), [profil])
  const raster = useMemo(() => minutenJeWochentagStunde(profil), [profil])
  if (profil.arbeitstage === 0) return <p className="mt-3 text-sm text-dim">In diesem Zeitraum gibt es noch keine produktive Zeit.</p>

  const daten = jeStunde.map((minuten, h) => ({ label: String(h), titel: `${h} bis ${h + 1} Uhr, Schnitt je Arbeitstag`, produktiv: minuten }))
  const maxRaster = Math.max(1, ...raster.flat())
  const beste = besteSpanne(profil)
  const schwach = schwaechsteStunde(profil)
  const tag = staerksterWochentag(profil)
  // Erste und letzte Stunde mit nennenswerter Arbeit (ab 2 min je Arbeitstag), damit das Raster nicht 24 leere Spalten zeigt.
  let ersteStunde = jeStunde.findIndex((m) => m >= 2)
  let letzteStunde = 23 - [...jeStunde].reverse().findIndex((m) => m >= 2)
  if (ersteStunde < 0) ersteStunde = 7
  ersteStunde = Math.min(ersteStunde, 7)
  letzteStunde = Math.max(letzteStunde, 19)
  const stunden: number[] = []
  for (let h = ersteStunde; h <= letzteStunde; h++) stunden.push(h)

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-1 text-sm">
        {beste && (
          <p>
            <span className="text-produktiv">Am produktivsten</span> bist du zwischen {beste.von} und {beste.bis} Uhr, im Schnitt{' '}
            {Math.round(beste.minutenJeStunde)} Minuten je Stunde.
          </p>
        )}
        {schwach && (
          <p className="text-mute">
            Am wenigsten läuft zwischen {schwach.stunde} und {schwach.stunde + 1} Uhr ({Math.round(schwach.minuten)} Minuten).
          </p>
        )}
        {tag && (
          <p className="text-mute">
            Stärkster Wochentag: {WOCHENTAGE[tag.wochentag]} mit {zahlText(tag.stundenJeTag)} h je Arbeitstag. Gerechnet über {profil.arbeitstage}{' '}
            {profil.arbeitstage === 1 ? 'Arbeitstag' : 'Arbeitstage'}.
          </p>
        )}
      </div>

      <div className="mt-4 h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={daten} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 11 }} interval={2} />
            <YAxis hide domain={[0, 60]} />
            <Tooltip content={<DiagrammTooltip format={minutenFormat} />} cursor={{ fill: '#3A3A3E', opacity: 0.4 }} />
            <Bar dataKey="produktiv" name="produktiv je Stunde" isAnimationActive={false} radius={[3, 3, 0, 0]}>
              {daten.map((d) => (
                <Cell key={d.label} fill="#00C076" fillOpacity={0.35 + 0.65 * Math.min(1, d.produktiv / 60)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-dim">Produktive Minuten je Stunde, Schnitt über deine Arbeitstage im Zeitraum. Volle Höhe = 60 Minuten.</p>

      <div className="mt-4 overflow-x-auto">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `28px repeat(${stunden.length}, minmax(0, 1fr))` }}>
          <div />
          {stunden.map((h) => (
            <div key={h} className="text-center text-[10px] tabular-nums text-dim">
              {h % 2 === 0 ? h : ''}
            </div>
          ))}
          {WOCHENTAGE_KURZ.map((name, wt) => (
            <>
              <div key={`n${wt}`} className="flex items-center text-[11px] text-mute">
                {name}
              </div>
              {stunden.map((h) => {
                const m = raster[wt][h]
                const anteil = m / maxRaster
                return (
                  <div
                    key={`${wt}-${h}`}
                    title={`${WOCHENTAGE[wt]}, ${h} bis ${h + 1} Uhr: im Schnitt ${Math.round(m)} min${profil.arbeitstageJeWochentag[wt] ? ` (${profil.arbeitstageJeWochentag[wt]} ${profil.arbeitstageJeWochentag[wt] === 1 ? 'Tag' : 'Tage'})` : ''}`}
                    className="h-4 rounded-[3px] bg-panel-2"
                    style={m > 0 ? { backgroundColor: '#00C076', opacity: 0.15 + 0.85 * anteil } : undefined}
                  />
                )
              })}
            </>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-dim">Je grüner, desto mehr produktive Zeit liegt im Schnitt an diesem Wochentag in dieser Stunde. Grau: nichts.</p>
    </div>
  )
}

export const Stundenprofil = memo(StundenprofilInnen)
