-- =====================================================================
-- wessamedia Zeit – Skript 7: Auszeichnungen ohne echte Blöcke entfernen
-- =====================================================================
-- Nach Skript 4 (Testdaten entfernen) kann eine Auszeichnung übrig bleiben,
-- die auf Testwochen beruhte, aber nicht als Testdaten markiert war.
-- Dieses Skript löscht jede Auszeichnung, in deren Woche die Person
-- keinen einzigen echten Block mehr hat. Auszeichnungen aus Wochen mit
-- echten Blöcken bleiben stehen.
-- Das Ergebnis zeigt, was entfernt wurde.
-- =====================================================================

delete from public.auszeichnung a
where not exists (
  select 1
  from public.block b
  where b.user_id = a.user_id
    and b.geloescht_am is null
    and b.ende > (a.woche_start::timestamp at time zone 'Europe/Berlin')
    and b.start < ((a.woche_start + 7)::timestamp at time zone 'Europe/Berlin')
)
returning typ, woche_start, user_id;
