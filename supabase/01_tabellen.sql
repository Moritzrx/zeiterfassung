-- =====================================================================
-- wessamedia Zeit – Skript 1: Tabellen, Sicherheitsregeln, Hilfsfunktionen
-- =====================================================================
-- So ausführen: Supabase-Dashboard -> SQL Editor -> "New query" ->
-- den kompletten Inhalt dieser Datei einfügen -> "Run".
-- Das Skript darf beliebig oft ausgeführt werden, es legt nichts doppelt an.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Hilfsfunktion: Tätigkeitsnamen vergleichbar machen.
-- "KI Learning", "ki learning" und "KI-Learning" bekommen denselben Schlüssel.
-- ---------------------------------------------------------------------
create or replace function public.taetigkeit_schluessel(name text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(coalesce(name, '')), '[\s\-_]+', '', 'g');
$$;

-- ---------------------------------------------------------------------
-- Tabelle profile: eine Zeile je Konto, entsteht automatisch beim Anlegen.
-- Enthält auch die persönlichen Einstellungen, damit sie eine
-- Neuinstallation überleben.
-- ---------------------------------------------------------------------
create table if not exists public.profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  aktiv boolean not null default true,
  idle_schwelle_sekunden integer not null default 180
    check (idle_schwelle_sekunden between 30 and 3600),
  urlaubswochen integer not null default 6
    check (urlaubswochen between 0 and 52),
  fenstertitel_speichern boolean not null default true,
  zuletzt_sync timestamptz,
  erstellt_am timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tabelle block: ein Zeitblock, automatisch erfasst oder von Hand.
-- Die Kennung (id) wird auf dem Rechner erzeugt, damit Blöcke auch
-- offline eindeutig sind. Löschen setzt nur geloescht_am.
-- ---------------------------------------------------------------------
create table if not exists public.block (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  start timestamptz not null,
  ende timestamptz not null,
  quelle text not null check (quelle in ('auto', 'manuell')),
  programm text,
  programm_roh text,
  fenstertitel text,
  taetigkeit text,
  bewertung text not null default 'ungeklaert'
    check (bewertung in ('produktiv', 'unproduktiv', 'ungeklaert', 'inaktiv')),
  notiz text,
  manuell_geprueft boolean not null default false,
  geraet text,
  testdaten boolean not null default false,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  geloescht_am timestamptz,
  constraint block_ende_nach_start check (ende > start)
);

create index if not exists block_user_start on public.block (user_id, start desc);

-- ---------------------------------------------------------------------
-- Tabelle regel: ordnet Programm oder Fenstertitel einer Tätigkeit zu.
-- gilt_fuer leer = Team-Regel für alle drei, sonst persönliche Regel.
-- ---------------------------------------------------------------------
create table if not exists public.regel (
  id uuid primary key default gen_random_uuid(),
  muster text not null,
  feld text not null check (feld in ('programm', 'titel')),
  taetigkeit text,
  bewertung text not null check (bewertung in ('produktiv', 'unproduktiv', 'ungeklaert')),
  gilt_fuer uuid references auth.users (id) on delete cascade,
  prioritaet integer not null default 0,
  aktiv boolean not null default true,
  erstellt_von uuid references auth.users (id) on delete set null,
  testdaten boolean not null default false,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tabelle ziel: Wochenziele je Person. taetigkeit leer = Arbeitszeit gesamt.
-- ---------------------------------------------------------------------
create table if not exists public.ziel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  taetigkeit text,
  stunden_pro_woche numeric(5, 2) not null check (stunden_pro_woche > 0),
  geaendert_am timestamptz not null default now(),
  unique nulls not distinct (user_id, taetigkeit)
);

