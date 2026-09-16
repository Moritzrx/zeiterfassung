# wessamedia Zeit

Zeiterfassung für das Team von wessamedia: Die App merkt sich automatisch, welches Programm gerade vorne ist, bewertet die Zeit nach euren Regeln als produktiv oder unproduktiv und zeigt Tag, Woche, Ränge, Team-Vergleich und Hochrechnungen. Alles, was nicht am Rechner passiert (Kundentermine, Fahrten), trägt man von Hand ein.

Läuft auf Windows und Mac. Die Daten liegen in eurer eigenen Supabase-Datenbank, jede Person sieht nur ihre eigenen Zeitblöcke, das Team sieht Summen.

---

## 1. Installation

Ihr bekommt zwei Dateien von Moritz:

| System | Datei |
| --- | --- |
| Windows | `wessamedia-Zeit-1.0.0-Windows.exe` |
| Mac (Intel und Apple Silicon) | `wessamedia-Zeit-1.0.0-Mac.dmg` |

Die Apps sind **nicht signiert**, weil dafür ein kostenpflichtiges Entwicklerkonto bei Microsoft bzw. Apple nötig wäre. Deshalb warnen beide Systeme beim ersten Start. Das ist normal, die Schritte zum Wegklicken stehen unten.

### Windows

1. Die `.exe` doppelklicken. Schon der Browser kann beim Herunterladen warnen: In Chrome auf **"Behalten"** klicken, in Edge auf die drei Punkte neben dem Download, dann **"Beibehalten"** und **"Trotzdem beibehalten"**.
2. Erscheint das blaue Fenster **"Der Computer wurde durch Windows geschützt"**: auf **"Weitere Informationen"** klicken, dann auf den Knopf **"Trotzdem ausführen"**.
3. Im Installationsfenster auf **"Installieren"** klicken, dann **"Fertigstellen"**. Es braucht keine Administratorrechte.
4. Die App liegt danach im Startmenü und auf dem Desktop. Sie startet sofort und ab jetzt automatisch mit Windows, versteckt im Infobereich unten rechts (der kleine Pfeil `^` neben der Uhr zeigt das Symbol).

Deinstallieren: Windows-Einstellungen → Apps → "wessamedia Zeit" → Deinstallieren. Die lokalen Daten bleiben erhalten (siehe Abschnitt 6).

### Mac

1. Die `.dmg` doppelklicken. Im Fenster das Symbol **"wessamedia Zeit"** auf den Ordner **"Programme"** ziehen. Danach die `.dmg` im Finder auswerfen.
2. Die App im Ordner Programme doppelklicken. Beim ersten Mal sagt macOS: **"„wessamedia Zeit“ kann nicht geöffnet werden, da Apple es nicht auf Schadsoftware überprüfen konnte."** Auf **"Fertig"** klicken (nicht "In den Papierkorb").
3. **Systemeinstellungen** öffnen → **"Datenschutz & Sicherheit"** → ganz nach unten scrollen. Dort steht: *"wessamedia Zeit wurde blockiert"*. Auf **"Dennoch öffnen"** klicken, mit Passwort oder Touch ID bestätigen, im nächsten Fenster noch einmal **"Öffnen"**.
4. Ab jetzt startet die App normal. Sie erscheint als Symbol in der Menüleiste oben rechts und startet automatisch mit dem Mac.

Ältere macOS-Versionen (bis 13): Statt Schritt 3 reicht ein Rechtsklick (oder ctrl + Klick) auf die App → **"Öffnen"** → **"Öffnen"**.

Falls macOS behauptet, die App sei **"beschädigt"**: Terminal öffnen (Programme → Dienstprogramme → Terminal), diese Zeile einfügen und Enter drücken, danach die App erneut starten:

```bash
xattr -cr "/Applications/wessamedia Zeit.app"
```

Auf dem Mac fragt die App **eine** Berechtigung an: **Bildschirmaufnahme**. Sie nimmt nichts auf, macOS verlangt diese Berechtigung nur, damit ein Programm die **Fenstertitel** anderer Programme lesen darf. Erst damit sieht die App, ob im Browser YouTube, Google Sheets oder Instagram offen ist (wie unter Windows). So geht es: Beim ersten Start erscheint die Frage von macOS, dort **"Systemeinstellungen öffnen"** wählen, in der Liste **Bildschirmaufnahme** den Schalter bei **"wessamedia Zeit"** einschalten und die App **neu starten**. Falls die Frage nicht erschien: in der App unter **Einstellungen → System → Fenstertitel** auf **"Berechtigung anfragen"** klicken. Nach einem Update der App kann macOS die Berechtigung erneut verlangen, weil die App nicht von Apple signiert ist; dann den Schalter einmal aus- und wieder einschalten. Bedienungshilfen werden nicht angefordert.

Deinstallieren: App aus dem Ordner Programme in den Papierkorb ziehen. Vorher über das Menüleisten-Symbol **"Beenden"** wählen.

### Erster Start

Beim ersten Start fragt die App nach **E-Mail und Passwort**. Das ist euer Konto in der Supabase-Datenbank, das Moritz angelegt hat (Abschnitt 5). Die Anmeldung bleibt gespeichert; abmelden geht in den Einstellungen unter "Konto".

Sobald ihr angemeldet seid, läuft die Erfassung. Es gibt nichts weiter einzurichten.

---

## 2. Bedienung

### Das Symbol im Infobereich (Windows) bzw. in der Menüleiste (Mac)

Ein Klick auf das Symbol öffnet ein kleines Menü:

- **Öffnen**: das Fenster zeigen.
- **Pause** / **Fortsetzen**: Erfassung anhalten, etwa in der Mittagspause. Solange Pause ist, entsteht kein Zeitblock.
- **Beenden**: die App wirklich schließen.

