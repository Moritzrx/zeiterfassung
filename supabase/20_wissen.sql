-- =====================================================================
-- wessamedia Zeit – Skript 20: Wissen für den KI-Assistenten (16. September 2026)
-- =====================================================================
-- Gemeinsame Texte, die der KI-Assistent in der App zusätzlich zur Anleitung kennt: was wessamedia ist,
-- wer was macht, Kunden und Projekte, Regeln im Team. Jede angemeldete Person darf sie lesen und
-- ändern (Einstellungen → KI-Assistent → Wissen über wessamedia). Löschen gibt es nicht, leeren reicht.
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

create table if not exists public.wissen (
  schluessel text primary key,
  titel text not null,
  inhalt text not null default '',
  geaendert_von uuid references auth.users(id) on delete set null,
  geaendert_am timestamptz not null default now()
);

alter table public.wissen enable row level security;

drop policy if exists "wissen lesen" on public.wissen;
create policy "wissen lesen" on public.wissen
  for select to authenticated using (true);

drop policy if exists "wissen anlegen" on public.wissen;
create policy "wissen anlegen" on public.wissen
  for insert to authenticated with check (true);

drop policy if exists "wissen aendern" on public.wissen;
create policy "wissen aendern" on public.wissen
  for update to authenticated using (true) with check (true);

-- Die beiden festen Einträge, damit sie in der App sofort erscheinen (leer, bis jemand etwas einträgt).
insert into public.wissen (schluessel, titel, inhalt)
values
  ('firma', 'Über wessamedia', ''),
  ('kunden', 'Kunden und Projekte', '')
on conflict (schluessel) do nothing;
