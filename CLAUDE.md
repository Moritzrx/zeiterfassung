# wessamedia Zeit – Zeiterfassungs-App

Desktop-App (Electron) zur Zeiterfassung für drei Personen: Moritz (Windows), Filipo und Leon (Mac).
Der vollständige Auftrag steht in `docs/auftrag.md`. Diese Datei hält Entscheidungen und den Stand fest.

## Wichtig für die Zusammenarbeit
- Der Auftraggeber (Moritz) ist kein Entwickler. Alles auf Deutsch, jeden Schritt in einfachen Worten erklären, genau sagen, was er wo klicken muss. Nach jedem Schritt eine Testanleitung.
- Nutzungslimit: Das Claude-Konto wird von drei Personen geteilt. Keine Agenten-Schwärme, keine großen Workflows. Arbeit im Hauptkontext erledigen.
- Regelmäßig committen, deutsche Commit-Nachrichten. Alle Texte in der App auf Deutsch, Anrede "du".
- Große Bash-Befehle mit vielen Heredocs scheitern in dieser Umgebung. Dateien mit dem Write-Tool schreiben.

## Technik (fest vorgegeben)
Electron 44 + electron-vite 5 (Vite 7, nicht 8), React 19, TypeScript 5.9, Tailwind CSS 4, Recharts, lucide-react, simple-icons, get-windows, powerMonitor, Supabase (Postgres + Auth), lokaler Zwischenspeicher als JSON-Datei (kein SQLite), electron-builder. Zeitzone Europe/Berlin.

Node.js 24.20 liegt unter `C:\Program Files\nodejs`. In der Bash vor jedem npm-Befehl: `export PATH="/c/Program Files/nodejs:$PATH"`.
Electron 44 bringt Node 24.20 mit, damit funktioniert `require()` auch für reine ESM-Pakete wie get-windows.

## Getroffene Entscheidungen (Stand 8. September 2026)
- Projektordner bewusst außerhalb von OneDrive: `C:\Users\mouga\Projekte\zeiterfassung`.
- App-Name "wessamedia Zeit", Kennung `com.wessamedia.zeit`. Nicht mehr ändern (Datenordner, Autostart, Mac-Berechtigungen hängen daran).
- macOS-Berechtigung "Bildschirmaufnahme" wird NICHT angefordert (Entscheidung des Auftraggebers). get-windows auf dem Mac mit `screenRecordingPermission: false` und `accessibilityPermission: false`. Auf dem Mac gibt es nur Programmnamen, keine Fenstertitel; Titel-Regeln greifen nur unter Windows. Später per Einstellung nachrüstbar.
- Bewertung hat vier Werte: produktiv, unproduktiv, ungeklaert, inaktiv.
- 5 produktive Stunden = 1 Level, fest. Das Gesamtziel (Standard 50) bestimmt nur das Ziel-Level und die Tagesrichtwert-Linie.
- Tagesschnitt für Hochrechnungen: nur Tage mit mindestens 1 Stunde produktiver Zeit zählen, heutiger Tag ausgenommen.
- Restlaufzeit rechnet Montag bis Freitag inklusive heute; Woche und Diagramme bleiben 7 Tage.
- Inaktivität beginnt rückwirkend beim letzten Tastendruck. Inaktiv-Block maximal 60 Minuten, danach ruht die Erfassung bis zur nächsten Eingabe.
- Blöcke unter 60 Sekunden gehen in den vorherigen Block, sonst in den nächsten. Pause erzeugt keinen Block.
- Neue Regeln wirken rückwirkend auf eigene, nicht von Hand geprüfte Blöcke. Von Hand geprüfte Blöcke fasst nie wieder eine Regel an.
- Hand-Einträge warnen bei Überschneidung mit automatischen Blöcken. Sie starten als produktiv, bleiben aber umstellbar.
- Löschen blendet nur aus (geloescht_am) und leert sofort Fenstertitel und Notiz.
- Tätigkeitsnamen: Vergleich ohne Groß/Klein, Leerzeichen und Bindestriche; Symbole je Tätigkeit gelten für das ganze Team.
- lucide-Symbole immer in Weiß. Orange (#FE5303) nur für Level-Ring, Abzeichen und Level-Aufstieg-Grafik.
- Supabase-URL und Publishable key werden beim Bauen fest in die App eingebaut; die `.env` bleibt nur lokal. Secret key wird nie gebraucht (Testdaten als SQL-Skript im Supabase-Editor). Selbstregistrierung in Supabase abschalten. Region Frankfurt.
- Unsignierte Installer. Mac-Installer sollen über GitHub Actions entstehen (Windows kann keine .dmg bauen); Zustimmung des Auftraggebers (Frage 2) steht noch aus.
- Noch offen: Content-Security-Policy für die gebaute App (im Hauptprozess per onHeadersReceived setzen, nur außerhalb von is.dev). In der Entwicklung bewusst ohne CSP, damit Hot Reload läuft.

## Design
Hintergrund #0B0B0C, Flächen #151517, Text #F2F2F3, Nebentext #8E8E93. Grün #00C076 produktiv, Rot #FF4D4D unproduktiv, Grau #3A3A3E inaktiv, Hellgrau #8A8A8F ungeklärt. Ecken 16 px. Schrift Inter (gebündelt über @fontsource-variable/inter), Tabellenziffern überall. Keine Rahmen, keine Schatten, keine Verläufe. Inhalt als mittige Spalte, maximal 800 px breit, Navigation unten.
Tailwind-Farbnamen: bg-ground, bg-panel, text-ink, text-mute, text-dim, produktiv, unproduktiv, inaktiv, ungeklaert, orange. Rundungen: rounded-card (16 px), rounded-chip (8 px).

## Stand
- Schritt 1 (Grundgerüst, leeres Dashboard, dunkles Design): fertig am 8. September 2026. App startet, sechs leere Screens, Navigation unten, Kopfzeile mit Pause-Platzhalter.
- Schritt 2 (Supabase anbinden, Login, Tabellen, Testdaten): als Nächstes. Braucht vom Auftraggeber: Supabase-Konto, drei E-Mail-Adressen, Antwort auf Frage 2 (GitHub).
- Schritte 3 bis 12: offen. Reihenfolge laut `docs/auftrag.md`.

## Befehle
- `npm run dev` startet die App zum Entwickeln. Unter Windows ohne PATH: `scripts\dev-windows.cmd`.
- `npm run build` baut die App (ohne Installer).
- `npm run typecheck` prüft die Typen.
- Vorschau im Browserfenster: `preview_start` mit "dev" (Startdatei liegt in `.claude/launch.json`; die Kopie im alten OneDrive-Ordner zeigt auf `scripts/dev-windows.cmd`). Der Renderer läuft dann auch unter http://localhost:5173 ohne Electron-APIs.

## Bekannte Eigenheiten
- `npm install` hat die Electron-Programmdatei nicht heruntergeladen (Postinstall lief nicht). Abhilfe: `node node_modules/electron/install.js`.
- Das Renderer-Bundle ist rund 570 kB, davon fast alles React. Nur die verwendeten lucide-Symbole landen darin.