Das **rote X** oben im Fenster schließt nur das Fenster, die Erfassung läuft weiter. Das ist Absicht.

### Wie die Erfassung arbeitet

**Seit Version 1.0.40 zählt Zeit nur noch im Fokus.** Ohne Fokus nimmt die App nichts auf: kein Block, keine rote Zeit, nichts zum Zuordnen. Oben steht dann "Kein Fokus, Zeit zählt nicht", der Knopf **Fokus** leuchtet grün, und wer zehn Minuten ohne Fokus arbeitet, bekommt einmal eine Systemmeldung (Klick öffnet den Fokus-Dialog). Im Fokus läuft alles wie unten beschrieben, nur dass jeder Block automatisch die Fokus-Tätigkeit bekommt und produktiv ist; Programme und Tabs werden weiter mitgeschrieben, damit man später sieht, was man getan hat. Wer die alte durchgehende Aufzeichnung mit Regeln zurück will, schaltet unter Einstellungen → Erfassung "Nur im Fokus aufzeichnen" aus.

- Alle 5 Sekunden schaut die App nach, welches Programm vorne ist. Wechselt das Programm (unter Windows auch der Fenstertitel), beginnt ein neuer Block. Blöcke unter einer Minute werden mit dem Nachbarn zusammengelegt. In der Tagesliste erscheinen mehrere Blöcke desselben Programms direkt hintereinander als eine Zeile mit dem Chip "3 Abschnitte"; ein Klick darauf öffnet alle Abschnitte zusammen.
- Die Zeit in wessamedia Zeit selbst zählt nicht als Arbeit. Ein kurzer Blick in die App (bis 2 Minuten) läuft beim vorherigen Programm einfach mit, bleibst du länger, endet der vorherige Block beim Wechsel in die App und es wird nichts aufgezeichnet, bis du wieder in einem anderen Programm bist.
- **Untätigkeit**: Kommt 3 Minuten lang keine Eingabe (einstellbar in den Einstellungen), gilt die Zeit rückwirkend ab dem letzten Tastendruck als inaktiv. Nach 60 Minuten Untätigkeit hört die Erfassung auf und wartet auf die nächste Eingabe.
- Ruhezustand, Sperren und Mitternacht beenden den laufenden Block sauber.
- Jeder Block bekommt eine **Bewertung**: produktiv (grün), unproduktiv (rot) oder ungeklärt (hellgrau). Nur produktive Zeit zählt für Ränge und Ziele.
- **Nicht am Rechner zählt als unproduktiv.** Tippst du länger als die eingestellte Zeit (Standard 3 Minuten) nichts, entsteht ein roter Block "Nicht am Rechner", rückwirkend ab der letzten Eingabe. Die App sieht nur den Rechner, Handy oder Sofa kann sie nicht unterscheiden. Warst du in der Zeit beim Kunden, am Telefon oder am Handy für die Arbeit, trag es unter **Eintragen** nach; der Eintrag ersetzt die rote Zeit. Beim Eintragen zeigt die App, was der Rechner in der Zeit aufgezeichnet hat, Zeile für Zeile; ein Klick auf eine Zeile übernimmt deren Von und Bis, das Häkchen löscht die Blöcke. Seit Version 1.0.47 gilt im Fokus-Modus: Zeit ohne Eingabe im Fokus ist eine neutrale **Pause** (blau, zählt nicht), nicht mehr rot; rote Zeit gibt es nur noch durch Regeln oder von Hand. Ohne rote Zeit verschwinden Fokus-Quote und rote Anteile aus den Anzeigen, stattdessen steht "Pausen im Fokus".
- **Länger als 90 Minuten weg heißt "Abwesend" (blau) und zählt gar nicht.** Schlafen, Feierabend, ein langer Termin: Sobald die Abwesenheit 90 Minuten überschreitet, wird der ganze Block blau, auch der rote Anfang. Blau zählt weder als produktiv noch als unproduktiv. Das gilt auch, wenn der Laptop zugeklappt, gesperrt oder ausgeschaltet war: Sobald die App wieder läuft, trägt sie die Lücke nach, unter 90 Minuten rot, darüber blau, bis zu 7 Tage zurück. Nur die Pause-Funktion bleibt leer.
- Die **Fokus-Quote** (Woche, Wochenzusammenfassung, Wochenrückblick) sagt, wie viel von allem Gezählten produktiv war; blaue Zeit zählt dabei nicht mit. Ab 80 Prozent in einer Woche auf Zielrang gibt es die Medaille "Fokus-Woche".

### Die sechs Screens (Navigation unten)

