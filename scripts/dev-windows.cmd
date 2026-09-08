@echo off
rem Startet die App zum Entwickeln unter Windows, auch wenn Node.js nicht im PATH steht.
set PATH=C:\Program Files\nodejs;%PATH%
cd /d %~dp0..
npm run dev
