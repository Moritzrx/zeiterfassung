-- =====================================================================
-- wessamedia Zeit – Skript 3: Testdaten einfügen
-- =====================================================================
-- Erzeugt erfundene Blöcke für die drei Konten: 10 abgeschlossene Wochen
-- plus die laufende Woche bis gestern. Je Woche 35 bis 58 produktive
-- Stunden, mit Tätigkeiten passend zu den Zielen, inaktiver Zeit,
-- unproduktiven und ungeklärten Blöcken und Hand-Einträgen.
--
-- Alle Zeilen tragen testdaten = true. Rückstandslos entfernen: Skript 4.
-- Erneutes Ausführen räumt die alten Testdaten vorher selbst weg.
-- Der Zufall ist fest eingestellt, jeder Lauf erzeugt dieselben Daten.
--
-- WICHTIG: Die drei E-Mail-Adressen unten müssen zu den Konten passen.
-- =====================================================================

do $$
declare
  email_moritz constant text := 'moritz@wessamedia.com';
  email_filipo constant text := 'filipo@wessamedia.com';
  email_leon   constant text := 'leon@wessamedia.com';
  tz constant text := 'Europe/Berlin';
  moritz uuid;
  filipo uuid;
  leon uuid;
  personen uuid[];
  heute date := (now() at time zone 'Europe/Berlin')::date;
  montag_aktuell date;
  p uuid;
  pi int;
  w int;
  d int;
  tag date;
  woche_start date;
  wochenziel numeric;
  tagesziel numeric;
  erledigt numeric;
  t timestamptz;
  dauer interval;
  v record;
  mittag_gemacht boolean;
