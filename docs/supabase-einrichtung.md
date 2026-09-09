# Supabase einrichten – Schritt für Schritt

Einmalig nötig, dauert etwa 20 Minuten. Alles läuft im Browser auf supabase.com.

## 1. Konto und Projekt anlegen

1. Auf https://supabase.com gehen, oben rechts **"Start your project"** oder **"Sign in"**.
2. Konto mit **deiner geschäftlichen E-Mail-Adresse** anlegen (oder "Continue with GitHub", falls du das GitHub-Konto schon hast). Welche Adresse das ist, spielt für die App keine Rolle: Sie ist nur dein Login bei supabase.com. Wichtig ist nur, dass du an dieses Postfach kommst, weil Supabase dorthin schreibt, wenn das Gratis-Projekt nach längerer Pause schlafen gelegt wird.
3. Nach dem Anmelden: **"New project"** klicken.
4. Ausfüllen:
   - **Organization:** die vorgeschlagene lassen.
   - **Project name:** `zeiterfassung`
   - **Database password:** auf **"Generate a password"** klicken und das Passwort **sofort in eurem Passwort-Speicher ablegen**. Es wird nur für Notfälle gebraucht, lässt sich aber nicht mehr anzeigen.
   - **Region:** **"Central EU (Frankfurt)"** wählen. Das lässt sich später nicht ändern.
5. **"Create new project"** klicken und ein bis zwei Minuten warten, bis oben links das Projekt grün ist.

## 2. Tabellen anlegen (Skript 1)

1. Links in der Leiste das Symbol **"SQL Editor"** klicken.
2. Auf **"New query"** (oder das Plus).
3. Die Datei `supabase/01_tabellen.sql` aus dem Projektordner im Editor (Notepad) öffnen, **alles markieren, kopieren** und in das große Textfeld bei Supabase einfügen.
4. Unten rechts **"Run"** klicken. Es sollte "Success. No rows returned" erscheinen.

## 3. Die drei Konten anlegen

1. Links **"Authentication"** klicken, dann **"Users"**.
2. **"Add user"** → **"Create new user"**.
3. E-Mail eintragen, zum Beispiel `moritz@wessamedia.com`, ein Passwort vergeben.
4. Das Häkchen **"Auto Confirm User"** setzen, sonst wartet Supabase auf eine Bestätigungs-Mail.
5. **"Create user"**. Dasselbe für `filipo@wessamedia.com` und `leon@wessamedia.com`.
6. Die Passwörter gibst du den beiden persönlich. Ein Passwort ändern: In der Nutzerliste auf den Nutzer klicken, dann "Reset password" oder "Send password recovery" nutzen. Einfacher: Nutzer löschen und mit neuem Passwort neu anlegen, solange noch keine Daten da sind.

## 4. Selbstregistrierung ausschalten

Damit sich niemand Fremdes ein Konto anlegen kann:

1. **"Authentication"** → **"Sign In / Providers"** (bei älteren Ansichten "Providers").
2. **"Email"** aufklappen.
3. Den Schalter **"Allow new users to sign up"** ausschalten. **"Save"**.

## 5. Namen, Ziele und Regeln setzen (Skript 2)

1. Falls ihr andere E-Mail-Adressen benutzt als `moritz@`, `filipo@`, `leon@wessamedia.com`: Die Datei `supabase/02_startwerte.sql` öffnen und die drei Adressen ganz oben anpassen.
2. Wie bei Skript 1: **SQL Editor** → **New query** → Inhalt einfügen → **Run**.
3. Unten erscheint eine Tabelle mit den Zielen je Person. Das ist die Kontrolle, dass alles geklappt hat.

## 6. Testdaten (optional, empfohlen zum Anschauen der Diagramme)

- Einfügen: `supabase/03_testdaten_einfuegen.sql` genauso ausführen. Unten erscheint eine Übersicht mit Stunden je Person und Woche.
- Wieder entfernen: `supabase/04_testdaten_entfernen.sql` ausführen. Es werden nur die Testzeilen gelöscht, echte Daten bleiben.

## 6b. Tagessummen für lange Auswertungen (Skript 5)

Damit die Auswertung auch 6 oder 12 Monate zeigen kann, braucht die Datenbank eine kleine Zusatzfunktion.

- `supabase/05_auswertung.sql` genauso ausführen wie die anderen Skripte: **SQL Editor** → **New query** → einfügen → **Run**.
- Solange das Skript nicht gelaufen ist, zeigt die App für Zeiträume über zwölf Wochen einen Hinweis statt Zahlen. Alles bis zwölf Wochen funktioniert auch ohne.

