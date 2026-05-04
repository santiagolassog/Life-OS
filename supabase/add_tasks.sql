-- ============================================================
-- LifeOS — Migración: sistema de tareas (LISTA)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Tabla principal de tareas ────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT        PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT,
  status        TEXT        NOT NULL DEFAULT 'todo',   -- 'todo' | 'inprogress' | 'done'
  category_id   TEXT,                                  -- referencia al id de categoría/área
  priority      TEXT        NOT NULL DEFAULT 'medium', -- 'high' | 'medium' | 'low'
  deadline      TEXT,                                  -- "YYYY-MM-DD"
  created_at    TEXT        NOT NULL,
  started_at    TEXT,                                  -- cuándo pasó a inprogress
  completed_at  TEXT,                                  -- cuándo pasó a done
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_user_idx ON tasks(user_id);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_isolation ON tasks;
CREATE POLICY user_isolation ON tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON tasks;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION lifeos_update_updated_at();

-- ── Tabla de ítems de checklist ──────────────────────────────
CREATE TABLE IF NOT EXISTS checklist_items (
  id          TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id     TEXT        NOT NULL,
  text        TEXT        NOT NULL,
  done        BOOLEAN     NOT NULL DEFAULT FALSE,
  "order"     INTEGER     NOT NULL DEFAULT 0,
  created_at  TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS checklist_items_task_idx ON checklist_items(user_id, task_id);

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_isolation ON checklist_items;
CREATE POLICY user_isolation ON checklist_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON checklist_items;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON checklist_items
  FOR EACH ROW EXECUTE FUNCTION lifeos_update_updated_at();
