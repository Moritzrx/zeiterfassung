-- =====================================================================
-- wessamedia Zeit – Skript 13: 36 Auszeichnungen und produktive Stunden seit dem Start
-- =====================================================================
-- Erweitert die erlaubten Auszeichnungstypen (Serien, Stunden-Meilensteine, Liga,
-- Tage, Team, Lernen und Disziplin) und legt die Funktion produktiv_gesamt() an,
-- die für die angemeldete Person die produktiven Sekunden über alle Zeit summiert
-- (für die Meilensteine 100 / 500 / 1.000 / 2.500 / 5.000 Stunden).
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

alter table public.auszeichnung drop constraint if exists auszeichnung_typ_check;

alter table public.auszeichnung add constraint auszeichnung_typ_check check (typ in (
  'erste_woche_level10', 'comeback', 'eternal',
  'drei_wochen_level10', 'serie_6', 'serie_12', 'dauerbrenner',
  'stunden_100', 'stunden_500', 'stunden_1000', 'stunden_2500', 'stunden_5000',
  'liga_bronze', 'liga_silber', 'liga_gold', 'liga_kristall', 'liga_meister', 'liga_champion', 'liga_titan', 'liga_legende',
  'perfekte_woche', 'durchlaeufer', 'marathon', 'ultra', 'sprint',
  'wochensieger', 'dauersieger', 'team_woche',
  'alle_lernziele', 'lernmeister', 'fokus_woche', 'aufgeraeumt', 'blitzsauber',
  'fruehaufsteher', 'nachteule', 'wochenend_krieger'
));

-- Produktive Sekunden der angemeldeten Person über alle Zeit (ohne gelöschte Blöcke und Testdaten).
create or replace function public.produktiv_gesamt()
returns bigint
language sql
security invoker
set search_path = public
stable
as $$
  select coalesce(sum(extract(epoch from (b.ende - b.start))), 0)::bigint
  from public.block b
  where b.user_id = auth.uid()
    and b.bewertung = 'produktiv'
    and b.geloescht_am is null
    and not b.testdaten;
$$;

revoke execute on function public.produktiv_gesamt() from public, anon;
grant execute on function public.produktiv_gesamt() to authenticated;

select pg_get_constraintdef(oid) from pg_constraint where conname = 'auszeichnung_typ_check';
