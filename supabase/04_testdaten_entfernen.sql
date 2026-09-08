-- =====================================================================
-- wessamedia Zeit – Skript 4: Testdaten rückstandslos entfernen
-- =====================================================================
-- Löscht ausschließlich Zeilen mit testdaten = true. Echte Blöcke,
-- selbst angelegte Regeln, Ziele und Symbole bleiben unberührt.
-- Das Ergebnis zeigt, wie viele Zeilen je Tabelle entfernt wurden.
-- =====================================================================

with
  bloecke as (delete from public.block where testdaten returning 1),
  auszeichnungen as (delete from public.auszeichnung where testdaten returning 1),
  taetigkeiten as (delete from public.taetigkeit where testdaten returning 1),
  regeln as (delete from public.regel where testdaten returning 1)
select
  (select count(*) from bloecke) as bloecke_entfernt,
  (select count(*) from auszeichnungen) as auszeichnungen_entfernt,
  (select count(*) from taetigkeiten) as taetigkeiten_entfernt,
  (select count(*) from regeln) as regeln_entfernt;
