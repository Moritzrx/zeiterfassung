-- =====================================================================
-- wessamedia Zeit – Skript 18: Tätigkeiten der anderen sehen (15. September 2026)
-- =====================================================================
-- Wunsch des Auftraggebers: "dass man sieht, welche Tätigkeiten die anderen gemacht haben".
-- Zwei Funktionen, die nur Summen bzw. den letzten Block je Person liefern, keine Fenstertitel:
--   team_taetigkeiten(von, bis): produktive Sekunden je Person, Tätigkeit und Kunde im Zeitraum
--   team_aktuell():              der jüngste Block je Person (Tätigkeit, Kunde, Anfang, Ende) aus den
--                                letzten 24 Stunden, damit die App "Gerade: Konzept seit 09:12" zeigen kann
-- Nur für angemeldete Personen. So ausführen: SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

create or replace function public.team_taetigkeiten(von timestamptz, bis timestamptz)
returns table (
  user_id uuid,
  name text,
  taetigkeit text,
  kunde text,
  produktive_sekunden bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.user_id,
    p.name,
    b.taetigkeit,
    b.kunde,
    sum(extract(epoch from (least(b.ende, bis) - greatest(b.start, von))))::bigint as produktive_sekunden
  from public.profile p
  join public.block b
    on b.user_id = p.user_id
   and b.bewertung = 'produktiv'
   and b.geloescht_am is null
   and b.start < bis
   and b.ende > von
  where p.aktiv
    and auth.uid() is not null
  group by p.user_id, p.name, b.taetigkeit, b.kunde;
$$;

create or replace function public.team_aktuell()
returns table (
  user_id uuid,
  name text,
  taetigkeit text,
  kunde text,
  start timestamptz,
  ende timestamptz,
  bewertung text
)
language sql
security definer
set search_path = public
stable
as $$
  select distinct on (p.user_id)
    p.user_id,
    p.name,
    b.taetigkeit,
    b.kunde,
    b.start,
    b.ende,
    b.bewertung
  from public.profile p
  join public.block b
    on b.user_id = p.user_id
   and b.geloescht_am is null
   and b.ende > now() - interval '1 day'
  where p.aktiv
    and auth.uid() is not null
  order by p.user_id, b.ende desc;
$$;

revoke all on function public.team_taetigkeiten(timestamptz, timestamptz) from public;
revoke all on function public.team_aktuell() from public;
grant execute on function public.team_taetigkeiten(timestamptz, timestamptz) to authenticated;
grant execute on function public.team_aktuell() to authenticated;
