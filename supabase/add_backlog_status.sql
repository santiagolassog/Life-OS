-- ============================================================
-- LifeOS — Migración: estado Backlog en tareas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Cambia el valor por defecto del status a 'backlog'
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'backlog';