1. **Heute**: Ring mit den vier Anteilen, produktive Stunden groß, der laufende Block, ein Hinweis auf ungeklärte Blöcke mit "Durchgehen" und die Liste aller Blöcke des Tages. Mit den Pfeilen blättert man zu früheren Tagen. Ein Klick auf einen Block öffnet ihn zum Bearbeiten (Bewertung, Tätigkeit, Notiz, Regel anlegen, Löschen). Über der Liste liegt seit 1.0.48 der **Tagesverlauf**: ein Zeitstrahl von 7 bis 20 Uhr, grün ist gezählte Zeit, rot ist Zeit ohne dich am Rechner (gestrichelt: keine Aufzeichnung, glatt: Pause im Fokus). Klick auf Rot öffnet "Nachtragen"; nachgetragen wird die Zeit grün.
2. **Woche**: Rang-Ring, Balken Montag bis Sonntag (grün = produktiv, nur das zählt gegen die Richtwert-Linie; Unproduktives und Ungeklärtes schmal daneben; der Richtwert ist das Ziel geteilt durch die Arbeitstage, einstellbar 5 bis 7 unter Einstellungen → Wochenziele), Tätigkeiten gegen ihre Wochenziele, "Woche durchgehen" für auffällige Blöcke, die Auszeichnungen und ab Sonntagabend die Wochenzusammenfassung. Der Knopf "Alle 15 Ränge ansehen" zeigt die Übersicht.
3. **Auswertung**: Verlauf, Trend der Wochenränge, Verteilung der Tätigkeiten und Hochrechnung auf Woche, Monat und Jahr. Der Zeitraum ist oben wählbar (7 Tage bis 12 Monate). Die Karte **Wann du arbeitest** (seit 1.0.49) zeigt für den gewählten Zeitraum, zu welchen Uhrzeiten du im Schnitt am meisten schaffst: drei Sätze (produktivste Phase, schwächste Stunde, stärkster Wochentag), Balken je Stunde des Tages (Schnitt über deine Arbeitstage, volle Höhe = 60 Minuten) und ein Raster Wochentag mal Stunde, je grüner, desto mehr Arbeit; die Maus über einer Zelle zeigt die Minuten. Gerechnet wird über die Blöcke auf diesem Rechner, also höchstens 13 Wochen zurück. Dazu der **Kundenbericht** (seit 1.0.47): produktive Stunden je Kunde im Monat, alle drei zusammen, je Person und Tätigkeit, mit "Als Datei speichern" als CSV-Tabelle für Excel und Rechnung.
4. **Team**: Wochenstunden aller drei, Rang-Abzeichen, dazu die Karte "Was die anderen machen": je Person, woran sie gerade sitzt ("Gerade: Konzept seit 09:12") und welche Tätigkeiten heute oder diese Woche wie viele Stunden bekommen haben, mit Kunde. Man sieht nur Tätigkeiten und Summen, keine Programme oder Fenstertitel. Darunter Verlauf über mehrere Wochen und Rangliste. Die eigene Linie ist grün. Braucht einmalig das Skript 18 in Supabase.
5. **Eintragen**: Zeiten von Hand, etwa Kundentermine oder Fahrten. Überschneidet sich der Eintrag mit automatischen Blöcken, warnt die App und bietet an, diese zu ersetzen. Einfacher geht es auf "Heute": Zeiten ohne Aufzeichnung (kein Fokus, 7 bis 20 Uhr, ab 15 Minuten) stehen dort als eigene Zeile "Keine Aufzeichnung" mit dem Knopf **Nachtragen**, die Uhrzeiten sind schon eingetragen.
6. **Einstellungen**: Untätigkeitsgrenze, Fenstertitel speichern, Autostart, Wochenziele, Regeln, Tätigkeiten und Symbole, Urlaubswochen für die Hochrechnung, Datenbank-Abgleich, Konto. Tätigkeiten lassen sich dort auch umbenennen oder zusammenlegen (Stift neben dem Namen, gilt für alle drei, Skript 19).

### Tempo, der KI-Assistent (seit 1.0.49)

Oben rechts steht **Tempo** (grüner Blitz). Ein Klick öffnet einen Chat mit Tempo, dem Assistenten der App. Er läuft über ein Claude-Modell, kennt diese ganze Anleitung, alle Spielregeln (Ränge, Ligen, Medaillen mit ihren genauen Bedingungen), das Wissen über wessamedia (siehe unten) und deinen aktuellen Stand sieht (laufender Fokus, Stunden heute und diese Woche, Rang, Einstellungen, ob der Abgleich läuft). Es sieht keine einzelnen Blöcke und keine Fenstertitel. Frag es alles rund um die App: "Wie trage ich einen vergessenen Termin nach?", "Warum zählt meine Zeit gerade nicht?", "Was bedeutet Rang 7?". Antworten kommen nach ein paar Sekunden.

Einmalig einrichten: Auf console.anthropic.com anmelden (das Anthropic-Konto von wessamedia), links **API Keys**, **Create Key**, den Schlüssel kopieren (beginnt mit `sk-ant-`), in der App unter **Einstellungen → KI-Assistent** einfügen und **Speichern**. Der Schlüssel liegt verschlüsselt nur auf diesem Rechner, nie in der Datenbank; jede Person richtet ihn einmal ein. Jede Frage kostet wenige Cent vom Guthaben des Anthropic-Kontos. Unter Einstellungen → KI-Assistent lässt sich der Schlüssel wieder entfernen.

**Wissen über wessamedia:** Unter Einstellungen → KI-Assistent stehen zwei Textfelder, "Über wessamedia" und "Kunden und Projekte". Was dort steht, kennt der Assistent zusätzlich zur Anleitung, und zwar bei allen dreien (die Texte liegen in der gemeinsamen Datenbank, Skript 20). Einfach schreiben, wie man es einem neuen Kollegen erklären würde: wer was macht, welche Leistungen es gibt, wie die Abläufe sind, was bei einzelnen Kunden wichtig ist. Fragen zur Firma oder zu Kunden beantwortet er nur aus diesen Texten und erfindet nichts; fehlt etwas, sagt er das und schlägt vor, es dort einzutragen. Der Assistent kennt außerdem die genauen Spielregeln (alle Ränge mit Stunden, alle Ligen mit Trophäen, alle Auszeichnungen mit Bedingung), die er direkt aus der App bezieht.

### Fokus: eine Tätigkeit für alles

