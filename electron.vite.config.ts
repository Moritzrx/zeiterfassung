import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Content-Security-Policy nur für die gebaute App. In der Entwicklung bleibt sie weg,
 * weil Hot Reload eingebettete Skripte braucht. Die Oberfläche spricht nur mit dem
 * Hauptprozess; die Supabase-Adresse ist trotzdem erlaubt, falls das einmal nötig wird.
 */
function sicherheitsrichtlinie(supabaseUrl: string): Plugin {
  const verbindungen = ["'self'"]
  if (supabaseUrl) verbindungen.push(supabaseUrl, supabaseUrl.replace(/^https:/, 'wss:'))
  const richtlinie = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src ${verbindungen.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'"
  ].join('; ')
  return {
    name: 'sicherheitsrichtlinie-gebaut',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: richtlinie },
          injectTo: 'head-prepend'
        }
      ]
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const supabaseUrl = env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      resolve: { alias: { '@shared': resolve('src/shared') } }
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      resolve: { alias: { '@shared': resolve('src/shared') } }
    },
    renderer: {
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src'),
          '@shared': resolve('src/shared')
        }
      },
      plugins: [react(), tailwindcss(), sicherheitsrichtlinie(supabaseUrl)]
    }
  }
})
