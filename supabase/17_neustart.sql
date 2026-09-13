-- =====================================================================
-- wessamedia Zeit – Skript 17: Neustart auf null, automatisch in der Nacht
-- =====================================================================
-- Entscheidung des Auftraggebers (13. September 2026): Ab Montag, 14. September
-- 2026, geht es mit der App richtig los. In der Nacht davor um 0:00 Uhr Berliner
-- Zeit werden alle Zeitblöcke (Testphase) und alle Auszeichnungen gelöscht. Damit
-- stehen Ränge, Liga, Stunden-Meilensteine und Wochenrückblick bei allen auf null.
--
-- Es bleibt erhalten: Konten, Profile, Wochenziele, Regeln, Tätigkeiten mit
-- Symbolen und Einordnung, Kunden, Urlaub.
--
-- Technik: Supabase bringt die Zeitsteuerung pg_cron mit. Der Auftrag läuft um
-- 22:00 UTC am 13. September (= 0:00 Uhr Sommerzeit in Berlin) und entfernt sich
-- danach selbst. Prüfen: select jobname, schedule, active from cron.job;
-- Sofort statt nachts: die beiden delete-Zeilen einzeln ausführen.
--
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run
-- -> bei "Potential issue detected" auf "Run query".
-- =====================================================================

create extension if not exists pg_cron;

select cron.schedule(
  'neustart_2026_09_14',
  '0 22 13 9 *',
  $$ delete from public.auszeichnung; delete from public.block; select cron.unschedule('neustart_2026_09_14'); $$
);
