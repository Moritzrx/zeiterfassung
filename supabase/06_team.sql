-- =====================================================================
-- wessamedia Zeit – Skript 6: Wochensummen des Teams für den Verlauf
-- =====================================================================
-- Liefert je Person und Woche die produktiven Sekunden, für den Vergleich
-- über längere Zeiträume auf dem Team-Screen. Wie team_stand gibt sie nur
-- Summen heraus, nie einzelne Blöcke oder Fenstertitel der anderen.
--
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

create or replace function public.team_wochen(von date, bis date)
returns table (
  user_id uuid,
  name text,
  woche_start date,
  produktive_sekunden numeric
)
language sql
security definer
set search_path = public
stable
as $$
  with wochen as (
    select generate_series(date_trunc('week', von::timestamp)::date, bis, interval '7 days')::date as start
  ),
  grenzen as (
    select
      start,
      (start::timestamp) at time zone 'Europe/Berlin' as anfang,
      ((start + 7)::timestamp) at time zone 'Europe/Berlin' as ende
    from wochen
  )
  select
    p.user_id,
    p.name,
    g.start as woche_start,
    coalesce(sum(
      extract(epoch from (least(b.ende, g.ende) - greatest(b.start, g.anfang)))
    ) filter (where b.id is not null), 0) as produktive_sekunden
  from public.profile p
  cross join grenzen g
  left join public.block b
    on b.user_id = p.user_id
   and b.bewertung = 'produktiv'
   and b.geloescht_am is null
   and b.start < g.ende
   and b.ende > g.anfang
  where p.aktiv
    and auth.uid() is not null
  group by p.user_id, p.name, g.start
  order by g.start, p.name;
$$;

revoke execute on function public.team_wochen(date, date) from public, anon;
grant execute on function public.team_wochen(date, date) to authenticated;

-- Kontrolle (im Dashboard ohne Anmeldung leer): die letzten 4 Wochen.
select * from public.team_wochen((current_date - 28)::date, current_date);