## 6c. Team-Verlauf und Rangliste (Skript 6)

Für den Verlauf über mehrere Wochen und die Rangliste auf dem Team-Screen:

- `supabase/06_team.sql` genauso ausführen: **SQL Editor** → **New query** → einfügen → **Run**.

## 6d. Die Liga (Skript 8)

Für den Langzeit-Stand mit Trophäen und Ligen auf Woche und Team:

- `supabase/08_liga.sql` genauso ausführen: **SQL Editor** → **New query** → einfügen → **Run**.
- Solange das Skript nicht gelaufen ist, zeigt die Liga-Karte einen Hinweis statt Zahlen.

## 6e. Urlaub (Skript 9)

Damit jeder seinen Urlaub hinterlegen kann und die Liga ihn berücksichtigt:

- `supabase/09_urlaub.sql` genauso ausführen: **SQL Editor** → **New query** → einfügen → **Run**. Das Skript legt die Tabelle an und ersetzt die Liga-Funktion aus Skript 8.

## 6f. Liga-Start bei 0 (Skript 10)

- `supabase/10_liga_start_null.sql` genauso ausführen. Danach beginnt jeder ohne Liga bei 0 Trophäen statt bei 400 in der Bronze-Liga III.

## 6g. Zehn neue Auszeichnungen (Skript 11)

- `supabase/11_auszeichnungen.sql` genauso ausführen. Es erlaubt der Tabelle die neuen Auszeichnungstypen; ohne das Skript kann die App sie nicht speichern.

## 6h. Trophäen nie unter 0 (Skript 12)

- `supabase/12_liga_nicht_unter_null.sql` genauso ausführen (am 9. September 2026 bereits erledigt). Danach kann niemand unter 0 Trophäen fallen (wie in Clash of Clans), und die Liga-Karte zeigt zur letzten Woche auch, was sie am Stand wirklich geändert hat. Ohne das Skript rechnet die Datenbank weiter ins Minus, die App zeigt dann nach einer schwachen ersten Woche zum Beispiel −120 Trophäen.

## 6i. 36 Auszeichnungen, Stunden-Meilensteine, Urlaub Mo–So (Skript 13)

- `supabase/13_auszeichnungen_erweitert.sql` genauso ausführen. Es erlaubt die neuen Auszeichnungstypen, legt die Funktion an, die die produktiven Stunden seit dem Start zählt, und stellt die Liga so um, dass Urlaubstage an allen sieben Tagen zählen. Ohne das Skript bleiben die neuen Medaillen grau, und der Urlaub zählt in der Liga weiter nur Montag bis Freitag.

## 7. Zugangsdaten in die App bringen

1. Links unten **"Project Settings"** (Zahnrad) → **"API Keys"**.
2. Dort stehen zwei Dinge, die du brauchst:
   - **Project URL**, sieht aus wie `https://abcdefgh.supabase.co`
   - **Publishable key**, beginnt mit `sb_publishable_`
   Den **Secret key** brauchen wir nie. Nirgends eintragen, niemandem geben.
3. Im Projektordner `C:\Users\mouga\Projekte\zeiterfassung` die Datei `.env.example` kopieren und die Kopie in `.env` umbenennen (ohne `.example`). Hinweis: Windows blendet Dateiendungen oft aus; im Explorer unter "Ansicht" → "Anzeigen" → "Dateinamenerweiterungen" einschalten.
4. Die `.env` mit dem Editor (Notepad) öffnen und die beiden Werte hinter dem Gleichheitszeichen eintragen:
   ```
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
5. Speichern. Die `.env` bleibt nur auf deinem Rechner, sie wandert nie ins Git.
6. App neu starten (Doppelklick auf `scripts\dev-windows.cmd`). Jetzt erscheint die Anmeldung ohne den Hinweis "Zugangsdaten fehlen", und du kannst dich mit deinem Konto anmelden.

## Wenn etwas hakt

- **"Kein Konto mit der Adresse ... gefunden"** beim Skript 2 oder 3: Die Adressen oben im Skript stimmen nicht mit den Konten überein, oder die Konten sind noch nicht angelegt.
- **"E-Mail oder Passwort stimmt nicht"** in der App: Passwort in Supabase neu setzen (Abschnitt 3).
- **"Das Konto ist noch nicht bestätigt"**: In Authentication → Users den Nutzer anklicken und bestätigen, oder ihn mit Häkchen "Auto Confirm User" neu anlegen.
- **"Keine Verbindung zur Datenbank"**: Internet prüfen. Nach längerer Pause kann Supabase das Gratis-Projekt schlafen legen; dann im Dashboard auf **"Restore project"** klicken.