Regeln kennen nur das Programm, nicht dein Thema. Wer sich über Instagram weiterbildet, springt zwischen Claude, Instagram und YouTube hin und her, und jeder Wechsel wäre ein eigener Block zum Zuordnen. Dafür gibt es den **Fokus**: Klick oben rechts auf **Fokus** (oder auf der Heute-Karte "Fokus starten", oder Strg+F, am Mac Cmd+F), Tätigkeit antippen, Beginn wählen (jetzt, vor 15/30/60 Minuten oder seit einer Uhrzeit), fertig. Ab dann zählt alles als produktiv mit dieser Tätigkeit, egal welches Programm vorne ist. Rückwirkend gestartet wird die Zeit seit dem Beginn als Block mit dieser Tätigkeit nachgetragen (gab es in der Zeit schon Blöcke, bekommen die die Tätigkeit). Oben steht "Fokus: Instagram Learning · seit 09:01" und daneben **Fokus beenden**; auch das Symbol-Menü kann ihn beenden oder einen neuen starten. Der Fokus endet von selbst um Mitternacht oder wenn du länger als 90 Minuten nichts tust; ein Neustart der App (Update) beendet ihn nicht. Seit Version 1.0.40 ist der Fokus der einzige Weg, Zeit zu zählen (siehe oben); Termine außer Haus trägt man von Hand ein.

**Ehrlich bleibt es trotzdem (seit 1.0.42):** Was eine Regel als unproduktiv einstuft (Netflix, privates YouTube), bleibt auch im Fokus rot; nur Produktives und Ungeklärtes bekommt die Fokus-Tätigkeit. Alle zwei Stunden fragt eine Systemmeldung, ob der Fokus noch stimmt. Das Symbol unten rechts (Windows) ist grün, solange Zeit zählt, sonst grau; am Mac steht in der Menüleiste "Kein Fokus".

**Am Rechner oder unterwegs (seit 1.0.41):** Jede Tätigkeit gehört an einen Ort. "Am Rechner" (Instagram Learning, Konzept, Orga …) steht im Fokus-Dialog. "Unterwegs" (Dreh, Fahrt, Kundentermin, Telefonat) steht nicht im Fokus, sondern beim Nachtragen und in der Rückfrage nach einer Abwesenheit ganz vorne. So kann man einen Dreh nicht versehentlich als Fokus starten (der würde nach 3 Minuten ohne Eingabe zur Pause). Umsortieren unter Einstellungen → Tätigkeiten und Symbole, Chip rechts antippen; gilt für alle drei.

**Schneller starten (seit 1.0.47):** Der Fokus-Dialog zeigt oben "Zuletzt": die letzten drei Kombinationen aus Tätigkeit und Kunde, ein Klick startet sofort. Strg+Alt+F (Mac: Cmd+Alt+F) öffnet den Dialog von überall, auch wenn die App im Hintergrund liegt. Der Knopf "Pause" ist im Fokus-Modus weg, "Fokus beenden" ist die Pause.

Nachträglich geht es auch: In der Tagesliste **Auswählen**, den ersten und den letzten Block der Phase anklicken, **Alles dazwischen**, dann unten die Tätigkeit setzen.

### Regeln und das Ungeklärt-Postfach

Neue Programme kennt die App nicht, solche Blöcke landen als **ungeklärt** im Postfach auf dem Heute-Screen. Dort sind sie **nach Programm gebündelt**, im Browser zusätzlich nach Seite: eine Zeile je Gruppe wie "Google Chrome · YouTube" mit Anzahl und Gesamtdauer. **"Alle 37 zuordnen"** öffnet einen Dialog mit einer Vorgabe für alle und darunter jedem Block einzeln, mit Datum, Uhrzeit, Dauer und dem Tab- oder Videotitel; jeder Block kann dort eine eigene Bewertung und Tätigkeit bekommen. In allen Listen und auf der Gerade-Karte steht bei Browser-Blöcken die Seite vorne (YouTube, Google Sheets, Google Drive, Instagram, Meta Business Suite ...), der Browser als kleiner Chip daneben und darunter der Tab-Titel, etwa der Name des Videos. Das geht nur unter Windows, weil die App auf dem Mac keine Fenstertitel liest. Das Häkchen **"Zuordnung künftig immer anwenden"** macht daraus eine Regel, dann bewertet die App dieses Programm ab sofort und rückwirkend für alle nicht von Hand geprüften Blöcke automatisch. Wer lieber jeden Block einzeln sehen will, klappt die Zeile auf oder nimmt "Einzeln durchgehen".

**Kurze Wechsel erben ihre Umgebung.** Wer mitten in der Arbeit für zwei Minuten in Teams, Asana oder den Kalender schaut und dann zurückkommt, bekommt dafür keinen ungeklärten Block: Ein ungeklärter Wechsel bis 5 Minuten zwischen zwei Blöcken derselben Tätigkeit wird dieser Tätigkeit zugeschlagen. Greift eine Regel (etwa YouTube ist unproduktiv), gilt die Regel.

- **Team-Regeln** gelten für alle drei, **persönliche Regeln** nur für einen selbst. Persönliche gehen vor.
- Regeln nach **Fenstertitel** (zum Beispiel "YouTube" im Browser ist unproduktiv, "Google Ads" produktiv) sind genauer als Regeln nach Programm. Bei Browsern lohnt sich das, weil man dort alles Mögliche machen kann.
- Von Hand geprüfte Blöcke fasst keine Regel mehr an.
- Alle Regeln lassen sich in den Einstellungen ändern oder löschen.

### Ränge

Jede Woche beginnt bei Rang 0. Bis Rang 10 gibt es alle 5 produktiven Stunden einen Rang, darüber alle 2 Stunden. Rang 10 ist das Wochenziel von 50 Stunden, Rang 15 mit 60 Stunden ist das Maximum.

| Rang | Stunden | Name | Rang | Stunden | Name |
| --- | --- | --- | --- | --- | --- |
| 1 | 5 | Recruit | 9 | 45 | Overlord |
| 2 | 10 | Initiate | 10 | 50 | Champion |
| 3 | 15 | Vanguard | 11 | 52 | Titan |
| 4 | 20 | Warden | 12 | 54 | Legend |
| 5 | 25 | Sentinel | 13 | 56 | Mythic |
| 6 | 30 | Paladin | 14 | 58 | Immortal |
| 7 | 35 | Conqueror | 15 | 60 | Eternal |
| 8 | 40 | Warlord | | | |

