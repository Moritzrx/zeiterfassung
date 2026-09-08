# Prompt für Claude Code

Alles ab hier kopieren und in Claude Code einfügen.

## Rolle und Arbeitsweise

Du baust für die Agentur wessamedia (Wessa und Stoner GmbH) eine Desktop-App zur Zeiterfassung für drei Personen. Ich bin kein Entwickler. Erkläre mir jeden Schritt in einfachen Worten und sag mir immer genau, was ich wo eingeben oder anklicken muss.

Arbeite in dieser Reihenfolge:

1. Lies diesen Auftrag komplett und stell mir alle offenen Fragen auf einmal, bevor du anfängst.
2. Bau zuerst ein lauffähiges Grundgerüst, das startet und ein leeres Dashboard zeigt. Zeig es mir.
3. Danach Feature für Feature in der Reihenfolge weiter unten. Nach jedem Schritt sagst du mir, wie ich es testen kann.
4. Am Ende schreibst du eine README auf Deutsch mit Installation, Einrichtung und Bedienung.

Committe regelmäßig mit klaren Commit-Nachrichten. Alle Texte in der App sind auf Deutsch.

---

## Was die App können muss

Drei Personen (Moritz, Filipo, Leon) arbeiten an eigenen Rechnern. **Moritz arbeitet unter Windows, Filipo und Leon jeweils am MacBook.** Beide Systeme müssen also gleich gut funktionieren, das ist keine Nebensache. Jeder installiert die App bei sich. Die App misst automatisch, wie lange jemand am Rechner wirklich arbeitet, an welchem Programm, und ob das produktive Arbeit ist. Zusätzlich kann jeder Zeiten von Hand nachtragen, die nicht am Rechner passieren, zum Beispiel Drehs, Kundentermine, Fahrten. Alle Daten laufen in einer gemeinsamen Datenbank zusammen, sodass jeder auch sieht, wie die anderen beiden stehen.

Das Ganze ist wie ein Spiel aufgebaut: Wochenziel 50 Stunden, das entspricht Level 10. Wer das erreicht, hat die Woche geschafft.

---

## Technik (fest vorgegeben, bitte nicht abweichen)

- **Electron** mit **electron-vite**, **React**, **TypeScript**, **Tailwind CSS**
- Aktives Fenster erkennen mit dem npm-Paket **get-windows**
- Untätigkeit erkennen mit **powerMonitor.getSystemIdleTime()** aus Electron. Kein Zusatzpaket, keine Sonderrechte nötig.
- Datenbank: **Supabase** (kostenloser Tarif). Postgres plus Supabase Auth mit E-Mail und Passwort.
- Lokaler Zwischenspeicher: eine einfache JSON-Datei im App-Datenverzeichnis. **Kein SQLite, kein better-sqlite3**, weil native Module beim Bauen unnötig Ärger machen.
- Diagramme mit **Recharts**
- Symbole mit **lucide-react** für allgemeine Icons und **simple-icons** für Marken-Logos wie Instagram, TikTok, LinkedIn, Meta, Google
- Installer bauen mit **electron-builder**: .dmg für Mac (Intel und Apple Silicon) und .exe für Windows.
- Zeitzone überall Europe/Berlin.

Zugangsdaten für Supabase kommen aus einer `.env`-Datei, die nicht ins Git-Repository wandert. Leg eine `.env.example` an und sag mir Schritt für Schritt, wo ich in Supabase welchen Schlüssel finde.

---

## Datenmodell in Supabase

Leg die Tabellen per SQL-Skript an und gib mir das Skript zum Einfügen in den Supabase-SQL-Editor.

**profile**: user_id, name, aktiv

**block** (ein Zeitblock, automatisch oder von Hand)
user_id, start, ende, quelle (auto oder manuell), programm, fenstertitel, taetigkeit, bewertung (produktiv, unproduktiv, ungeklaert), notiz

**regel** (Zuordnung Programm zu Tätigkeit)
muster, feld (programm oder titel), taetigkeit, bewertung, gilt_fuer (alle oder eine user_id)

**ziel**
user_id, taetigkeit, stunden_pro_woche

Zeilen-Sicherheit (RLS): jeder darf alle Blöcke **lesen**, aber nur eigene Zeilen anlegen und ändern. Regeln darf jeder lesen und anlegen.

