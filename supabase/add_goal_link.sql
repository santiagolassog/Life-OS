-- ============================================================
-- LifeOS — Migración: vincular tareas con objetivos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Agrega goal_id a tasks (referencia suave — no FK — igual al
-- patrón del resto de la app: category_id, linked_event_id…)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS goal_id TEXT;

-- Índice para consultas "tareas de este objetivo" sin full-scan
CREATE INDEX IF NOT EXISTS tasks_goal_id_idx ON tasks(user_id, goal_id)
  WHERE goal_id IS NOT NULL;
