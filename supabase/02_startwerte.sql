-- =====================================================================
-- wessamedia Zeit – Skript 2: Namen, Startziele, Startregeln, Symbole
-- =====================================================================
-- Vorher: Skript 1 ausführen und die drei Konten im Dashboard anlegen
-- (Authentication -> Users -> "Add user" -> "Create new user",
--  Häkchen bei "Auto Confirm User").
--
-- WICHTIG: Die drei E-Mail-Adressen unten müssen genau den Konten
-- entsprechen. Falls ihr andere Adressen benutzt, hier ändern.
--
-- Das Skript darf mehrfach ausgeführt werden: Ziele werden auf die
-- Startwerte zurückgesetzt, die Team-Startregeln neu angelegt,
-- selbst angelegte Regeln bleiben unberührt.
-- =====================================================================

do $$
declare
  email_moritz constant text := 'moritz@wessamedia.com';
  email_filipo constant text := 'filipo@wessamedia.com';
  email_leon   constant text := 'leon@wessamedia.com';
  moritz uuid;
  filipo uuid;
  leon uuid;
begin
  select id into moritz from auth.users where lower(email) = lower(email_moritz);
  select id into filipo from auth.users where lower(email) = lower(email_filipo);
  select id into leon   from auth.users where lower(email) = lower(email_leon);

  if moritz is null then
    raise exception 'Kein Konto mit der Adresse % gefunden. Erst die Konten anlegen oder die Adresse oben im Skript anpassen.', email_moritz;
  end if;
  if filipo is null then
    raise exception 'Kein Konto mit der Adresse % gefunden. Erst die Konten anlegen oder die Adresse oben im Skript anpassen.', email_filipo;
  end if;
  if leon is null then
    raise exception 'Kein Konto mit der Adresse % gefunden. Erst die Konten anlegen oder die Adresse oben im Skript anpassen.', email_leon;
  end if;

  -- Namen setzen (Profile existieren dank Skript 1 bereits)
  insert into public.profile (user_id, name) values
    (moritz, 'Moritz'), (filipo, 'Filipo'), (leon, 'Leon')
  on conflict (user_id) do update set name = excluded.name;

  -- Startziele. taetigkeit leer = Arbeitszeit gesamt.
  -- Die Learning-Stunden sind Teil der 50 Stunden, nicht obendrauf.
  insert into public.ziel (user_id, taetigkeit, stunden_pro_woche) values
    (moritz, null, 50),
    (filipo, null, 50),
    (leon,   null, 50),
    (moritz, 'Instagram Learning', 10),
    (moritz, 'TikTok Learning', 10),
    (moritz, 'KI Learning', 10),
    (moritz, 'LinkedIn Learning', 3),
    (filipo, 'KI Learning', 7),
    (filipo, 'Videografie Learning', 7),
    (leon,   'Google Ads Learning', 10),
    (leon,   'KI Learning', 7),
    (leon,   'Meta Ads Learning', 6)
  on conflict (user_id, taetigkeit) do update set stunden_pro_woche = excluded.stunden_pro_woche;

  -- Team-Startregeln neu anlegen (nur die ohne Ersteller, also die aus diesem Skript)
  delete from public.regel where gilt_fuer is null and erstellt_von is null;

  -- Regeln auf das Programm (funktionieren unter Windows und Mac)
  insert into public.regel (muster, feld, taetigkeit, bewertung, prioritaet) values
    ('Adobe Premiere Pro',   'programm', 'Videografie Learning', 'produktiv', 0),
    ('Adobe After Effects',  'programm', 'Videografie Learning', 'produktiv', 0),
    ('DaVinci Resolve',      'programm', 'Videografie Learning', 'produktiv', 0),
    ('CapCut',               'programm', 'Videografie Learning', 'produktiv', 0),
    ('Adobe Photoshop',      'programm', 'Videografie Learning', 'produktiv', 0),
    ('Adobe Lightroom',      'programm', 'Videografie Learning', 'produktiv', 0),
    ('Netflix',              'programm', null, 'unproduktiv', 0),
    ('Steam',                'programm', null, 'unproduktiv', 0),
    ('Instagram',            'programm', null, 'ungeklaert', 10),
    ('TikTok',               'programm', null, 'ungeklaert', 10),
    ('YouTube',              'programm', null, 'ungeklaert', 10);

  -- Regeln auf den Fenstertitel (greifen nur, wo Fenstertitel erfasst werden, also unter Windows)
  insert into public.regel (muster, feld, taetigkeit, bewertung, prioritaet) values
    ('Asana',                 'titel', 'Orga', 'produktiv', 0),
    ('Google Drive',          'titel', 'Orga', 'produktiv', 0),
    ('Google Docs',           'titel', 'Orga', 'produktiv', 0),
    ('Google Tabellen',       'titel', 'Orga', 'produktiv', 0),
    ('Google Sheets',         'titel', 'Orga', 'produktiv', 0),
    ('Google Präsentationen', 'titel', 'Orga', 'produktiv', 0),
    ('Google Slides',         'titel', 'Orga', 'produktiv', 0),
    ('Gmail',                 'titel', 'Orga', 'produktiv', 0),
    ('Outlook',               'titel', 'Orga', 'produktiv', 0),
    ('Google Ads',            'titel', 'Google Ads Learning', 'produktiv', 0),
    ('Meta Business',         'titel', 'Meta Ads Learning', 'produktiv', 0),
    ('Werbeanzeigenmanager',  'titel', 'Meta Ads Learning', 'produktiv', 0),
    ('Business Suite',        'titel', 'Meta Ads Learning', 'produktiv', 0),
    ('ChatGPT',               'titel', 'KI Learning', 'produktiv', 0),
    ('Claude',                'titel', 'KI Learning', 'produktiv', 0),
    ('Gemini',                'titel', 'KI Learning', 'produktiv', 0),
    ('Midjourney',            'titel', 'KI Learning', 'produktiv', 0),
    ('LinkedIn',              'titel', 'LinkedIn Learning', 'produktiv', 0),
    ('Netflix',               'titel', null, 'unproduktiv', 0),
    ('Twitch',                'titel', null, 'unproduktiv', 0),
    ('DAZN',                  'titel', null, 'unproduktiv', 0),
    ('Instagram',             'titel', null, 'ungeklaert', 10),
    ('TikTok',                'titel', null, 'ungeklaert', 10),
    ('YouTube',               'titel', null, 'ungeklaert', 10);

  -- Symbole je Tätigkeit: Marken bekommen ihr Logo, alles andere ein lucide-Symbol.
  insert into public.taetigkeit (name, schluessel, symbol_typ, symbol_name) values
    ('Instagram Learning',   public.taetigkeit_schluessel('Instagram Learning'),   'marke',  'instagram'),
    ('TikTok Learning',      public.taetigkeit_schluessel('TikTok Learning'),      'marke',  'tiktok'),
    ('LinkedIn Learning',    public.taetigkeit_schluessel('LinkedIn Learning'),    'marke',  'linkedin'),
    ('Google Ads Learning',  public.taetigkeit_schluessel('Google Ads Learning'),  'marke',  'googleads'),
    ('Meta Ads Learning',    public.taetigkeit_schluessel('Meta Ads Learning'),    'marke',  'meta'),
    ('KI Learning',          public.taetigkeit_schluessel('KI Learning'),          'lucide', 'brain'),
    ('Videografie Learning', public.taetigkeit_schluessel('Videografie Learning'), 'lucide', 'clapperboard'),
    ('Orga',                 public.taetigkeit_schluessel('Orga'),                 'lucide', 'list-checks'),
    ('Dreh',                 public.taetigkeit_schluessel('Dreh'),                 'lucide', 'camera'),
    ('Fahrt',                public.taetigkeit_schluessel('Fahrt'),                'lucide', 'car'),
    ('Kundentermin',         public.taetigkeit_schluessel('Kundentermin'),         'lucide', 'users'),
    ('Telefonat',            public.taetigkeit_schluessel('Telefonat'),            'lucide', 'phone'),
    ('Konzept',              public.taetigkeit_schluessel('Konzept'),              'lucide', 'pencil')
  on conflict (schluessel) do nothing;

  raise notice 'Startwerte gesetzt für Moritz (%), Filipo (%), Leon (%).', moritz, filipo, leon;
end;
$$;

-- Kontrolle: Diese Abfrage zeigt die Ziele je Person.
select p.name, coalesce(z.taetigkeit, 'Arbeitszeit gesamt') as ziel, z.stunden_pro_woche
from public.ziel z
join public.profile p on p.user_id = z.user_id
order by p.name, z.taetigkeit nulls first;