Ziele als Startwerte einfügen:

| Person | Ziel | Stunden pro Woche |
|---|---|---|
| Alle drei | Arbeitszeit gesamt | 50 |
| Moritz | Instagram Learning | 10 |
| Moritz | TikTok Learning | 10 |
| Moritz | KI Learning | 10 |
| Moritz | LinkedIn Learning | 3 |
| Filipo | KI Learning | 7 |
| Filipo | Videografie Learning | 7 |
| Leon | Google Ads Learning | 10 |
| Leon | KI Learning | 7 |
| Leon | Meta Ads Learning | 6 |

Die Learning-Stunden zählen in die 50 Stunden Gesamtarbeitszeit hinein, sie kommen nicht obendrauf. Die Ziele müssen in den Einstellungen änderbar sein, nicht fest im Code stehen.

---

## Tracking-Logik

**Erfassung**: Alle 5 Sekunden das aktive Fenster abfragen. Aufeinanderfolgende Abfragen mit demselben Programm werden zu einem Block zusammengefasst. Blöcke unter 60 Sekunden werden in den umliegenden Block eingerechnet, damit die Liste nicht zerfasert.

**Untätigkeit**: Keine Maus- und Tastatureingabe für mehr als 3 Minuten bedeutet inaktiv. Die inaktive Zeit wird als eigener Block mit der Bewertung "inaktiv" gespeichert und zählt **nicht** als Arbeitszeit. Sobald wieder eine Eingabe kommt, läuft die Erfassung normal weiter. Der Schwellwert von 3 Minuten muss in den Einstellungen änderbar sein. Wer den Bildschirm offen lässt und nichts tut, bekommt die Zeit also nicht gutgeschrieben.

**Bewertung**: Ein Block wird über die Regel-Tabelle bewertet. Erst wird auf das Programm geprüft, dann darauf, ob der Fenstertitel ein Muster enthält. Passt keine Regel, ist die Bewertung "ungeklaert".

Startregeln zum Anlegen:

- Premiere Pro, After Effects, DaVinci Resolve, CapCut, Photoshop, Lightroom → Videografie, produktiv
- Titel enthält Asana, Google Drive, Docs, Sheets, Slides, Gmail, Outlook → Orga, produktiv
- Titel enthält Google Ads → Google Ads, produktiv
- Titel enthält Meta Business, Werbeanzeigenmanager, Business Suite → Meta Ads, produktiv
- Titel enthält ChatGPT, Claude, Gemini, Midjourney → KI Learning, produktiv
- Titel enthält LinkedIn → LinkedIn, produktiv
- Netflix, Steam, Spiele, Titel enthält Netflix, Twitch, DAZN → unproduktiv
- Instagram, TikTok, YouTube → **ungeklaert**, weil das Arbeit oder Zeitvertreib sein kann

**Ungeklärt-Postfach**: Alle ungeklärten Blöcke landen in einer Liste auf der Startseite mit einem Hinweis wie "14 Blöcke noch nicht eingeordnet". Mit einem Klick ordnet man einen Block einer Tätigkeit zu und legt fest, ob produktiv oder nicht. Dabei fragt die App: "Diese Zuordnung künftig immer anwenden?" Bei Ja wird automatisch eine neue Regel angelegt. Ungeklärte Zeit zählt vorerst nicht in die produktiven Stunden.

**Tätigkeiten** sind kein festes Auswahlmenü. Jeder tippt frei ein, die App schlägt beim Tippen vor, was schon einmal verwendet wurde. Die Auswertung baut die Liste automatisch aus dem, was eingetragen wurde.

**Synchronisierung**: Blöcke werden lokal gespeichert und alle 60 Sekunden an Supabase geschickt. Bei fehlender Verbindung bleiben sie lokal liegen und werden später nachgereicht. Nichts darf verloren gehen.

**Pause-Knopf**: Ein gut sichtbarer Knopf stoppt die Erfassung sofort, zum Beispiel in der Mittagspause oder bei privaten Dingen. Im gestoppten Zustand zeigt die App das deutlich an, damit man das Wiedereinschalten nicht vergisst.

---

## Bewertung von Hand nachbearbeiten

Die automatische Bewertung ist nur ein Vorschlag. Der Mensch hat immer das letzte Wort. Das gilt nicht nur für ungeklärte Blöcke, sondern für **jeden** Block, auch für die, die eine Regel bereits eingeordnet hat.

