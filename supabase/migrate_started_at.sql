-- ============================================================
-- LifeOS — Migración: establecer started_at en tareas done
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Para tareas completadas sin started_at, usar created_at como fecha de inicio
-- (esto permite calcular correctamente el tiempo que tardó en completarse)
UPDATE tasks
SET started_at = created_at
WHERE status = 'done' AND started_at IS NULL AND completed_at IS NOT NULL;
