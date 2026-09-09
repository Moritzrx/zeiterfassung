-- =====================================================================
-- wessamedia Zeit – Skript 10: Liga startet bei 0 Trophäen statt bei 400
-- =====================================================================
-- Entscheidung vom 9. September 2026: Jeder beginnt ohne Liga bei 0 und
-- erarbeitet sich die Bronze-Liga III ab 400 Trophäen (etwa vier Zielwochen).
-- Ersetzt die Funktion liga_stand aus Skript 9 mit demselben Aufbau, nur der
-- Startwert ändert sich. Alle Trophäen werden ohnehin aus den Wochen neu
-- gerechnet, es geht nichts verloren.
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

create or replace function public.liga_stand()
returns table (
  user_id uuid,
  name text,
  trophaeen integer,
  wochen integer,
  letzte_woche date,
  letztes_delta integer,
  im_urlaub boolean
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
  urlaubstage as (
    select u.user_id, g.start, count(distinct d::date) as tage
    from public.urlaub u
    cross join grenzen g
    cross join lateral generate_series(g.start::timestamp, (g.start + 4)::timestamp, interval '1 day') d
    where d::date between u.von and u.bis
    group by u.user_id, g.start
  ),
  deltas as (
    select
      w.user_id,
      w.start,
      greatest(-120, least(200,
        round((
          w.produktiv / 3600.0
          - (coalesce(z.stunden_pro_woche, 50) - 10) * (5 - least(5, coalesce(t.tage, 0))) / 5.0
        ) * 10)
      ))::integer as delta
    from wochen w
    left join public.ziel z on z.user_id = w.user_id and z.taetigkeit is null
    left join urlaubstage t on t.user_id = w.user_id and t.start = w.start
    where w.bloecke > 0
  )
  select
    p.user_id,
    p.name,
    (0 + coalesce((select sum(d.delta) from deltas d where d.user_id = p.user_id), 0))::integer as trophaeen,
    (select count(*) from deltas d where d.user_id = p.user_id)::integer as wochen,
    (select max(d.start) from deltas d where d.user_id = p.user_id) as letzte_woche,
    (select d.delta from deltas d where d.user_id = p.user_id order by d.start desc limit 1) as letztes_delta,
    exists (
      select 1 from public.urlaub u
      where u.user_id = p.user_id
        and (now() at time zone 'Europe/Berlin')::date between u.von and u.bis
    ) as im_urlaub
  from public.profile p
  where p.aktiv
    and auth.uid() is not null
  order by trophaeen desc, p.name;
$$;

revoke execute on function public.liga_stand() from public, anon;
grant execute on function public.liga_stand() to authenticated;

select * from public.liga_stand();