- In jeder Liste, auf dem Heute-Screen wie auch in der Wochenansicht, lässt sich jeder Block anklicken und bearbeiten: Tätigkeit ändern, Bewertung auf produktiv oder unproduktiv umstellen, Uhrzeiten korrigieren, Notiz ergänzen, Block löschen.
- Sobald jemand einen Block von Hand ändert, wird er als "von Hand geprüft" markiert. Ab dann darf **keine** Regel diesen Block je wieder überschreiben, auch nicht bei einer späteren Neuberechnung. Sonst ist die Korrektur am nächsten Tag wieder weg.
- Beim Ändern fragt die App wie beim Ungeklärt-Postfach: "Diese Zuordnung künftig immer anwenden?" Bei Ja wird die passende Regel angelegt oder die bestehende Regel geändert.
- Mehrere Blöcke auf einmal auswählen und gemeinsam ändern muss möglich sein. Wer nach zwei Wochen merkt, dass Instagram bei ihm meistens Arbeit war, will das nicht 60 Mal einzeln anklicken.
- Blöcke, die von Hand geändert wurden, bekommen in der Liste ein kleines unauffälliges Zeichen, damit man sieht, was die App erkannt hat und was jemand selbst gesetzt hat.
- Auf dem Wochen-Screen ein Knopf "Woche durchgehen". Der führt der Reihe nach durch alle Blöcke der Woche, die entweder ungeklärt oder auffällig sind, zum Beispiel sehr lange Blöcke oder Blöcke mit unbekanntem Programm. Ein Klick pro Block, dann ist die Woche sauber.

Wichtig: Die Zahlen in Level, Zielen, Diagrammen und Hochrechnungen müssen sich nach einer Änderung sofort neu berechnen, ohne dass man die App neu starten muss.

---

## Zeiten von Hand eintragen

Eigene Seite mit Formular: Datum, von, bis, Tätigkeit, Notiz. Diese Blöcke bekommen die Quelle "manuell", gelten immer als produktiv und zählen in Wochenstunden und Tätigkeitsauswertung genauso mit wie die automatischen. Gedacht für Drehs, Kundentermine, Telefonate, Fahrten.

Bereits eingetragene Blöcke müssen sich nachträglich ändern und löschen lassen, auch die automatisch erfassten.

---

## Level-System

Die Rechnung ist bewusst einfach und muss überall in der App gleich sein:

**5 produktive Stunden in der Woche sind ein Level.**

Also: 40 Stunden sind Level 8, 45 Stunden Level 9, 50 Stunden Level 10. Level 10 ist das Wochenziel. Wer mehr macht, steigt weiter, Level 11, 12 und so fort, nach oben ist nicht gedeckelt.

Der Fortschrittsbalken zeigt, wie viele Stunden im aktuellen Level schon voll sind, zum Beispiel "Level 8, noch 2,4 Stunden bis Level 9".

Zusätzlich pro Tätigkeit ein eigener kleiner Fortschrittsbalken gegen das Wochenziel, zum Beispiel "KI Learning 4,5 von 7 Stunden".

Die Woche läuft von Montag 00:00 bis Sonntag 23:59. Montags startet alles bei null. Sonntags ab 18 Uhr zeigt die App eine Wochenzusammenfassung: erreichtes Level, Stunden gesamt, produktiv gegen unproduktiv, welche Ziele erreicht wurden und welche nicht.

Kleine Auszeichnungen, die freigeschaltet werden und sichtbar bleiben: erste Woche auf Level 10, drei Wochen in Folge Level 10, alle Lernziele einer Woche erreicht, eine Woche ohne unproduktive Zeit über 2 Stunden.

---

## Screens

**1. Heute**
Ganz oben groß die heutigen produktiven Stunden. Darunter läuft der aktuelle Block mit Programm und Tätigkeit live mit. Darunter der Ungeklärt-Hinweis, falls vorhanden. Darunter die Blöcke des Tages als Liste mit Uhrzeit, Programm, Tätigkeit und farbiger Bewertung.

