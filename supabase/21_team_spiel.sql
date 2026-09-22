-- =====================================================================
-- wessamedia Zeit – Skript 21: Team-Spiel (Boss-Raid, Season Pass, Duelle, Team-Feed)
-- =====================================================================
-- Vier Tabellen plus eine Funktion, alles nur für Angemeldete. Keine Blöcke der anderen
-- werden lesbar: die Duell-Auswertung läuft als security definer und gibt nur Summen zurück.
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- Das Skript darf mehrfach laufen (if not exists / or replace).
-- =====================================================================

-- Titel und Wappenrahmen aus dem Season Pass stehen im Profil, damit die anderen sie sehen.
alter table public.profile add column if not exists titel text;
alter table public.profile add column if not exists rahmen text;

-- ---------------------------------------------------------------------
-- Boss der Woche
-- ---------------------------------------------------------------------
create table if not exists public.boss (
  woche_start date primary key,
  schluessel text not null,
  name text not null,
  hp_sekunden bigint not null,
  faktor numeric(4, 2) not null,
  besiegt boolean,
  ergebnis_sekunden bigint,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);
alter table public.boss enable row level security;
drop policy if exists "boss lesen" on public.boss;
create policy "boss lesen" on public.boss for select to authenticated using (true);
drop policy if exists "boss anlegen" on public.boss;
create policy "boss anlegen" on public.boss for insert to authenticated with check (true);
drop policy if exists "boss aendern" on public.boss;
create policy "boss aendern" on public.boss for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- Season-Punkte: eine Zeile je Quelle und Schlüssel, damit nichts doppelt vergeben wird.
-- ---------------------------------------------------------------------
create table if not exists public.season_punkt (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  season_start date not null,
  datum date not null,
  quelle text not null,
  schluessel text not null,
  punkte integer not null,
  text text,
  erstellt_am timestamptz not null default now(),
  unique (user_id, quelle, schluessel)
);
create index if not exists season_punkt_user_season on public.season_punkt (user_id, season_start);
alter table public.season_punkt enable row level security;
drop policy if exists "season lesen" on public.season_punkt;
create policy "season lesen" on public.season_punkt for select to authenticated using (true);
drop policy if exists "season eigene anlegen" on public.season_punkt;
create policy "season eigene anlegen" on public.season_punkt for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Duelle
-- ---------------------------------------------------------------------
create table if not exists public.duell (
  id uuid primary key default gen_random_uuid(),
  von_user uuid not null references auth.users (id) on delete cascade,
  an_user uuid not null references auth.users (id) on delete cascade,
  art text not null check (art in ('stunden', 'taetigkeit', 'fruehstart')),
  taetigkeit text,
  von timestamptz not null,
  bis timestamptz not null,
  einsatz text not null default 'einen Kaffee',
  status text not null default 'offen' check (status in ('offen', 'angenommen', 'abgelehnt', 'beendet')),
  gewinner uuid references auth.users (id) on delete set null,
  unentschieden boolean not null default false,
  von_wert numeric,
  an_wert numeric,
  eingeloest_am timestamptz,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);
alter table public.duell enable row level security;
drop policy if exists "duell lesen" on public.duell;
create policy "duell lesen" on public.duell for select to authenticated using (true);
drop policy if exists "duell anlegen" on public.duell;
create policy "duell anlegen" on public.duell for insert to authenticated with check (von_user = auth.uid());
drop policy if exists "duell aendern" on public.duell;
create policy "duell aendern" on public.duell
  for update to authenticated
  using (von_user = auth.uid() or an_user = auth.uid())
  with check (von_user = auth.uid() or an_user = auth.uid());

-- Der Stand eines Duells: je Person ein Wert. Bei "stunden" und "taetigkeit" produktive Sekunden im Zeitraum
-- (bei taetigkeit nur diese Tätigkeit, Vergleich über den Schlüssel ohne Groß/Klein, Leerzeichen, Bindestriche),
-- bei "fruehstart" die Sekunden seit Berliner Mitternacht des Duell-Tags bis zur ersten produktiven Minute
-- (null = noch nichts). Security definer, weil Blöcke der anderen sonst nicht lesbar sind; es kommen nur Zahlen zurück.
create or replace function public.duell_stand(duell_id uuid)
returns table (user_id uuid, wert numeric)
language sql
security definer
set search_path = public
stable
as $$
  with d as (
    select * from public.duell where id = duell_id and auth.uid() is not null
  ),
  personen as (
    select von_user as user_id from d
    union
    select an_user from d
  )
  select
    p.user_id,
    case
      when (select art from d) = 'fruehstart' then (
        select min(extract(epoch from (b.start at time zone 'Europe/Berlin')) - extract(epoch from date_trunc('day', b.start at time zone 'Europe/Berlin')))
        from public.block b
        where b.user_id = p.user_id
          and b.bewertung = 'produktiv'
          and b.geloescht_am is null
          and b.start >= (select von from d)
          and b.start < (select bis from d)
      )
      else (
        select coalesce(sum(extract(epoch from (least(b.ende, least((select bis from d), now())) - greatest(b.start, (select von from d))))), 0)
        from public.block b
        where b.user_id = p.user_id
          and b.bewertung = 'produktiv'
          and b.geloescht_am is null
          and b.start < least((select bis from d), now())
          and b.ende > (select von from d)
          and (
            (select art from d) = 'stunden'
            or regexp_replace(lower(coalesce(b.taetigkeit, '')), '[\s\-]', '', 'g')
               = regexp_replace(lower(coalesce((select taetigkeit from d), '')), '[\s\-]', '', 'g')
          )
      )
    end as wert
  from personen p;
$$;
revoke execute on function public.duell_stand(uuid) from public, anon;
grant execute on function public.duell_stand(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Team-Feed mit Reaktionen
-- ---------------------------------------------------------------------
create table if not exists public.ereignis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  typ text not null,
  text text not null,
  daten jsonb,
  schluessel text unique,
  erstellt_am timestamptz not null default now()
);
create index if not exists ereignis_zeit on public.ereignis (erstellt_am desc);
alter table public.ereignis enable row level security;
drop policy if exists "ereignis lesen" on public.ereignis;
create policy "ereignis lesen" on public.ereignis for select to authenticated using (true);
drop policy if exists "ereignis eigene anlegen" on public.ereignis;
create policy "ereignis eigene anlegen" on public.ereignis for insert to authenticated with check (user_id = auth.uid());

create table if not exists public.reaktion (
  ereignis_id uuid not null references public.ereignis (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null,
  erstellt_am timestamptz not null default now(),
  primary key (ereignis_id, user_id, emoji)
);
alter table public.reaktion enable row level security;
drop policy if exists "reaktion lesen" on public.reaktion;
create policy "reaktion lesen" on public.reaktion for select to authenticated using (true);
drop policy if exists "reaktion eigene anlegen" on public.reaktion;
create policy "reaktion eigene anlegen" on public.reaktion for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "reaktion eigene entfernen" on public.reaktion;
create policy "reaktion eigene entfernen" on public.reaktion for delete to authenticated using (user_id = auth.uid());

-- Kontrolle: die vier Tabellen und die Funktion sind da.
select table_name from information_schema.tables
 where table_schema = 'public' and table_name in ('boss', 'season_punkt', 'duell', 'ereignis', 'reaktion')
 order by table_name;
