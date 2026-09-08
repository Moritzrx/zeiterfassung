// Umgebungsvariablen aus der .env, die beim Bauen fest in die App eingebaut werden.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}