**2. Woche**
Der Level-Ring als zentrales Element, mit Level-Zahl in der Mitte und den Stunden darunter. Darunter ein Balkendiagramm Montag bis Sonntag, jeder Balken dreigeteilt in produktiv, unproduktiv und inaktiv. Darunter die Tätigkeiten der Woche, absteigend nach Stunden sortiert, jeweils mit Fortschrittsbalken gegen das Ziel, falls eines hinterlegt ist.

**3. Auswertung**
Der Diagramm-Screen. Monatsverlauf, Trend über die letzten Wochen, Verteilung der Tätigkeiten und die Hochrechnungen. Alles Nähere im Abschnitt "Diagramme und Hochrechnungen".

**4. Team**
Alle drei nebeneinander mit Name, Level, Wochenstunden und Fortschrittsbalken. Sortiert nach Level. Kein Firlefanz, nur der ehrliche Stand.

**5. Eintragen**
Das Formular für Zeiten von Hand.

**6. Einstellungen**
Regeln bearbeiten, Ziele bearbeiten, Symbole je Tätigkeit festlegen, Schwellwert für Untätigkeit, Urlaubswochen pro Jahr, Anzeige ob die nötigen Systemrechte erteilt sind, Abmelden.

Unten eine schmale Navigationsleiste mit sechs Symbolen.

---

## Design

Optisches Vorbild ist die Banking-App Trade Republic. Konkret bedeutet das:

