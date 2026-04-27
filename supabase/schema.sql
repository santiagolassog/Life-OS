-- ============================================================
-- LifeOS — Esquema de base de datos para Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ----------------------------------------------------------------
-- 1. CATEGORÍAS DE TIEMPO (áreas de vida)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  color        TEXT NOT NULL,
  short        TEXT NOT NULL,
  presets      TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 2. EVENTOS / BLOQUES DE TIEMPO
--    (sin FK sobre category_id: la app muestra fallback si falta)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  date_id      TEXT NOT NULL,          -- "YYYY-MM-DD"
  start_hour   TEXT NOT NULL,          -- "HH:MM"
  end_hour     TEXT NOT NULL,          -- "HH:MM"
  category_id  TEXT NOT NULL,
  task         TEXT NOT NULL DEFAULT '',
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  energy       INTEGER CHECK (energy BETWEEN 1 AND 5),
  impact       INTEGER CHECK (impact BETWEEN 1 AND 5),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_date_id_idx ON events(date_id);

-- ----------------------------------------------------------------
-- 3. CATEGORÍAS FINANCIERAS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fin_categories (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  color        TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both')),
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 4. TRANSACCIONES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id                TEXT PRIMARY KEY,
  date              TEXT NOT NULL,          -- "YYYY-MM-DD"
  type              TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount            DECIMAL(14, 2) NOT NULL,
  fin_category_id   TEXT NOT NULL REFERENCES fin_categories(id) ON DELETE RESTRICT,
  description       TEXT NOT NULL DEFAULT '',
  linked_event_id   TEXT,                   -- referencia suave a events.id
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(date);

-- ----------------------------------------------------------------
-- 5. SALDOS DE APERTURA MENSUALES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS month_balances (
  id              TEXT PRIMARY KEY,
  year_month      TEXT NOT NULL UNIQUE,     -- "YYYY-MM"
  opening_balance DECIMAL(14, 2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 6. DEPÓSITOS DE AHORRO
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS savings (
  id                    TEXT PRIMARY KEY,
  amount                DECIMAL(14, 2) NOT NULL,
  date                  TEXT NOT NULL,          -- "YYYY-MM-DD"
  description           TEXT NOT NULL DEFAULT '',
  source_transaction_id TEXT,                   -- referencia suave a transactions.id
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 7. BOLSILLOS DE AHORRO
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS savings_pockets (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 8. MOVIMIENTOS DE BOLSILLOS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pocket_fundings (
  id          TEXT PRIMARY KEY,
  pocket_id   TEXT NOT NULL REFERENCES savings_pockets(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,          -- "YYYY-MM-DD"
  amount      DECIMAL(14, 2) NOT NULL,  -- positivo = entrada, negativo = salida
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 9. RETIROS DE AHORRO
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS savings_withdrawals (
  id             TEXT PRIMARY KEY,
  date           TEXT NOT NULL,          -- "YYYY-MM-DD"
  amount         DECIMAL(14, 2) NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  from_pocket_id TEXT REFERENCES savings_pockets(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 10. SALDOS DE APERTURA ANUALES (ahorros)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS savings_year_balances (
  id              TEXT PRIMARY KEY,
  year            INTEGER NOT NULL UNIQUE,
  savings_opening DECIMAL(14, 2) NOT NULL DEFAULT 0,
  general_opening DECIMAL(14, 2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 11. OBJETIVOS
--     (sin FK sobre category_id: la app muestra fallback si falta)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  priority     TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  scope        TEXT NOT NULL CHECK (scope IN ('weekly', 'daily')),
  week_id      TEXT NOT NULL,          -- "YYYY-Www"
  date_id      TEXT,                   -- "YYYY-MM-DD" para objetivos diarios
  category_id  TEXT,                   -- referencia suave a categories.id
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TEXT,                   -- ISO timestamp
  created_at   TEXT NOT NULL,          -- ISO timestamp (viene del app)
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS goals_week_id_idx ON goals(week_id);

-- ----------------------------------------------------------------
-- TRIGGER: actualiza updated_at automáticamente en cada UPDATE
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION lifeos_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'categories', 'events', 'fin_categories', 'transactions',
    'month_balances', 'savings', 'savings_pockets', 'pocket_fundings',
    'savings_withdrawals', 'savings_year_balances', 'goals'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I;
       CREATE TRIGGER set_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION lifeos_update_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;
