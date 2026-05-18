-- ============================================================
-- LifeOS — Migración: módulo de Hábitos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Tabla de hábitos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habits (
  id          TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  target      INTEGER     NOT NULL DEFAULT 7 CHECK (target BETWEEN 1 AND 7),
  color       TEXT        NOT NULL DEFAULT 'bg-indigo-500',
  start_date  TEXT        NOT NULL,
  created_at  TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS habits_user_idx ON habits(user_id);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_isolation ON habits;
CREATE POLICY user_isolation ON habits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON habits;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON habits
  FOR EACH ROW EXECUTE FUNCTION lifeos_update_updated_at();

-- ── Tabla de registros de hábitos (logs) ─────────────────────
CREATE TABLE IF NOT EXISTS habit_logs (
  id          TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id    TEXT        NOT NULL,
  date        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS habit_logs_user_habit_idx ON habit_logs(user_id, habit_id);
CREATE UNIQUE INDEX IF NOT EXISTS habit_logs_unique_day ON habit_logs(user_id, habit_id, date);

ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_isolation ON habit_logs;
CREATE POLICY user_isolation ON habit_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Columna habitId en events (para asociar evento a hábito) ──
ALTER TABLE events ADD COLUMN IF NOT EXISTS habit_id TEXT;

-- ── Agregar a Realtime ────────────────────────────────────────
ALTER TABLE habits     REPLICA IDENTITY FULL;
ALTER TABLE habit_logs REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE habits, habit_logs;
