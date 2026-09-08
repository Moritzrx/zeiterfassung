import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import type { AuthStatus } from '@shared/api'

interface NutzerKontext {
  /** null, solange der Stand noch geladen wird */
  status: AuthStatus | null
  neuLaden: () => Promise<void>
}

const Kontext = createContext<NutzerKontext>({ status: null, neuLaden: async () => {} })

const OHNE_ELECTRON: AuthStatus = {
  konfiguriert: false,
  angemeldet: false,
  userId: null,
  email: null,
  name: null
}

/** Hält fest, wer angemeldet ist, und stellt es allen Screens bereit. */
export function NutzerProvider({ children }: { children: ReactNode }): ReactElement {
  const [status, setStatus] = useState<AuthStatus | null>(null)

  const neuLaden = useCallback(async () => {
    // Im normalen Browser (Vorschau ohne Electron) gibt es window.api nicht.
    if (!window.api) {
      setStatus(OHNE_ELECTRON)
      return
    }
    setStatus(await window.api.auth.status())
  }, [])

  useEffect(() => {
    void neuLaden()
  }, [neuLaden])

  return <Kontext.Provider value={{ status, neuLaden }}>{children}</Kontext.Provider>
}

export function useNutzer(): NutzerKontext {
  return useContext(Kontext)
}
