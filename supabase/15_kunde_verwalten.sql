-- =====================================================================
-- wessamedia Zeit – Skript 15: Kunden verwalten (umbenennen, zusammenlegen, löschen)
-- =====================================================================
-- Zwei Datenbankfunktionen, die die App aus Einstellungen -> Kunden aufruft:
--   kunde_umbenennen(alt_schluessel, neuer_name): benennt den Kunden in der Kundenliste um
--     und schreibt den neuen Namen in ALLE Blöcke des Teams, die diesen Kunden tragen
--     (auch die der Kollegen, deshalb "security definer"). Trägt ein Kunde den neuen Namen
--     schon, werden beide zu einem zusammengelegt.
--   kunde_loeschen(alt_schluessel): nimmt den Kunden aus der Liste und aus allen Blöcken
--     (die Blöcke bleiben, nur ohne Kunden).
-- Voraussetzung: Skript 14 ist gelaufen. Nur angemeldete Personen dürfen die Funktionen aufrufen.
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

create or replace function public.kunde_umbenennen(alt_schluessel text, neuer_name text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  neu_schluessel text := public.taetigkeit_schluessel(neuer_name);
  bereinigt text := btrim(regexp_replace(neuer_name, '\s+', ' ', 'g'));
  n integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.';
  end if;
  if bereinigt = '' then
    raise exception 'Bitte einen Namen angeben.';
  end if;
  update public.block
     set kunde = bereinigt, geaendert_am = now()
   where kunde is not null
     and public.taetigkeit_schluessel(kunde) = alt_schluessel
     and geloescht_am is null;
  get diagnostics n = row_count;
  if neu_schluessel <> alt_schluessel then
    delete from public.kunde where schluessel = alt_schluessel;
    insert into public.kunde (name, schluessel, erstellt_von)
      values (bereinigt, neu_schluessel, auth.uid())
      on conflict (schluessel) do update set name = excluded.name;
  else
    update public.kunde set name = bereinigt where schluessel = alt_schluessel;
  end if;
  return n;
end;
$$;

create or replace function public.kunde_loeschen(alt_schluessel text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.';
  end if;
  update public.block
     set kunde = null, geaendert_am = now()
   where kunde is not null
     and public.taetigkeit_schluessel(kunde) = alt_schluessel
     and geloescht_am is null;
  get diagnostics n = row_count;
  delete from public.kunde where schluessel = alt_schluessel;
  return n;
end;
$$;

revoke all on function public.kunde_umbenennen(text, text) from public;
revoke all on function public.kunde_loeschen(text) from public;
grant execute on function public.kunde_umbenennen(text, text) to authenticated;
grant execute on function public.kunde_loeschen(text) to authenticated;
