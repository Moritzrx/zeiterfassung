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
- Schritt 2 (Supabase anbinden, Login, Tabellen, Testdaten): fertig am 8. September 2026. Supabase-Projekt "moritz@wessamedia.com's Project" in Organisation "Wessamedia", Projekt-Ref `vgsnjtqcuwrhifvyizfj`, URL `https://vgsnjtqcuwrhifvyizfj.supabase.co`. Skripte 01, 02 und 03 sind erfolgreich im SQL-Editor gelaufen (Skript 04 noch nie). Drei Konten angelegt: moritz@, filipo@, leon@wessamedia.com (Auto Confirm). `.env` liegt lokal mit URL und Publishable key. Login aus der App hat funktioniert. Anleitung: `docs/supabase-einrichtung.md`. Selbstregistrierung ist ausgeschaltet (Authentication → Sign In / Providers → Abschnitt "User Signups" → "Allow new users to sign up" aus, erledigt am 8. September 2026).
- Testdaten-Beobachtung: Einzelne Wochen liegen unter 35 Stunden (z. B. Leon 23,7 h in KW 36), weil die Feierabend-Grenze 21 Uhr und Zufalls-Pausen die Tagesziele beschneiden. Bei Bedarf in Skript 3 Arbeitsbeginn früher legen oder Tagesziel begrenzen.
- Bedienung durch Claude: Das Chrome-Profil "Geschäftlich" des Auftraggebers ist für die Chrome-Erweiterung nicht erreichbar; Supabase-Dashboard nur per Screenshot (computer-use, read) und Klick-Anleitung. Das Electron-Fenster ist per computer-use bedienbar, aber nur wenn es gerade im Vordergrund ist; open_application "Electron" startet eine leere Electron-Demo, nicht die App.
- Datenschutz-Entscheidung im Schema: Blöcke sind nur für die eigene Person lesbar; das Team sieht Summen über die Funktion `team_stand(von, bis)`. Weicht vom Auftrag ("jeder darf alle Blöcke lesen") ab, Frage 7 war unbeantwortet. Umstellen = eine RLS-Policy ändern.
- Tätigkeitsnamen: Startregeln liefern direkt die Zielnamen mit "Learning" (Frage 10, unbeantwortet, Vorschlag umgesetzt).
- get-windows 9.3 bringt fertige Binärdateien für win32-x64 und darwin arm64/x64 mit; `require('get-windows')` funktioniert unter Node 24. Am 8. September 2026 auf dem Windows-PC erfolgreich getestet.
- Schritt 3 (automatische Erfassung): gebaut am 8. September 2026, unter Windows geprüft: Fenstererkennung, laufender Block, Pause/Fortsetzen, lokaler Speicher, Abgleich (1.030 Blöcke aus der Datenbank geholt). Vom Auftraggeber noch zu testen: Untätigkeit nach 3 Minuten, Schließen ins Symbol, Sperren/Ruhezustand, Symbol-Menü. Mac-Seite ungetestet.
  Bausteine: `src/main/erfassung.ts` (Takt 5 s, Untätigkeit rückwirkend, Lückenprüfung 30 s, Mitternacht- und 4-h-Teilung, Kurzblock-Regel 60 s, Inaktiv-Block max 60 min), `src/main/speicher.ts` (JSON je Konto unter `%APPDATA%\wessamedia Zeit\bloecke-<userId>.json`, atomar mit .bak), `src/main/sync.ts` (alle 60 s Upsert, Anfangsabgleich 13 Wochen mit Seiten à 1000), `src/main/tray.ts`, `src/main/programme.ts` (Namens-Tabelle), `src/shared/zeit.ts` (Berlin-Zeitrechnung ohne Zusatzpaket).
  Entscheidung: Ein Block endet auch bei Wechsel des Fenstertitels, nicht nur des Programms, sonst wären Titel-Regeln (Google Ads gegen YouTube im selben Chrome) wirkungslos; die 60-s-Regel hält die Liste ruhig. In der Entwicklungsversion heißt das eigene Fenster "Electron", in der gebauten App "wessamedia Zeit".
  Bewertung ist bis Schritt 5 immer "ungeklaert" (außer inaktiv), deshalb bleibt "Heute produktiv" vorerst 0,0.
