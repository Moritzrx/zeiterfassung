-- =====================================================================
-- wessamedia Zeit – Skript 9: Urlaub hinterlegen, Liga berücksichtigt ihn
-- =====================================================================
-- Neue Tabelle urlaub: jede Person trägt ihre freien Tage ein (von/bis).
-- In der Liga senken Urlaubstage (Montag bis Freitag) die Erwartung der
-- Woche anteilig: Bei 2 Urlaubstagen zählt nur 3/5 des neutralen Punkts.
-- Eine ganze Urlaubswoche erwartet nichts, kostet also keine Trophäen;
-- wer trotzdem arbeitet, bekommt sogar welche dazu.
--
-- Ersetzt die Funktion liga_stand aus Skript 8 (neue Spalte im_urlaub).
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

create table if not exists public.urlaub (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  von date not null,
  bis date not null,
  notiz text,
  erstellt_am timestamptz not null default now(),
  constraint urlaub_zeitraum check (bis >= von)
);

create index if not exists urlaub_user_von on public.urlaub (user_id, von);

alter table public.urlaub enable row level security;

drop policy if exists "urlaub lesen" on public.urlaub;
create policy "urlaub lesen" on public.urlaub
  for select to authenticated using (true);

drop policy if exists "urlaub eigenen anlegen" on public.urlaub;
create policy "urlaub eigenen anlegen" on public.urlaub
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "urlaub eigenen aendern" on public.urlaub;
create policy "urlaub eigenen aendern" on public.urlaub
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "urlaub eigenen loeschen" on public.urlaub;
create policy "urlaub eigenen loeschen" on public.urlaub
  for delete to authenticated using (user_id = auth.uid());

-- Die Liga-Funktion neu, jetzt mit Urlaub. Der Rückgabetyp ändert sich, deshalb erst löschen.
drop function if exists public.liga_stand();

create function public.liga_stand()
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
  -- Urlaubstage je Person und Woche, nur Montag bis Freitag
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
    (400 + coalesce((select sum(d.delta) from deltas d where d.user_id = p.user_id), 0))::integer as trophaeen,
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

-- Kontrolle (im Dashboard ohne Anmeldung leer, in der App gefüllt):
select * from public.liga_stand();
