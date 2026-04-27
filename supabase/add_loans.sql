-- ============================================================
-- LifeOS — Migración: sistema de préstamos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Tabla de préstamos
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name  TEXT NOT NULL,
  amount       DECIMAL(14, 2) NOT NULL,
  date         TEXT NOT NULL,          -- "YYYY-MM-DD"
  description  TEXT,
  transaction_id TEXT,                 -- referencia suave al egreso de "Préstamos"
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  completed_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS loans_user_status_idx ON loans(user_id, status);

-- ----------------------------------------------------------------
-- 2. Tabla de pagos / reintegros de préstamos
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loan_payments (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id        TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount         DECIMAL(14, 2) NOT NULL,
  date           TEXT NOT NULL,        -- "YYYY-MM-DD"
  description    TEXT,
  transaction_id TEXT,                 -- referencia suave al ingreso de "Reintegros"
  created_at     TEXT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS loan_payments_loan_idx ON loan_payments(loan_id);

-- ----------------------------------------------------------------
-- 3. Row Level Security
-- ----------------------------------------------------------------
ALTER TABLE loans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_isolation ON loans;
CREATE POLICY user_isolation ON loans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_isolation ON loan_payments;
CREATE POLICY user_isolation ON loan_payments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 4. Triggers updated_at
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS set_updated_at ON loans;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION lifeos_update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON loan_payments;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON loan_payments
  FOR EACH ROW EXECUTE FUNCTION lifeos_update_updated_at();
