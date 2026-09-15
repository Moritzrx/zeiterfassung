-- =====================================================================
-- wessamedia Zeit – Skript 19: Tätigkeiten umbenennen und zusammenlegen (15. September 2026)
-- =====================================================================
-- Wie Skript 15 für Kunden: taetigkeit_umbenennen(alt_schluessel, neuer_name) schreibt den neuen
-- Namen in alle Blöcke, Regeln und Wochenziele ALLER Personen (deshalb "security definer") und
-- pflegt die Tabelle taetigkeit (Symbol und Einordnung des alten Eintrags wandern mit, wenn es den
-- neuen Namen noch nicht gibt). Heißt eine Tätigkeit schon so, werden beide zusammengelegt.
-- Nur angemeldete Personen dürfen die Funktion aufrufen.
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

create or replace function public.taetigkeit_umbenennen(alt_schluessel text, neuer_name text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  neu_schluessel text := public.taetigkeit_schluessel(neuer_name);
  bereinigt text := btrim(regexp_replace(neuer_name, '\s+', ' ', 'g'));
  alt record;
  n integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.';
  end if;
  if bereinigt = '' then
    raise exception 'Bitte einen Namen angeben.';
  end if;

  -- Blöcke aller Personen
  update public.block
     set taetigkeit = bereinigt, geaendert_am = now()
   where taetigkeit is not null
     and public.taetigkeit_schluessel(taetigkeit) = alt_schluessel
     and geloescht_am is null;
  get diagnostics n = row_count;

  -- Regeln
  update public.regel
     set taetigkeit = bereinigt
   where taetigkeit is not null
     and public.taetigkeit_schluessel(taetigkeit) = alt_schluessel;

  -- Wochenziele: gibt es für dieselbe Person schon ein Ziel mit dem neuen Namen, bleibt das, das alte fällt weg.
  delete from public.ziel z
   where z.taetigkeit is not null
     and public.taetigkeit_schluessel(z.taetigkeit) = alt_schluessel
     and neu_schluessel <> alt_schluessel
     and exists (
       select 1 from public.ziel z2
        where z2.user_id = z.user_id
          and z2.taetigkeit is not null
          and public.taetigkeit_schluessel(z2.taetigkeit) = neu_schluessel
     );
  update public.ziel
     set taetigkeit = bereinigt
   where taetigkeit is not null
     and public.taetigkeit_schluessel(taetigkeit) = alt_schluessel;

  -- Tabelle taetigkeit
  select * into alt from public.taetigkeit where schluessel = alt_schluessel;
  if neu_schluessel <> alt_schluessel then
    delete from public.taetigkeit where schluessel = alt_schluessel;
    insert into public.taetigkeit (name, schluessel, symbol_typ, symbol_name, unterwegs, erstellt_von)
      values (bereinigt, neu_schluessel, coalesce(alt.symbol_typ, 'lucide'), coalesce(alt.symbol_name, 'tag'), coalesce(alt.unterwegs, false), auth.uid())
      on conflict (schluessel) do update set name = excluded.name;
  else
    update public.taetigkeit set name = bereinigt where schluessel = alt_schluessel;
  end if;
  return n;
end;
$$;

revoke all on function public.taetigkeit_umbenennen(text, text) from public;
grant execute on function public.taetigkeit_umbenennen(text, text) to authenticated;
