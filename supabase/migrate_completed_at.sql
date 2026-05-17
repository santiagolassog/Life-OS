-- ============================================================
-- LifeOS — Migración: establecer completed_at en tareas done
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Para tareas en estado 'done' sin completed_at, establecer como created_at
-- (asumiendo que fueron completadas cuando se marcaron como done)
UPDATE tasks
SET completed_at = created_at
WHERE status = 'done' AND completed_at IS NULL;
