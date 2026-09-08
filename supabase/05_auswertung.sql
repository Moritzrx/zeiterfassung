-- =====================================================================
-- wessamedia Zeit – Skript 5: Tagessummen für lange Zeiträume
-- =====================================================================
-- Die App hält nur die letzten 13 Wochen auf dem Rechner. Für Auswertungen
-- über 6 oder 12 Monate holt sie sich fertige Tagessummen aus der Datenbank,
-- statt zehntausende Blöcke zu laden. Diese Funktion liefert sie.
-- Jeder bekommt nur seine eigenen Summen (auth.uid()).
--
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

create or replace function public.tages_summen(von date, bis date)
returns table (
  datum date,
  taetigkeit text,
  bewertung text,
  sekunden numeric
)
language sql
stable
set search_path = public
as $$
  with tage as (
    select generate_series(von, bis, interval '1 day')::date as tag
  ),
  grenzen as (
    select
      tag,
      (tag::timestamp) at time zone 'Europe/Berlin' as anfang,
      ((tag + 1)::timestamp) at time zone 'Europe/Berlin' as ende
    from tage
  )
  select
    g.tag as datum,
    b.taetigkeit,
    b.bewertung,
    sum(extract(epoch from (least(b.ende, g.ende) - greatest(b.start, g.anfang)))) as sekunden
  from grenzen g
  join public.block b
    on b.user_id = auth.uid()
   and b.geloescht_am is null
   and b.start < g.ende
   and b.ende > g.anfang
  group by g.tag, b.taetigkeit, b.bewertung
  order by g.tag;
$$;

revoke execute on function public.tages_summen(date, date) from public, anon;
grant execute on function public.tages_summen(date, date) to authenticated;

-- Kontrolle: Summen der letzten 7 Tage für das eigene Konto (im Dashboard ohne Anmeldung leer).
select * from public.tages_summen((current_date - 7)::date, current_date) limit 20;