Bronze 1 bis 3, Silber 4 bis 6, Gold 7 bis 9, Champion 10, Diamant 11 bis 15. Jede Stufe hat ein eigenes, illustriertes Wappen (mit KI erzeugt), ebenso jede der 14 Auszeichnungen eine eigene Medaille, darauf stehen Rangzahl, Sterne und Name; die Ligen haben ebenfalls eigene Wappen mit römischer Ziffer. Beim Aufstieg erscheint eine große Einblendung: Wappen mit Strahlenkranz, Druckwellen und Funken in der Farbe der Stufe, dazu ein Klang; sie schließt nach ein paar Sekunden oder mit einem Klick. Wer sein Gesamtziel in den Einstellungen ändert (zum Beispiel 40 Stunden), bekommt einen anderen Ziel-Rang (dann Rang 8); die Stundengrenzen der Ränge bleiben gleich.

### Updates

Die App sieht kurz nach dem Start und danach alle vier Stunden auf GitHub nach, ob es eine neue Version gibt. Unter Windows wird sie im Hintergrund geladen und beim nächsten Start eingespielt, eine Leiste über der Navigation bietet den Neustart an. Auf dem Mac (seit 1.0.44) lädt die App die neue `.dmg` ebenfalls im Hintergrund; ein Klick auf **Jetzt neu starten** tauscht die App im Ordner Programme aus (die alte Fassung landet im Papierkorb) und startet sie neu, ohne erneute Warnung von macOS. Das geht nur, wenn die App im Ordner Programme liegt; sonst öffnet der Knopf wie früher die Download-Seite. Unter Einstellungen → System → Updates steht der Stand, dort lässt sich auch sofort prüfen.

**Update-News (seit 1.0.48):** Die Leiste zeigt mit "Was ist neu?" schon vor dem Einspielen, was die neue Version bringt. Nach dem Update erscheint beim ersten Start einmal ein Fenster mit allen Änderungen seit der zuletzt gesehenen Version (wer Versionen überspringt, sieht alle dazwischen). Unter Einstellungen → System → **Was ist neu** lässt es sich jederzeit wieder öffnen.

### Wochenrückblick

Jeden Montag, sobald die App sichtbar ist, erscheint einmal ein Wochenrückblick als Vollbild: erreichter Rang mit Wappen, produktive und unproduktive Stunden, bester Tag, Trophäen der Woche, Platz im Team und die neu freigeschalteten Auszeichnungen. Ein Klick auf „Auf in die neue Woche" schließt ihn. In der Liga-Rangliste auf dem Team-Screen steht bei jeder Person außerdem, wie viele Trophäen die laufende Woche voraussichtlich bringt.

### Hintergrund

Seit 1.0.12 liegt hinter der App das wessamedia-Logo: die Wortmarke als blasses Wasserzeichen in der Mitte, das Linienmuster oben und unten, und orangene Lichtketten, die die Buchstaben und Linien entlangfahren. Wer den bisherigen Hintergrund (Raster, Zifferblätter, grüne, orangene und lila Lichtbahnen) lieber mag, stellt unter Einstellungen → Darstellung → Hintergrund auf **Klassisch** um. Die Einstellung gilt je Rechner.

### Töne

Die App klickt leise bei Knöpfen, wischt beim Screen-Wechsel und spielt Klänge bei Aufstieg und Auszeichnungen. Alle Töne entstehen in der App selbst, es werden keine Dateien geladen. Unter Einstellungen → Töne lassen sie sich ausschalten, in der Lautstärke regeln und probehören; für den Klick stehen mehrere Arten zur Wahl (Tock, Pop, Tap, Fein oder kein Klick).

### Die Liga

Der Wochenrang fängt jeden Montag bei null an. Die Liga dagegen bleibt, wie die Ligen in Clash of Clans: Jede abgeschlossene Woche bringt Trophäen dazu oder nimmt welche weg, und die Trophäen bestimmen die Liga.

- Pro Woche gibt es 10 Trophäen je produktive Stunde über oder unter dem neutralen Punkt. Der liegt 10 Stunden unter dem eigenen Wochenziel, bei 50 Stunden Ziel also bei 40. Das Ziel erreicht heißt +100, eine 30-Stunden-Woche kostet 100. Höchstens +200 und höchstens −120 pro Woche.
- Wochen ohne einen einzigen Block (App aus) zählen nicht. Die laufende Woche zählt erst nach Sonntag; auf dem Wochen-Screen steht schon vorher, was sie bringen würde.
- **Urlaub** trägt man unter Einstellungen → Urlaub ein (von, bis, Notiz). Urlaubstage senken die Erwartung der Woche anteilig, an allen sieben Tagen: Bei zwei Urlaubstagen erwartet die Liga nur fünf Siebtel, eine ganze Urlaubswoche kostet nichts. Das gilt genauso für Feiertage und Krankheit. Wer im Urlaub trotzdem arbeitet, bekommt Trophäen dazu.
- Unter 0 Trophäen fällt niemand: Wer bei 0 steht, verliert durch eine schwache Woche nichts (wie in Clash of Clans). Die Wochen-Karte zeigt deshalb, was die Woche am Stand wirklich ändert, und nennt den rohen Wert dazu.
- Die Liga läuft dauerhaft weiter und wird nie zurückgesetzt.
- Jeder startet bei 0 Trophäen ohne Liga und erreicht mit etwa vier Zielwochen die Bronze-Liga III ab 400. Die Ligen: Bronze, Silber, Gold, Kristall, Meister, Champion und Titan mit je drei Stufen (III, II, I), darüber ab 5.000 Trophäen die Legenden-Liga. Alle Schwellen, die Regel und Beispielwochen stehen in der App unter "So funktioniert die Liga".
- Die Liga-Rangliste des Teams steht oben auf dem Team-Screen.

