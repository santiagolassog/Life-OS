-- ============================================================
-- LifeOS — Migración: sistema de presupuesto mensual
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

CREATE TABLE IF NOT EXISTS budgets (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_month      TEXT NOT NULL,          -- "2026-05"
  fin_category_id TEXT NOT NULL,
  amount          DECIMAL(14, 2) NOT NULL CHECK (amount > 0),
  created_at      TEXT NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT budgets_unique_cat_month UNIQUE (user_id, year_month, fin_category_id)
);

CREATE INDEX IF NOT EXISTS budgets_user_month_idx ON budgets(user_id, year_month);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_isolation ON budgets;
CREATE POLICY user_isolation ON budgets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON budgets;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION lifeos_update_updated_at();
