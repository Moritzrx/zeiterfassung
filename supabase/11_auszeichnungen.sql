-- =====================================================================
-- wessamedia Zeit – Skript 11: Zehn neue Auszeichnungen erlauben
-- =====================================================================
-- Die Tabelle auszeichnung prüft die erlaubten Typen. Neu dazu kommen:
-- fruehaufsteher, nachteule, marathon, sprint, wochenend_krieger,
-- perfekte_woche, eternal, comeback, dauerbrenner, aufgeraeumt.
-- Ohne dieses Skript kann die App die neuen Auszeichnungen nicht speichern.
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

alter table public.auszeichnung drop constraint if exists auszeichnung_typ_check;

alter table public.auszeichnung add constraint auszeichnung_typ_check check (typ in (
  'erste_woche_level10', 'drei_wochen_level10', 'alle_lernziele', 'fokus_woche',
  'fruehaufsteher', 'nachteule', 'marathon', 'sprint', 'wochenend_krieger',
  'perfekte_woche', 'eternal', 'comeback', 'dauerbrenner', 'aufgeraeumt'
));

-- Kontrolle: die erlaubten Typen
select pg_get_constraintdef(oid) from pg_constraint where conname = 'auszeichnung_typ_check';
