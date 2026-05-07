-- ============================================================
-- LifeOS — Migración: orden manual de tareas en el kanban
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Agrega sort_order a tasks (BIGINT para guardar timestamps de Date.now())
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sort_order BIGINT NOT NULL DEFAULT 0;
