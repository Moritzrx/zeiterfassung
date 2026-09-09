-- =====================================================================
-- wessamedia Zeit – Skript 8: Die Liga (Langzeit-Stand wie in Clash of Clans)
-- =====================================================================
-- Jede abgeschlossene Woche bringt Trophäen dazu oder nimmt welche weg:
--   Trophäen der Woche = 10 je produktive Stunde über oder unter dem
--   neutralen Punkt (persönliches Gesamtziel minus 10 Stunden),
--   höchstens +200 und höchstens -120 pro Woche.
--   Wer sein Ziel von 50 Stunden erreicht, bekommt also +100.
-- Wochen ohne einen einzigen Block (Urlaub, App aus) zählen nicht.
-- Jeder startet mit 400 Trophäen (Bronze-Liga III). Gezählt wird ab dem
-- 7. September 2026, der ersten echten Woche. Die laufende Woche zählt
-- erst nach Sonntag.
--
-- Die Formel steht genauso in src/shared/liga.ts (für die Vorschau der
-- laufenden Woche). Wer sie ändert, ändert sie an beiden Stellen.
--
-- Wie team_stand gibt die Funktion nur Summen heraus, nie Blöcke.
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

create or replace function public.liga_stand()
returns table (
  user_id uuid,
  name text,
  trophaeen integer,
  wochen integer,
  letzte_woche date,
  letztes_delta integer
)
language sql
security definer
set search_path = public
stable
as $$
  with grenzen as (
    select
      s::date as start,
      (s::date::timestamp) at time zone 'Europe/Berlin' as anfang,
      ((s::date + 7)::timestamp) at time zone 'Europe/Berlin' as ende
    from generate_series(
      '2026-09-07'::date,
      (date_trunc('week', ((now() at time zone 'Europe/Berlin')::date)::timestamp)::date - 7),
      interval '7 days'
    ) s
  ),
  wochen as (
    select
      p.user_id,
      g.start,
      coalesce(sum(
        extract(epoch from (least(b.ende, g.ende) - greatest(b.start, g.anfang)))
      ) filter (where b.bewertung = 'produktiv'), 0) as produktiv,
      count(b.id) as bloecke
    from public.profile p
    cross join grenzen g
    left join public.block b
      on b.user_id = p.user_id
     and b.geloescht_am is null
     and b.start < g.ende
     and b.ende > g.anfang
    where p.aktiv
    group by p.user_id, g.start
  ),
  deltas as (
    select
      w.user_id,
      w.start,
      greatest(-120, least(200,
        round((w.produktiv / 3600.0 - (coalesce(z.stunden_pro_woche, 50) - 10)) * 10)
      ))::integer as delta
    from wochen w
    left join public.ziel z on z.user_id = w.user_id and z.taetigkeit is null
    where w.bloecke > 0
  )
  select
    p.user_id,
    p.name,
    (400 + coalesce((select sum(d.delta) from deltas d where d.user_id = p.user_id), 0))::integer as trophaeen,
    (select count(*) from deltas d where d.user_id = p.user_id)::integer as wochen,
    (select max(d.start) from deltas d where d.user_id = p.user_id) as letzte_woche,
    (select d.delta from deltas d where d.user_id = p.user_id order by d.start desc limit 1) as letztes_delta
  from public.profile p
  where p.aktiv
    and auth.uid() is not null
  order by trophaeen desc, p.name;
$$;

revoke execute on function public.liga_stand() from public, anon;
grant execute on function public.liga_stand() to authenticated;

-- Kontrolle (im Dashboard ohne Anmeldung leer, in der App gefüllt):
select * from public.liga_stand();