begin
  perform setseed(0.42);
  montag_aktuell := heute - (extract(isodow from heute)::int - 1);

  select id into moritz from auth.users where lower(email) = lower(email_moritz);
  select id into filipo from auth.users where lower(email) = lower(email_filipo);
  select id into leon   from auth.users where lower(email) = lower(email_leon);
  if moritz is null or filipo is null or leon is null then
    raise exception 'Mindestens ein Konto fehlt. Erst die drei Konten anlegen und die Adressen oben im Skript prüfen.';
  end if;
  personen := array[moritz, filipo, leon];

  -- Alte Testdaten entfernen, damit nichts doppelt entsteht
  delete from public.block where testdaten;
  delete from public.auszeichnung where testdaten;
  delete from public.taetigkeit where testdaten;

  -- Vorlagen je Person:
  -- person, taetigkeit, bewertung, quelle, programm, programm_roh, fenstertitel,
  -- gewicht (wie oft), von Hand geprüft, Dauer von/bis in Minuten, notiz
  create temp table vorlage (
    person int,
    taetigkeit text,
    bewertung text,
    quelle text,
    programm text,
    programm_roh text,
    titel text,
    gewicht numeric,
    geprueft boolean,
    min_min int,
    max_min int,
    notiz text
  ) on commit drop;

  insert into vorlage values
    -- Moritz: Instagram, TikTok, KI, LinkedIn, Orga
    (1, 'Instagram Learning', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'Instagram – Google Chrome', 20, true, 20, 60, null),
    (1, 'TikTok Learning', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'TikTok - Entdecken – Google Chrome', 18, true, 20, 60, null),
    (1, 'KI Learning', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'ChatGPT – Google Chrome', 20, false, 20, 75, null),
    (1, 'LinkedIn Learning', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'Feed | LinkedIn – Google Chrome', 6, false, 15, 40, null),
    (1, 'Orga', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'Posteingang - Gmail – Google Chrome', 16, false, 10, 45, null),
    (1, 'Orga', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'Kunden Q4 - Asana – Google Chrome', 8, false, 15, 45, null),
    (1, 'Konzept', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'Konzept Kunde X - Google Docs – Google Chrome', 8, true, 30, 80, null),
    (1, null, 'ungeklaert', 'auto', 'Google Chrome', 'chrome.exe', 'Instagram – Google Chrome', 6, false, 10, 30, null),
    (1, null, 'ungeklaert', 'auto', 'Google Chrome', 'chrome.exe', 'YouTube – Google Chrome', 4, false, 10, 30, null),
    (1, null, 'unproduktiv', 'auto', 'Google Chrome', 'chrome.exe', 'Netflix – Google Chrome', 3, false, 15, 45, null),
    (1, 'Kundentermin', 'produktiv', 'manuell', null, null, null, 4, true, 60, 120, 'Termin beim Kunden'),
    (1, 'Fahrt', 'produktiv', 'manuell', null, null, null, 3, true, 30, 60, 'Fahrt zum Kunden'),
    -- Filipo: Videografie, KI, Orga, Drehs
    (2, 'Videografie Learning', 'produktiv', 'auto', 'Adobe Premiere Pro', 'Adobe Premiere Pro.exe', 'Kundenfilm_v3.prproj - Adobe Premiere Pro', 30, false, 30, 90, null),
    (2, 'Videografie Learning', 'produktiv', 'auto', 'DaVinci Resolve', 'Resolve.exe', 'DaVinci Resolve - Imagefilm', 12, false, 30, 80, null),
    (2, 'KI Learning', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'Claude – Google Chrome', 14, false, 20, 60, null),
    (2, 'Orga', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'Posteingang - Gmail – Google Chrome', 14, false, 10, 40, null),
    (2, 'Orga', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'Drehplan - Google Tabellen – Google Chrome', 8, false, 15, 45, null),
    (2, null, 'ungeklaert', 'auto', 'Google Chrome', 'chrome.exe', 'YouTube – Google Chrome', 6, false, 10, 30, null),
    (2, null, 'unproduktiv', 'auto', 'Steam', 'steam.exe', 'Steam', 3, false, 15, 45, null),
    (2, 'Dreh', 'produktiv', 'manuell', null, null, null, 6, true, 120, 210, 'Dreh beim Kunden'),
    (2, 'Fahrt', 'produktiv', 'manuell', null, null, null, 4, true, 30, 60, 'Fahrt zum Dreh'),
    -- Leon: Google Ads, Meta Ads, KI, Orga, Kundentermine
    (3, 'Google Ads Learning', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'Kampagnen - Google Ads – Google Chrome', 26, false, 20, 70, null),
    (3, 'Meta Ads Learning', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'Werbeanzeigenmanager - Meta Business Suite – Google Chrome', 16, false, 20, 60, null),
    (3, 'KI Learning', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'ChatGPT – Google Chrome', 16, false, 20, 60, null),
    (3, 'Orga', 'produktiv', 'auto', 'Microsoft Outlook', 'OUTLOOK.EXE', 'Posteingang - Outlook', 14, false, 10, 40, null),
    (3, 'Orga', 'produktiv', 'auto', 'Google Chrome', 'chrome.exe', 'Kunden Q4 - Asana – Google Chrome', 8, false, 15, 45, null),
    (3, null, 'ungeklaert', 'auto', 'Google Chrome', 'chrome.exe', 'Instagram – Google Chrome', 5, false, 10, 30, null),
    (3, null, 'ungeklaert', 'auto', 'Google Chrome', 'chrome.exe', 'YouTube – Google Chrome', 5, false, 10, 30, null),
    (3, null, 'unproduktiv', 'auto', 'Google Chrome', 'chrome.exe', 'Twitch – Google Chrome', 3, false, 15, 45, null),
    (3, 'Kundentermin', 'produktiv', 'manuell', null, null, null, 5, true, 60, 120, 'Termin beim Kunden'),
    (3, 'Telefonat', 'produktiv', 'manuell', null, null, null, 4, true, 15, 45, 'Telefonat mit Kunde');

  -- 10 abgeschlossene Wochen (w = 0..9) plus die laufende Woche (w = 10)
  for w in 0..10 loop
    woche_start := montag_aktuell - ((10 - w) * 7);

    for pi in 1..3 loop
      p := personen[pi];
      wochenziel := 35 + random() * 23;  -- 35 bis 58 produktive Stunden

      for d in 0..6 loop
        tag := woche_start + d;
        exit when tag >= heute;  -- laufende Woche nur bis gestern

        if d >= 5 then
          -- Wochenende: nur manchmal ein kurzer Einsatz
          if random() < 0.2 then
            tagesziel := 1 + random() * 2;
          else
            continue;
          end if;
        else
          -- gelegentlich ein freier Wochentag
          if random() < 0.04 then
            continue;
          end if;
          tagesziel := wochenziel / 5 * (0.85 + random() * 0.3);
        end if;

        -- Arbeitsbeginn zwischen 8:30 und 9:45
        t := ((tag + time '08:30') + make_interval(mins => floor(random() * 75)::int)) at time zone tz;
        erledigt := 0;
        mittag_gemacht := (d >= 5);

        while erledigt < tagesziel * 3600 loop
          -- Mittagspause als inaktiver Block
          if not mittag_gemacht and (t at time zone tz)::time >= time '12:15' then
            dauer := make_interval(mins => 30 + floor(random() * 31)::int);
            insert into public.block (id, user_id, start, ende, quelle, bewertung, geraet, testdaten)
            values (gen_random_uuid(), p, t, t + dauer, 'auto', 'inaktiv', 'Testgerät', true);
            t := t + dauer;
            mittag_gemacht := true;
            continue;
          end if;

          -- gewichtete Zufallsauswahl einer Vorlage
          select * into v from vorlage
          where person = pi
          order by -ln(greatest(random(), 1e-12)) / gewicht
          limit 1;

          dauer := make_interval(mins => v.min_min + floor(random() * (v.max_min - v.min_min + 1))::int);

          insert into public.block (
            id, user_id, start, ende, quelle, programm, programm_roh, fenstertitel,
            taetigkeit, bewertung, notiz, manuell_geprueft, geraet, testdaten
          ) values (
            gen_random_uuid(), p, t, t + dauer, v.quelle, v.programm, v.programm_roh, v.titel,
            v.taetigkeit, v.bewertung, v.notiz, v.geprueft,
            case when v.quelle = 'auto' then 'Testgerät' end, true
          );
          t := t + dauer;

          if v.bewertung = 'produktiv' then
            erledigt := erledigt + extract(epoch from dauer);
          end if;

          -- kurze Pause vom Rechner
          if random() < 0.35 then
            dauer := make_interval(mins => 4 + floor(random() * 22)::int);
            insert into public.block (id, user_id, start, ende, quelle, bewertung, geraet, testdaten)
            values (gen_random_uuid(), p, t, t + dauer, 'auto', 'inaktiv', 'Testgerät', true);
            t := t + dauer;
          end if;

          -- Sicherung: kein Arbeitstag über 21 Uhr hinaus
          exit when (t at time zone tz)::time > time '21:00';
        end loop;
      end loop;
    end loop;
  end loop;

  -- Tätigkeiten, die nur durch die Testdaten neu entstehen, als Testdaten markieren
  insert into public.taetigkeit (name, schluessel, testdaten)
  select distinct on (public.taetigkeit_schluessel(taetigkeit))
    taetigkeit, public.taetigkeit_schluessel(taetigkeit), true
  from vorlage
  where taetigkeit is not null
  order by public.taetigkeit_schluessel(taetigkeit)
  on conflict (schluessel) do nothing;

  update public.profile set zuletzt_sync = now() where user_id = any (personen);
end;
$$;

-- Kontrolle: produktive, unproduktive und inaktive Stunden je Person und Woche
select
  p.name,
  (date_trunc('week', b.start at time zone 'Europe/Berlin'))::date as woche_ab,
  round(coalesce(sum(extract(epoch from (b.ende - b.start))) filter (where b.bewertung = 'produktiv'), 0) / 3600, 1) as produktiv_h,
  round(coalesce(sum(extract(epoch from (b.ende - b.start))) filter (where b.bewertung = 'unproduktiv'), 0) / 3600, 1) as unproduktiv_h,
  round(coalesce(sum(extract(epoch from (b.ende - b.start))) filter (where b.bewertung = 'inaktiv'), 0) / 3600, 1) as inaktiv_h,
  count(*) filter (where b.bewertung = 'ungeklaert') as ungeklaerte_bloecke
from public.block b
join public.profile p on p.user_id = b.user_id
where b.testdaten
group by p.name, woche_ab
order by woche_ab desc, p.name;
