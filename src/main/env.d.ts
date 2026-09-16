/** Textdateien als Zeichenkette einbinden (Vite `?raw`), z. B. die Anleitung für den KI-Assistenten. */
declare module '*.md?raw' {
  const inhalt: string
  export default inhalt
}