-- ---------------------------------------------------------------------
-- Tabelle taetigkeit: kein festes Auswahlmenü, sondern der Ort, an dem
-- das Symbol je Tätigkeit für das ganze Team gespeichert wird.
-- ---------------------------------------------------------------------
create table if not exists public.taetigkeit (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  schluessel text not null unique,
  symbol_typ text not null default 'lucide' check (symbol_typ in ('lucide', 'marke')),
  symbol_name text not null default 'tag',
  erstellt_von uuid references auth.users (id) on delete set null,
  testdaten boolean not null default false,
  geaendert_am timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tabelle auszeichnung: einmal freigeschaltet, bleibt sie.
-- ---------------------------------------------------------------------
create table if not exists public.auszeichnung (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  typ text not null check (typ in (
    'erste_woche_level10', 'drei_wochen_level10', 'alle_lernziele', 'fokus_woche'
  )),
  woche_start date not null,
  freigeschaltet_am timestamptz not null default now(),
  testdaten boolean not null default false,
  unique (user_id, typ)
);

-- ---------------------------------------------------------------------
-- Auslöser: geaendert_am bei jeder Änderung automatisch setzen.
-- ---------------------------------------------------------------------
create or replace function public.geaendert_am_setzen()
returns trigger
language plpgsql
as $$
begin
  new.geaendert_am := now();
  return new;
end;
$$;

drop trigger if exists block_geaendert on public.block;
create trigger block_geaendert before update on public.block
  for each row execute function public.geaendert_am_setzen();

drop trigger if exists regel_geaendert on public.regel;
create trigger regel_geaendert before update on public.regel
  for each row execute function public.geaendert_am_setzen();

drop trigger if exists ziel_geaendert on public.ziel;
create trigger ziel_geaendert before update on public.ziel
  for each row execute function public.geaendert_am_setzen();

drop trigger if exists taetigkeit_geaendert on public.taetigkeit;
create trigger taetigkeit_geaendert before update on public.taetigkeit
  for each row execute function public.geaendert_am_setzen();

-- ---------------------------------------------------------------------
-- Auslöser: Profilzeile automatisch anlegen, sobald ein Konto entsteht.
-- Der Name kommt zunächst aus dem Teil der E-Mail vor dem @;
-- Skript 2 setzt danach die richtigen Namen.
-- ---------------------------------------------------------------------
create or replace function public.profil_anlegen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profil_anlegen on auth.users;
create trigger profil_anlegen after insert on auth.users
  for each row execute function public.profil_anlegen();

-- Profile für Konten nachtragen, die vor diesem Skript angelegt wurden.
insert into public.profile (user_id, name)
select u.id, split_part(u.email, '@', 1)
from auth.users u
left join public.profile p on p.user_id = u.id
where p.user_id is null;

-- ---------------------------------------------------------------------
-- Team-Stand: liefert je Person nur die Summe der produktiven Sekunden
-- in einem Zeitraum, nie einzelne Blöcke. Damit sieht das Team Level und
-- Stunden der anderen, aber keine Fenstertitel oder Notizen.
-- ---------------------------------------------------------------------
create or replace function public.team_stand(von timestamptz, bis timestamptz)
returns table (
  user_id uuid,
  name text,
  produktive_sekunden bigint,
  zuletzt_sync timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.user_id,
    p.name,
    coalesce(sum(
      extract(epoch from (least(b.ende, bis) - greatest(b.start, von)))
    ) filter (where b.id is not null), 0)::bigint as produktive_sekunden,
    p.zuletzt_sync
  from public.profile p
  left join public.block b
    on b.user_id = p.user_id
   and b.bewertung = 'produktiv'
   and b.geloescht_am is null
   and b.start < bis
   and b.ende > von
  where p.aktiv
    and auth.uid() is not null
  group by p.user_id, p.name, p.zuletzt_sync;
$$;

revoke execute on function public.team_stand(timestamptz, timestamptz) from public, anon;
grant execute on function public.team_stand(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- Zeilen-Sicherheit (RLS). Nicht angemeldete Zugriffe dürfen gar nichts.
-- Blöcke: nur eigene lesen, anlegen, ändern. Kein echtes Löschen.
-- Regeln: alle lesen; Team-Regeln darf jeder anlegen, ändern, löschen;
--         persönliche Regeln nur die eigene Person.
-- Ziele: alle lesen, nur eigene anlegen, ändern, löschen.
-- Tätigkeiten: alle lesen, anlegen, ändern; kein Löschen.
-- Auszeichnungen: alle lesen, nur eigene anlegen; nie ändern oder löschen.
-- ---------------------------------------------------------------------
alter table public.profile enable row level security;
alter table public.block enable row level security;
alter table public.regel enable row level security;
alter table public.ziel enable row level security;
alter table public.taetigkeit enable row level security;
alter table public.auszeichnung enable row level security;

drop policy if exists "profile lesen" on public.profile;
create policy "profile lesen" on public.profile
  for select to authenticated using (true);
drop policy if exists "profile eigenes aendern" on public.profile;
create policy "profile eigenes aendern" on public.profile
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "block eigene lesen" on public.block;
create policy "block eigene lesen" on public.block
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "block eigene anlegen" on public.block;
create policy "block eigene anlegen" on public.block
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "block eigene aendern" on public.block;
create policy "block eigene aendern" on public.block
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "regel lesen" on public.regel;
create policy "regel lesen" on public.regel
  for select to authenticated using (true);
drop policy if exists "regel anlegen" on public.regel;
create policy "regel anlegen" on public.regel
  for insert to authenticated with check (gilt_fuer is null or gilt_fuer = auth.uid());
drop policy if exists "regel aendern" on public.regel;
create policy "regel aendern" on public.regel
  for update to authenticated
  using (gilt_fuer is null or gilt_fuer = auth.uid())
  with check (gilt_fuer is null or gilt_fuer = auth.uid());
drop policy if exists "regel loeschen" on public.regel;
create policy "regel loeschen" on public.regel
  for delete to authenticated using (gilt_fuer is null or gilt_fuer = auth.uid());

drop policy if exists "ziel lesen" on public.ziel;
create policy "ziel lesen" on public.ziel
  for select to authenticated using (true);
drop policy if exists "ziel eigene anlegen" on public.ziel;
create policy "ziel eigene anlegen" on public.ziel
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "ziel eigene aendern" on public.ziel;
create policy "ziel eigene aendern" on public.ziel
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "ziel eigene loeschen" on public.ziel;
create policy "ziel eigene loeschen" on public.ziel
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "taetigkeit lesen" on public.taetigkeit;
create policy "taetigkeit lesen" on public.taetigkeit
  for select to authenticated using (true);
drop policy if exists "taetigkeit anlegen" on public.taetigkeit;
create policy "taetigkeit anlegen" on public.taetigkeit
  for insert to authenticated with check (true);
drop policy if exists "taetigkeit aendern" on public.taetigkeit;
create policy "taetigkeit aendern" on public.taetigkeit
  for update to authenticated using (true) with check (true);

drop policy if exists "auszeichnung lesen" on public.auszeichnung;
create policy "auszeichnung lesen" on public.auszeichnung
  for select to authenticated using (true);
drop policy if exists "auszeichnung eigene anlegen" on public.auszeichnung;
create policy "auszeichnung eigene anlegen" on public.auszeichnung
  for insert to authenticated with check (user_id = auth.uid());

-- Fertig. Als Nächstes: die drei Konten anlegen, dann Skript 2 ausführen.