### Auszeichnungen

36 Medaillen in acht Gruppen, die man dauerhaft behält (einmal verdient, nie zurückgesetzt). Auf dem Wochen-Screen ganz unten; mit der Maus über eine Medaille fahren zeigt die Bedingung. Sie sind auf eine 50-Stunden-Woche von Montag bis Sonntag ausgelegt.

- **Besondere**: Erster Champion (zum ersten Mal Rang 10), Comeback (nach einer Woche unter Rang 5 direkt Rang 10), Eternal (Rang 15).
- **Serien**: Serie (3 Wochen in Folge Rang 10), Lange Serie (6), Eiserne Serie (12), Dauerbrenner (4 Wochen in Folge mindestens 55 h, also deutlich über dem Ziel).
- **Stunden-Meilensteine**: 100, 500, 1.000, 2.500 und 5.000 produktive Stunden seit dem Start.
- **Liga**: je eine Medaille beim ersten Erreichen von Bronze-, Silber-, Gold-, Kristall-, Meister-, Champion-, Titan- und Legenden-Liga.
- **Tage**: Perfekte Woche (alle 7 Tage mindestens 5 h), Durchläufer (7 Tage in Folge mindestens 4 h), Marathon (10 h an einem Tag), Ultra (12 h an einem Tag), Sprint (3 h am Stück).
- **Team**: Wochensieger (die meisten Stunden im Team in einer abgeschlossenen Woche), Dauersieger (3 Wochen in Folge), Team-Woche (alle drei erreichen in derselben Woche ihr Ziel).
- **Lernen und Disziplin**: Alle Lernziele, Lernmeister (4 Wochen in Folge alle Lernziele), Fokus-Woche (Rang 10 mit höchstens 2 h unproduktiv), Aufgeräumt (abgeschlossene Woche mit 40 h, höchstens 2 h unproduktiv, ohne Ungeklärtes), Blitzsauber (4 solche Wochen in Folge).
- **Uhrzeit**: Frühaufsteher (2 h vor 8 Uhr in einer Woche), Nachteule (2 h nach 22 Uhr), Wochenend-Krieger (15 h an einem Wochenende).

Die Stunden-Meilensteine und die neuen Typen brauchen einmalig das Skript 13 in Supabase (siehe Abschnitt 5).

### Wochenzusammenfassung

Sonntags ab 18 Uhr meldet sich die App einmal kurz und zeigt auf dem Wochen-Screen den Zwischenstand: Rang, Stunden, produktiv gegen unproduktiv, welche Ziele erreicht sind, neue Auszeichnungen und ob noch ungeklärte Zeit offen ist. Montags steht dort die fertige Zusammenfassung der Vorwoche. Beim Blättern zu früheren Wochen erscheint sie ebenfalls.

---

## 3. Symbole für Tätigkeiten

Jede Tätigkeit hat ein Symbol, das für das ganze Team gilt. Ändern: **Einstellungen → Tätigkeiten und Symbole** → auf das Symbol neben der Tätigkeit klicken → Marke (Instagram, TikTok, LinkedIn, Adobe, Canva, ChatGPT ...) oder ein allgemeines Symbol wählen. Seit 1.0.48 bekommt jede neue Tätigkeit automatisch einen passenden Vorschlag aus ihrem Namen (Telefon bei "Call", Filmklappe bei "Dreh", Instagram-Logo bei "Instagram Learning" ...); alle vorhandenen Tätigkeiten ohne Symbol wurden einmal so belegt. Der Vorschlag lässt sich wie jedes Symbol ändern.

---

## 4. Wenn etwas hakt

- **Rechts oben steht "Nicht verbunden"**: kein Internet oder die Datenbank schläft. Die App arbeitet offline weiter und gleicht später ab. Bleibt es länger so: Moritz schaut im Supabase-Dashboard, ob das Projekt pausiert ist (Knopf "Restore project").
- **Passwort vergessen**: Moritz setzt es in Supabase neu (Authentication → Users → Nutzer anklicken → Passwort zurücksetzen).
- **Ein Programm wird als "ungeklärt" gezählt**: Block anklicken, zuordnen, Häkchen für die Regel setzen.
- **Der Schreibtisch oder Systemfenster tauchen als Programm auf**: Das sollte nicht passieren; falls doch, bitte Moritz sagen, dann kommt der Name auf die Ausnahmeliste.
- **Die App startet nicht mehr mit dem Rechner**: Einstellungen → Erfassung → Autostart einschalten.
- **Zwei Personen am selben Rechner**: In den Einstellungen abmelden, dann meldet sich die andere Person an. Die lokalen Daten sind je Konto getrennt.
- **Eine rote Leiste "Die App hakt" erscheint** (seit 1.0.48): Der Wachhund prüft jede Minute, ob die Erfassung noch tickt, ob Änderungen gespeichert werden und ob wartende Blöcke in die Datenbank kommen. Hakt etwas, sagt die Leiste, was, und **App neu starten** behebt es meistens. Nach dem Aufwachen des Rechners und nach dem Start wartet er fünf Minuten, bevor er prüft, und keine Prüfung reicht über einen Schlaf hinweg (seit 1.0.49). Bleibt es danach rot: Einstellungen → System → **Protokoll öffnen** zeigt die Datei `protokoll.log` mit den Fehlern; die kann man in den Chat hängen.
- **Ein Block wurde versehentlich gelöscht**: Direkt nach dem Löschen erscheint unten "Rückgängig". Später: Einstellungen → **Papierkorb** listet alles, was in den letzten 30 Tagen gelöscht wurde, mit "Wiederherstellen" (der Fenstertitel wurde beim Löschen entfernt und bleibt leer).
- **Daten sichern oder an die Buchhaltung geben**: Einstellungen → **Datenexport** speichert alle Blöcke eines Zeitraums (Monat, Jahr, alles) als Excel-Tabelle (CSV) mit Datum, Zeiten, Dauer, Tätigkeit, Kunde, Bewertung, Programm, Fenstertitel und Notiz.

