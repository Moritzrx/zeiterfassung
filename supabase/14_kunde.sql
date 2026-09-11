-- =====================================================================
-- wessamedia Zeit – Skript 14: Kunde (Projekt) als zweite Dimension neben der Tätigkeit
-- =====================================================================
-- Zwei Dinge:
--   1. Jeder Block bekommt eine neue, leere Spalte "kunde" (Text, darf leer bleiben).
--   2. Eine gemeinsame Kundenliste für das Team (Tabelle kunde), wie bei den Tätigkeiten:
--      lesen dürfen alle, anlegen dürfen alle, Schreibweisen werden über den Schlüssel
--      (ohne Groß/Klein, Leerzeichen, Bindestriche) zusammengeführt.
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- Solange das Skript nicht gelaufen ist, speichert die App Kunden nur lokal und meldet
-- beim Abgleich einen Fehler ("column kunde does not exist").
-- =====================================================================

alter table public.block add column if not exists kunde text;

create table if not exists public.kunde (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  schluessel text not null unique,
  erstellt_von uuid references auth.users (id) on delete set null,
  geaendert_am timestamptz not null default now()
);

alter table public.kunde enable row level security;

drop policy if exists "kunde lesen" on public.kunde;
create policy "kunde lesen" on public.kunde
  for select to authenticated using (true);
drop policy if exists "kunde anlegen" on public.kunde;
create policy "kunde anlegen" on public.kunde
  for insert to authenticated with check (true);
drop policy if exists "kunde aendern" on public.kunde;
create policy "kunde aendern" on public.kunde
  for update to authenticated using (true) with check (true);
