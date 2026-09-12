-- =====================================================================
-- wessamedia Zeit – Skript 16: Tätigkeiten "unterwegs" (nicht am Rechner)
-- =====================================================================
-- Jede Tätigkeit bekommt die Einordnung "am Rechner" (Standard) oder "unterwegs".
-- Unterwegs-Tätigkeiten (Dreh, Fahrt, Kundentermin ...) stehen in der App bei
-- "Ich bin weg" und in der Rückfrage nach einer Abwesenheit, nicht im Fokus-Dialog.
-- Umstellen kann man jede Tätigkeit unter Einstellungen -> Tätigkeiten und Symbole.
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

alter table public.taetigkeit add column if not exists unterwegs boolean not null default false;

-- Übliche Unterwegs-Tätigkeiten gleich richtig einordnen (nur wenn es sie schon gibt).
update public.taetigkeit
   set unterwegs = true
 where schluessel in ('dreh', 'fahrt', 'kundentermin', 'termin', 'telefonat', 'kundenbesuch', 'vorort', 'aussentermin', 'außentermin');