- Schritt 4 (Heute-Screen mit echten Daten): gebaut am 8. September 2026. Tages-Ring (Recharts, vier Anteile inkl. ungeklärt), große Zahl mit `AnimierteZahl` (600 ms, respektiert "Bewegung reduzieren"), Blättern zu früheren Tagen (Pfeile, Klick auf das Datum springt zu heute), Ungeklärt-Hinweis mit Anzahl über alle Tage, Tagesliste (heute neueste zuerst, sonst chronologisch). Diagramme animieren nur beim ersten Aufbau. `DiagrammTooltip` ist der gemeinsame dunkle Tooltip für alle Diagramme. Leerer Schreibtisch (Windows Explorer ohne Fenstertitel) erzeugt keinen Block mehr.
- Schritt 5 (Regeln, Bewertung, Ungeklärt-Postfach, Nachbearbeitung): gebaut und am 8. September 2026 durchgespielt (Regel angelegt, 4 Blöcke sofort neu bewertet, Ring aktualisiert). Bausteine: `src/shared/regeln.ts` (Regelauswertung: persönlich vor Team, Programm vor Titel, Priorität, Musterlänge; `musterVorschlag` schneidet Browser-Anhang ab), `src/main/regelwerk.ts` (Regeln aus Supabase, Cache `regeln.json`, Neuladen alle 5 min), `src/main/bewertung.ts` (Neubewertung aller nicht geprüften Blöcke, auch nach jedem Abgleich aus der Datenbank), `src/main/bearbeiten.ts` (Ändern setzt manuellGeprueft, Löschen = geloeschtAm + Titel/Notiz leeren), `src/main/taetigkeiten.ts` (Schreibweise vereinheitlichen, neue Namen in Tabelle taetigkeit hochladen). Fenster: `BlockDialog` (auch fürs Durchgehen mit Fortschritt), `UngeklaertPostfach`, `Mehrfachleiste` (inkl. "Alle mit Programm X diese Woche"), `Hinweis` (Einblendung unten).
  Der laufende Block lässt sich nicht bearbeiten. Untätigkeit wird rückwirkend höchstens bis zum Start der Erfassung, zum Fortsetzen oder zum letzten Aufwachen gebucht (`zeitgrenze`), sonst entstehen überlappende Inaktiv-Blöcke bei Neustarts.
  Noch offen aus Schritt 5: "Woche durchgehen" mit auffälligen Blöcken (über 2 h, unbekanntes Programm) kommt mit dem Wochen-Screen in Schritt 6; Regeln bearbeiten/löschen kommt in den Einstellungen (Schritt 10).
- Schritte 6 bis 12: offen. Reihenfolge laut `docs/auftrag.md`.

## Befehle
- `npm run dev` startet die App zum Entwickeln. Unter Windows ohne PATH: `scripts\dev-windows.cmd`.
- `npm run build` baut die App (ohne Installer).
- `npm run typecheck` prüft die Typen.
- Vorschau im Browserfenster: `preview_start` mit "dev" (Startdatei liegt in `.claude/launch.json`; die Kopie im alten OneDrive-Ordner zeigt auf `scripts/dev-windows.cmd`). Der Renderer läuft dann auch unter http://localhost:5173 ohne Electron-APIs.

## Bekannte Eigenheiten
- `npm install` hat die Electron-Programmdatei nicht heruntergeladen (Postinstall lief nicht). Abhilfe: `node node_modules/electron/install.js`.
- Das Renderer-Bundle ist rund 570 kB, davon fast alles React. Nur die verwendeten lucide-Symbole landen darin.