---

### Kunde oder Projekt

Neben der Tätigkeit ("was") kann jeder Block einen **Kunden** ("für wen") bekommen, zum Beispiel eine Firma oder ein Projekt. Kunden wählst du im Block-Dialog, beim Fokus, beim Nachtragen und beim Eintragen: alle bekannten Kunden als Chips, "Kein Kunde" oder "+ Neuer Kunde". Die Liste gilt für das ganze Team, Schreibweisen werden zusammengeführt. Regeln bleiben bei Tätigkeiten. Dafür muss einmal das Skript 14 (`supabase/14_kunde.sql`) in Supabase laufen; vorher bleiben Kunden nur auf dem eigenen Rechner.

**Wo sehe ich die Kunden?** Auf der **Auswertung** gibt es die Karte "Kunden": jeder Kunde mit produktiven Stunden im gewählten Zeitraum, Balken, Anteil in Prozent und letztem Einsatz, sortiert nach Stunden, darunter "Ohne Kunde" und der Verteilungsring. Die Karte rechnet aus den Blöcken der letzten 13 Wochen auf diesem Rechner. Unter **Einstellungen → Kunden** stehen alle Kunden des Teams: "Umbenennen" ändert den Namen in allen Blöcken aller Personen; gibst du einen Namen ein, den es schon gibt, werden beide Kunden zusammengelegt. Der Papierkorb nimmt den Kunden aus der Liste und aus allen Blöcken (die Blöcke bleiben, nur ohne Kunden). Dafür muss einmal das Skript 15 (`supabase/15_kunde_verwalten.sql`) in Supabase laufen.

### Termine, Drehs und Fahrten eintragen (seit 1.0.49 ohne "Ich bin weg")

Was nicht am Rechner passiert, wird von Hand eingetragen, auf drei Wegen: (1) Auf **Heute** ist Zeit ohne Aufzeichnung rot (im Tagesverlauf gestrichelt, in der Liste als Zeile "Nicht am Rechner"). Ein Klick darauf öffnet **Nachtragen** mit Von und Bis schon ausgefüllt; Tätigkeit antippen, Speichern, die Zeit wird grün. (2) Unter **Eintragen** mit Datum, Von, Bis, Tätigkeit, Kunde und Notiz, auch für vergangene Tage. (3) Warst du im Fokus 15 Minuten bis 3 Stunden nicht am Rechner, fragt die App danach auf "Heute": **Pause** (zählt nicht), eine **Tätigkeit** (produktiv), **Privat** oder **Später**. Den früheren Knopf "Ich bin weg" gibt es seit 1.0.49 nicht mehr; läuft aus einer älteren Version noch eine Abwesenheit, bleibt nur "Zurück" zum Beenden.

## 5. Supabase einrichten (macht Moritz einmalig)

Die ausführliche Klick-Anleitung mit Bildern steht in [`docs/supabase-einrichtung.md`](docs/supabase-einrichtung.md). Kurzfassung:

1. Auf https://supabase.com anmelden, Projekt in der Region **Frankfurt** anlegen.
2. Im **SQL Editor** nacheinander die Skripte aus dem Ordner `supabase/` einfügen und mit "Run" ausführen:
   - `01_tabellen.sql` (Tabellen und Zugriffsrechte)
   - `02_startwerte.sql` (Namen, Ziele, Startregeln; vorher die drei E-Mail-Adressen oben im Skript prüfen)
   - `05_auswertung.sql`, `06_team.sql`, `08_liga.sql`, `09_urlaub.sql`, `10_liga_start_null.sql`, `11_auszeichnungen.sql`, `12_liga_nicht_unter_null.sql` und `13_auszeichnungen_erweitert.sql` (Funktionen für lange Auswertungen, den Team-Verlauf, die Liga, den Urlaub und die erweiterten Auszeichnungen)
   - optional `03_testdaten_einfuegen.sql` zum Anschauen, später `04_testdaten_entfernen.sql`. **Vor dem echten Einsatz Skript 4 ausführen**, sonst stehen die erfundenen Wochen in den Auswertungen.
3. Unter **Authentication → Sign In / Providers → Email** den Schalter **"Allow new users to sign up"** ausschalten, damit niemand Fremdes ein Konto anlegen kann.
4. Unter **Project Settings → API Keys** die **Project URL** und den **Publishable key** kopieren. Diese beiden Werte werden beim Bauen fest in die App eingebaut (Abschnitt 7). Den **Secret key** nie verwenden oder weitergeben.

### Die drei Benutzerkonten anlegen

1. Links **Authentication** → **Users** → **"Add user"** → **"Create new user"**.
2. E-Mail eintragen (`moritz@wessamedia.com`), ein Passwort vergeben, Häkchen **"Auto Confirm User"** setzen, **"Create user"**.
3. Dasselbe für `filipo@wessamedia.com` und `leon@wessamedia.com`.
4. Die Passwörter persönlich weitergeben. Ändern geht über die Nutzerliste (Nutzer anklicken → Passwort zurücksetzen).

Die Namen, Ziele und Startregeln bekommen die Konten durch Skript 2. Es sucht die Konten über die E-Mail-Adressen, deshalb die Konten **vor** Skript 2 anlegen.

---

## 6. Wo die Daten liegen