- Dunkler, fast schwarzer Hintergrund (#0B0B0C), Flächen darauf minimal heller (#151517)
- Sehr viel Luft, keine Rahmen, keine Schatten, keine Verläufe, keine überladenen Kacheln
- Schrift: Inter, oder was das System hergibt. Zahlen groß, dünn und in Tabellenziffern, damit beim Mitlaufen nichts springt.
- Nur zwei Signalfarben: Grün #00C076 für produktiv und erreichte Ziele, Rot #FF4D4D für unproduktiv und verfehlte Ziele. Inaktive Zeit in gedämpftem Grau #3A3A3E.
- Der Level-Ring und die Auszeichnungen in wessamedia-Orange #FE5303. Das ist die einzige Stelle, an der die Firmenfarbe auftaucht.
- Ecken 16 Pixel gerundet
- Zahlen animieren sanft hoch, wenn sie sich ändern. Ansonsten ruhig, keine springenden Elemente.
- Hell-Modus ist nicht nötig, dunkel reicht.

Das Ding soll sich beim Öffnen gut anfühlen. Sauber, ruhig, erwachsen. Kein buntes Gamification-Kinderdesign, obwohl es Level gibt.

---

## Diagramme und Hochrechnungen

Die App soll stark mit Diagrammen arbeiten. Sie sind kein Beiwerk, sondern der Grund, warum man die App öffnet. Alle Diagramme im selben dunklen Stil, ohne Gitterlinien, ohne Rahmen, mit dezenten Achsen. Beim Überfahren mit der Maus erscheint ein schlichter Tooltip mit dem genauen Wert.

**Diese Diagramme baust du:**

1. **Heute, Ringdiagramm**: produktiv, unproduktiv, inaktiv. In der Mitte die produktiven Stunden.
2. **Woche, gestapeltes Balkendiagramm**: Montag bis Sonntag, jeder Balken dreigeteilt nach produktiv, unproduktiv, inaktiv. Eine gestrichelte waagerechte Linie markiert 10 Stunden als Tagesrichtwert (50 Stunden auf 5 Tage).
3. **Monat, Flächendiagramm**: produktive Stunden je Tag über die letzten 30 Tage, darüber als dünne Linie der gleitende Schnitt über 7 Tage.
4. **Trend, Balkendiagramm**: erreichtes Level je Woche über die letzten 12 Wochen. Wochen ab Level 10 in Grün, darunter in Rot.
5. **Tätigkeiten, waagerechte Balken**: alle Tätigkeiten der Woche absteigend nach Stunden, jeweils mit dem Symbol der Tätigkeit links davor und dem Ziel als heller Markierung im Balken.
6. **Verteilung, Ringdiagramm**: Anteil jeder Tätigkeit an der Gesamtzeit des Monats.
7. **Team, Balken nebeneinander**: Wochenstunden der drei im Vergleich.

**Hochrechnungen**

Wichtig: alle Hochrechnungen müssen aus **einer einzigen Basiszahl** abgeleitet sein, damit sich die Werte nirgends widersprechen.

Die Basis ist der **Tagesschnitt**: die produktiven Stunden der letzten 28 Tage, geteilt durch die Anzahl der Tage in diesem Zeitraum, an denen überhaupt Zeit erfasst wurde. Daraus:

- Woche = Tagesschnitt mal 5
- Monat = Wochenwert mal 4,333 (weil 52 Wochen geteilt durch 12 Monate)
- Jahr = Wochenwert mal (52 minus die in den Einstellungen hinterlegten Urlaubswochen), Standard 6 Urlaubswochen, also 46

Dieselbe Kette gilt auch je Tätigkeit. Beispiel für eine Hochrechnungs-Karte:

> [Instagram-Logo] **Instagram Learning**
> 1,4 Stunden am Tag im Schnitt
> 7,0 pro Woche, 30,3 pro Monat, 322 pro Jahr

Solche Karten für jede Tätigkeit untereinander auf dem Auswertungs-Screen, plus ganz oben eine große Karte für die Gesamtarbeitszeit.

Unter jeder Hochrechnung ein kleiner Hinweis, worauf sie beruht, zum Beispiel "Schnitt aus 19 erfassten Tagen". Liegen weniger als 7 erfasste Tage vor, zeigt die App statt einer Zahl den Hinweis, dass die Datenlage noch zu dünn ist. Erfundene Werte gibt es nicht.

Zusätzlich auf dem Wochen-Screen eine Restlaufzeit-Rechnung: "Noch 18,5 Stunden bis Level 10, bei 3 verbleibenden Tagen sind das 6,2 Stunden pro Tag." Auch das aus den echten Werten, nicht geschätzt.

**Symbole**

Jede Tätigkeit bekommt ein Symbol, das überall gleich mitläuft, in Listen, Diagrammlegenden, Hochrechnungs-Karten und auf dem Team-Screen.

- Marken bekommen ihr echtes Logo aus simple-icons, in der jeweiligen Markenfarbe: Instagram, TikTok, LinkedIn, YouTube, Meta, Google Ads, Adobe Premiere Pro, CapCut, Asana, Notion, WhatsApp.
- Alles andere bekommt ein passendes Symbol aus lucide-react in Weiß oder Orange, zum Beispiel Kamera für Dreh, Auto für Fahrt, Telefon für Kundengespräch, Gehirn für KI Learning, Stift für Konzept.
- In den Einstellungen kann man jeder Tätigkeit ihr Symbol selbst zuweisen. Neue Tätigkeiten bekommen automatisch ein neutrales Standardsymbol, bis jemand eines auswählt.
- Die Logos werden nur intern verwendet, es ist ein Werkzeug für unser eigenes Team.

---

## Grafiken

Das App-Symbol, die Abzeichen für die Auszeichnungen und die Grafik für den Level-Aufstieg liefere ich als fertige PNG-Dateien und lege sie im Projekt unter `src/assets/` ab. Bau sie nur ein, erzeuge oder zeichne selbst keine. Sag mir vorher, in welchen Größen und unter welchen Dateinamen du sie brauchst, dann liefere ich sie passend. Solange sie fehlen, nimm graue Platzhalter in der richtigen Größe, damit das Layout schon steht.

---

## Hintergrundbetrieb und Sonderfälle

Das ist der Teil, an dem solche Apps normalerweise scheitern. Bitte sauber umsetzen.

**Die App läuft immer mit.** Sie startet automatisch mit dem Rechner, minimiert sich beim Schließen des Fensters ins Symbol oben in der Menüleiste (Mac) beziehungsweise unten rechts im Infobereich (Windows) und läuft dort weiter. Das Klicken auf das rote X darf die Erfassung nicht beenden, sondern nur das Fenster schließen. Beenden geht nur über das Menü im Symbol. Im Symbol stehen die heutigen Stunden und das aktuelle Level, außerdem der Pause-Knopf.

**Ruhezustand und Aufwachen.** Horche auf die Ereignisse `suspend`, `resume`, `lock-screen` und `unlock-screen` von powerMonitor. Geht der Rechner schlafen oder wird gesperrt, wird der laufende Block sofort beendet. Beim Aufwachen beginnt ein neuer. Sonst zählt eine Nacht im Zuklapp-Modus als zehn Stunden Arbeit, und alle Zahlen sind wertlos.

**Mitternacht und Wochenwechsel.** Läuft ein Block über 00:00 hinaus, wird er automatisch an der Tagesgrenze in zwei Blöcke geteilt. Dasselbe gilt für den Wechsel von Sonntag auf Montag, damit die Wochenauswertung stimmt.

**Sehr lange Blöcke.** Ein einzelner Block darf nie länger als 4 Stunden sein. Nach 4 Stunden wird automatisch geteilt. Das ist eine reine Sicherung gegen Fehler in der Erfassung.

**Programmnamen vereinheitlichen.** Windows und Mac liefern für dasselbe Programm unterschiedliche Namen, zum Beispiel `chrome.exe` gegenüber `Google Chrome`. Bau eine Übersetzungstabelle, die beides auf einen einheitlichen Namen bringt, bevor die Regeln greifen. Sonst funktionieren die Regeln nur auf einem der beiden Systeme.

**Zwei Bildschirme.** Es zählt immer nur das eine Fenster, das gerade den Fokus hat, egal auf welchem Bildschirm. Nicht beide gleichzeitig zählen.

---

## Datenschutz und Grenzen

- **Keine Screenshots, kein Keylogger, keine Aufzeichnung von Tastenanschlägen oder Klicks.** Gemessen wird ausschließlich: welches Programm ist im Vordergrund, wie heißt das Fenster, und ob seit X Minuten eine Eingabe kam.
- In den Einstellungen ein Schalter "Fenstertitel speichern". Ist er aus, wird nur der Programmname gespeichert. Standard ist an.
- Der Pause-Knopf muss auf jedem Screen erreichbar sein.
- Auf dem Mac braucht die Fenstererkennung die Berechtigung für Bildschirmaufnahme in den Systemeinstellungen. Bau eine Startseite ein, die prüft, ob die Berechtigung vorliegt, und mich sonst mit einer klaren Anleitung dorthin schickt.

---

## Testdaten

Schreib ein Skript, das die Datenbank mit erfundenen Daten für drei Nutzer über 10 Wochen füllt, mit realistischer Streuung zwischen 35 und 58 Stunden pro Woche und einem bunten Mix aus Tätigkeiten. Ich will die Diagramme, die Level und die Hochrechnungen beurteilen können, bevor wir echte Daten haben. Das Skript muss sich auch wieder rückstandslos entfernen lassen.

---

## Was ich vorher vorbereiten muss

Sag mir gleich zu Beginn, was ich auf meinem Rechner installiert oder angelegt haben muss, bevor es losgeht, zum Beispiel Node.js in einer bestimmten Version, Git und ein kostenloses Supabase-Konto. Nenn die Versionen konkret und schick mir die Links dazu.

Wenn ich später etwas an der App ändere, bekommen die anderen beiden einfach die neue Installationsdatei von mir. Bau keine automatische Update-Funktion ein, die lohnt sich bei drei Nutzern nicht.

---

## Ausliefern

Zum Schluss brauche ich Installer, die ich an die anderen beiden weitergeben kann: eine .dmg für Mac und eine .exe für Windows. Die Apps sind nicht signiert. Schreib mir in die README, wie man die Warnmeldung beim ersten Start auf beiden Systemen wegklickt.

Erkläre mir außerdem, wie ich die drei Benutzerkonten in Supabase anlege.

---

## Reihenfolge der Arbeit

1. Projekt aufsetzen, App startet, leeres Dashboard, dunkles Design steht
2. Supabase anbinden, Login funktioniert, Tabellen sind da, Testdaten-Skript läuft
3. Automatische Erfassung von Programm und Untätigkeit, inklusive Ruhezustand, Mitternacht und Symbol in der Menüleiste. Blöcke landen lokal und in der Datenbank.
4. Screen "Heute" mit echten Daten
5. Regeln, Bewertung, Ungeklärt-Postfach und Nachbearbeitung von Hand
6. Ziele, Level-System, Screen "Woche"
7. Zeiten von Hand eintragen
8. Auswertungs-Screen mit allen Diagrammen und Hochrechnungen, Symbole je Tätigkeit
9. Team-Screen
10. Einstellungen
11. Auszeichnungen und Wochenzusammenfassung
12. Installer bauen und README schreiben

Fang jetzt mit deinen Rückfragen an.
