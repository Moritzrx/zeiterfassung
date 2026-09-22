-- =====================================================================
-- wessamedia Zeit – Skript 22: Duelle genauer (Kunde, Wettlauf-Ziel, Beschreibung)
-- =====================================================================
-- Ergänzt die Tabelle duell aus Skript 21 um Kunde, Ziel-Stunden und eine freie Beschreibung,
-- erlaubt die Art "ziel" (Wettlauf: wer zuerst N Stunden hat) und rechnet in duell_stand den
-- Kunden-Filter mit. Darf mehrfach laufen.
-- So ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- =====================================================================

alter table public.duell add column if not exists kunde text;
alter table public.duell add column if not exists ziel_stunden numeric;
alter table public.duell add column if not exists beschreibung text;

alter table public.duell drop constraint if exists duell_art_check;
alter table public.duell add constraint duell_art_check check (art in ('stunden', 'taetigkeit', 'fruehstart', 'ziel'));

-- Stand je Person: bei stunden/ziel/taetigkeit produktive Sekunden im Zeitraum, gefiltert nach Tätigkeit und Kunde,
-- wenn gesetzt (Schlüssel ohne Groß/Klein, Leerzeichen, Bindestriche); bei fruehstart Sekunden seit Berliner
-- Mitternacht bis zur ersten produktiven Minute (null = noch nichts). Security definer, es kommen nur Zahlen zurück.
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
            (select taetigkeit from d) is null
            or regexp_replace(lower(coalesce(b.taetigkeit, '')), '[\s\-]', '', 'g')
               = regexp_replace(lower((select taetigkeit from d)), '[\s\-]', '', 'g')
          )
          and (
            (select kunde from d) is null
            or regexp_replace(lower(coalesce(b.kunde, '')), '[\s\-]', '', 'g')
               = regexp_replace(lower((select kunde from d)), '[\s\-]', '', 'g')
          )
      )
    end as wert
  from personen p;
$$;
revoke execute on function public.duell_stand(uuid) from public, anon;
grant execute on function public.duell_stand(uuid) to authenticated;

-- Kontrolle: die drei neuen Spalten sind da.
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'duell' and column_name in ('kunde', 'ziel_stunden', 'beschreibung')
 order by column_name;
