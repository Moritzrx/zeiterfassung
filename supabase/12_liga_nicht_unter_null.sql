-- =====================================================================
-- wessamedia Zeit – Skript 12: Trophäen fallen nie unter 0
-- =====================================================================
-- Wie in Clash of Clans: Wer bei 0 Trophäen steht, kann durch eine schwache
-- Woche nichts mehr verlieren. Bisher konnte die Summe ins Minus rutschen
-- (zum Beispiel −120 nach der ersten Woche); dann hätte man 520 statt 400
-- Trophäen bis zur Bronze-Liga gebraucht. Jetzt wird Woche für Woche gerechnet
-- und der Stand nach jeder Woche bei 0 abgefangen.
-- Neu ist außerdem die Spalte "letztes_wirksam": was die zuletzt gezählte Woche
-- am Stand tatsächlich verändert hat (zum Beispiel ±0, obwohl sie −120 gebracht
-- hätte). Ersetzt die Funktion liga_stand aus Skript 10, sonst ändert sich nichts.
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

drop function if exists public.liga_stand();

create function public.liga_stand()
returns table (
  user_id uuid,
  name text,
  trophaeen integer,
  wochen integer,
  letzte_woche date,
  letztes_delta integer,
  letztes_wirksam integer,
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
  ),
  -- laufende Summe der Wochen, in zeitlicher Reihenfolge
  laeufe as (
    select
      d.user_id,
      d.start,
      d.delta,
      sum(d.delta) over (partition by d.user_id order by d.start) as summe
    from deltas d
  ),
  -- Stand nach jeder Woche, nie unter 0: laufende Summe minus das tiefste
  -- Zwischenergebnis, falls das unter 0 lag. Das ist genau das Ergebnis, wenn man
  -- Woche für Woche rechnet und jedes Mal bei 0 abfängt.
  staende as (
    select
      l.user_id,
      l.start,
      l.delta,
      (l.summe - least(0, min(l.summe) over (partition by l.user_id order by l.start)))::integer as stand
    from laeufe l
  ),
  verlauf as (
    select
      s.user_id,
      s.start,
      s.delta,
      s.stand,
      s.stand - coalesce(lag(s.stand) over (partition by s.user_id order by s.start), 0) as wirksam
    from staende s
  )
  select
    p.user_id,
    p.name,
    coalesce((select v.stand from verlauf v where v.user_id = p.user_id order by v.start desc limit 1), 0)::integer as trophaeen,
    (select count(*) from verlauf v where v.user_id = p.user_id)::integer as wochen,
    (select max(v.start) from verlauf v where v.user_id = p.user_id) as letzte_woche,
    (select v.delta from verlauf v where v.user_id = p.user_id order by v.start desc limit 1)::integer as letztes_delta,
    (select v.wirksam from verlauf v where v.user_id = p.user_id order by v.start desc limit 1)::integer as letztes_wirksam,
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
