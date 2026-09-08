@echo off
rem Baut die Windows-Installationsdatei, auch wenn Node.js nicht im PATH steht.
rem Ergebnis: dist\wessamedia-Zeit-<Version>-Windows.exe
set PATH=C:\Program Files\nodejs;%PATH%
cd /d %~dp0..
if not exist .env (
  echo Die Datei .env fehlt. Bitte erst die Zugangsdaten eintragen, siehe docs\supabase-einrichtung.md.
  pause
  exit /b 1
)
call npm run build:win
if errorlevel 1 (
  echo.
  echo Fehler beim Bauen. Die Meldungen oben zeigen, was schiefging.
  pause
  exit /b 1
)
echo.
echo Fertig. Die Installationsdatei liegt im Ordner dist.
pause
