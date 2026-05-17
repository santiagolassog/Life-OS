-- ============================================================
-- LifeOS — Revertir: limpiar started_at incorrecto
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Borrar started_at que fueron establecidos como created_at
-- (mantener solo los started_at que se registraron correctamente al pasar a "En progreso")
UPDATE tasks
SET started_at = NULL
WHERE status = 'done' AND started_at = created_at AND completed_at IS NOT NULL;
