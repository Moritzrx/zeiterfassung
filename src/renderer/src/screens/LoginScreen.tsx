import { useState, type FormEvent, type ReactElement } from 'react'
import { useNutzer } from '../nutzer'

const FELD =
  'w-full rounded-chip bg-panel-2 px-4 py-3 text-sm text-ink outline-none placeholder:text-dim focus:ring-1 focus:ring-dim'

/** Erscheint vor allem anderen, solange niemand angemeldet ist. */
export function LoginScreen(): ReactElement {
  const { status, neuLaden } = useNutzer()
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const konfiguriert = status?.konfiguriert ?? false

  async function absenden(ereignis: FormEvent): Promise<void> {
    ereignis.preventDefault()
    setLaeuft(true)
    setFehler(null)
    const ergebnis = await window.api.auth.anmelden(email, passwort)
    setLaeuft(false)
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler)
      return
    }
    await neuLaden()
  }

  return (
    <div className="flex h-full items-center justify-center [-webkit-app-region:drag]">
      <form onSubmit={absenden} className="w-[360px] [-webkit-app-region:no-drag]">
        {/* Platzhalter für das App-Symbol, bis die Grafik geliefert ist */}
        <div className="mx-auto mb-6 h-16 w-16 rounded-card bg-panel-2" />
        <h1 className="text-center text-2xl font-light">wessamedia Zeit</h1>
        <p className="mt-1 text-center text-sm text-mute">Melde dich mit deinem Konto an.</p>

        {!konfiguriert && (
          <p className="mt-6 rounded-card bg-panel p-4 text-sm text-mute">
            Die Zugangsdaten zur Datenbank fehlen. Diese Version wurde ohne die Datei .env gebaut.
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <input
            className={FELD}
            type="email"
            autoComplete="username"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!konfiguriert || laeuft}
            autoFocus
          />
          <input
            className={FELD}
            type="password"
            autoComplete="current-password"
            placeholder="Passwort"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            disabled={!konfiguriert || laeuft}
          />
        </div>

        {fehler && <p className="mt-3 text-sm text-unproduktiv">{fehler}</p>}

        <button
          type="submit"
          disabled={!konfiguriert || laeuft || !email || !passwort}
          className="mt-6 w-full rounded-chip bg-ink py-3 text-sm font-medium text-ground transition-opacity disabled:opacity-40"
        >
          {laeuft ? 'Anmelden …' : 'Anmelden'}
        </button>

        <p className="mt-6 text-center text-xs text-dim">
          Kein Konto? Konten und Passwörter werden in Supabase angelegt.
        </p>
      </form>
    </div>
  )
}
