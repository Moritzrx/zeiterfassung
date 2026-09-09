-- =====================================================================
-- wessamedia Zeit – Skript 13: 36 Auszeichnungen, Stunden seit dem Start, Urlaub Mo–So
-- =====================================================================
-- Drei Dinge in einem Skript:
--   1. Erweitert die erlaubten Auszeichnungstypen (Serien, Stunden-Meilensteine, Liga,
--      Tage, Team, Lernen und Disziplin).
--   2. Legt die Funktion produktiv_gesamt() an, die für die angemeldete Person die
--      produktiven Sekunden über alle Zeit summiert (Meilensteine 100 bis 5.000 Stunden).
--   3. Ersetzt liga_stand(): Urlaub zählt an allen sieben Tagen der Woche, weil das Team
--      Montag bis Sonntag arbeitet (vorher nur Montag bis Freitag).
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

-- ---------------------------------------------------------------------
-- Liga: Urlaub zählt an allen sieben Tagen (das Team arbeitet Montag bis Sonntag).
-- Ersetzt liga_stand aus Skript 12; einziger Unterschied: Urlaubstage Mo–So und
-- neutraler Punkt × (7 − Urlaubstage)/7 statt Mo–Fr und /5.
-- ---------------------------------------------------------------------

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
    cross join lateral generate_series(g.start::timestamp, (g.start + 6)::timestamp, interval '1 day') d
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
          - (coalesce(z.stunden_pro_woche, 50) - 10) * (7 - least(7, coalesce(t.tage, 0))) / 7.0
        ) * 10)
      ))::integer as delta
    from wochen w
    left join public.ziel z on z.user_id = w.user_id and z.taetigkeit is null
    left join urlaubstage t on t.user_id = w.user_id and t.start = w.start
    where w.bloecke > 0
  ),
  laeufe as (
    select
      d.user_id,
      d.start,
      d.delta,
      sum(d.delta) over (partition by d.user_id order by d.start) as summe
    from deltas d
  ),
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

select pg_get_constraintdef(oid) from pg_constraint where conname = 'auszeichnung_typ_check';