- **Datenbank**: alle Blöcke, Regeln, Ziele und Auszeichnungen liegen in eurem Supabase-Projekt. Jede Person kann nur ihre eigenen Blöcke lesen und ändern; der Team-Screen sieht nur Wochensummen.
- **Lokal** liegt ein Zwischenspeicher der letzten 13 Wochen, damit die App auch ohne Internet funktioniert:
  - Windows: `C:\Users\<Name>\AppData\Roaming\wessamedia Zeit\`
  - Mac: `~/Library/Application Support/wessamedia Zeit/`
  
  Dort liegen auch die gespeicherte Anmeldung (verschlüsselt) und die Einstellungen. Der Ordner bleibt beim Deinstallieren stehen; wer ihn löscht, muss sich einmal neu anmelden, verliert aber keine Daten, die schon in der Datenbank sind.
- Der Abgleich läuft alle 60 Sekunden. Rechts oben im Fenster steht, wann zuletzt abgeglichen wurde. Einmal am Tag (nach Mitternacht) macht die App zusätzlich einen Vollabgleich wie beim Start: Blöcke, die in der Datenbank gelöscht wurden, verschwinden dann auch aus dem Zwischenspeicher, ohne Neustart.

---

## 7. Installer bauen

Der Code liegt bei GitHub unter `Moritzrx/zeiterfassung` (öffentlich, ohne Zugangsdaten). Der Ablauf "Installer bauen" (Reiter Actions) baut den Windows-Installer und das Mac-Abbild auf den Rechnern von GitHub; bei einer Versionsmarke wie `v1.1.0` entsteht zusätzlich eine Veröffentlichung mit beiden Dateien, aus der sich die App unter Windows selbst aktualisiert. Erster erfolgreicher Lauf am 9. September 2026, das Mac-Abbild liegt seitdem in Dokumente → Zeiterfassung App.

Die Zugangsdaten (Project URL und Publishable key) werden beim Bauen in die App eingebaut. Die Datei `.env` im Projektordner (Vorlage: `.env.example`) enthält sie und wandert nie ins Git.

### Windows-Installer auf dem Windows-PC

Doppelklick auf `scripts\installer-windows.cmd`. Nach zwei bis fünf Minuten liegt `dist\wessamedia-Zeit-<Version>-Windows.exe` bereit.

### Beide Installer automatisch über GitHub

Ein Windows-PC kann keine `.dmg` bauen. Deshalb bauen die Rechner von GitHub beide Installer, kostenlos für private Projekte.

Einmalig einrichten:

1. Konto auf https://github.com anlegen und ein **privates** Repository anlegen, zum Beispiel `zeiterfassung`.
2. Den Projektordner dorthin hochladen (Moritz macht das mit Git; die Zugangsdaten bleiben draußen).
3. Im Repository: **Settings → Secrets and variables → Actions → "New repository secret"**. Zwei Einträge anlegen:
   - Name `VITE_SUPABASE_URL`, Wert: die Project URL
   - Name `VITE_SUPABASE_PUBLISHABLE_KEY`, Wert: der Publishable key

Bauen:

1. Im Repository auf den Reiter **Actions** → links **"Installer bauen"** → rechts **"Run workflow"** → grüner Knopf **"Run workflow"**.
2. Etwa 10 bis 15 Minuten warten, bis beide Häkchen grün sind.
3. Den Lauf anklicken. Unten unter **"Artifacts"** liegen `wessamedia-Zeit-Windows` und `wessamedia-Zeit-Mac` als Zip-Dateien. Herunterladen, entpacken, weitergeben.

Für eine nummerierte Version kann Moritz zusätzlich eine Marke setzen (`git tag v1.0.0` und `git push --tags`). Dann entsteht unter **Releases** automatisch eine Seite mit beiden Dateien zum Herunterladen.

### Neue Version verteilen

Versionsnummer in `package.json` erhöhen, in `src/shared/aenderungen.json` oben einen Eintrag mit Titel und Punkten für die Version ergänzen (daraus entstehen die Beschreibung der Veröffentlichung und das "Neu in Version"-Fenster in der App), committen, Tag `vX.Y.Z` pushen; GitHub baut beide Installer und hängt sie an die Veröffentlichung. Die installierten Apps holen sich die neue Version dann selbst (Windows beim nächsten Start, Mac nach Klick auf "Jetzt neu starten"). Von Hand geht es weiterhin: unter Windows die neue `.exe` über die alte installieren, auf dem Mac die neue App in den Ordner Programme ziehen und "Ersetzen" wählen.

---

## 8. Bekannte Grenzen

- Unsignierte Installer, deshalb die Warnungen beim ersten Start (Abschnitt 1).
- Auf dem Mac gibt es Fenstertitel nur mit der Berechtigung "Bildschirmaufnahme" (Einstellungen → System); ohne sie nur Programmnamen.
- Lokal werden 13 Wochen vorgehalten; ältere Auswertungen kommen als Summen aus der Datenbank und brauchen Internet.
- Linux wird nicht unterstützt.

---

## 9. Für Entwickler

Electron 44 mit electron-vite 5, React 19, TypeScript, Tailwind CSS 4, Recharts, lucide-react, simple-icons, get-windows, Supabase (Postgres und Auth). Zeitzone fest Europe/Berlin.

```bash
npm install
node node_modules/electron/install.js   # falls npm die Electron-Programmdatei nicht geladen hat
npm run dev                             # App zum Entwickeln starten
npm run typecheck                       # Typen prüfen
npm run build:win                       # Windows-Installer nach dist/
npm run build:mac                       # Mac-Abbild, nur auf einem Mac
npm run icon                            # App-Symbol build/icon.png neu erzeugen
```

Ordner: `src/main` (Hintergrundprozess: Erfassung, Speicher, Abgleich, Regeln), `src/preload` (Brücke), `src/renderer` (Oberfläche), `src/shared` (gemeinsame Rechenlogik und Typen), `supabase/` (SQL-Skripte), `docs/` (Auftrag und Anleitungen), `build/` (App-Symbol), `.github/workflows/` (Installer-Bau auf GitHub). Entscheidungen und Stand stehen in `CLAUDE.md`.
