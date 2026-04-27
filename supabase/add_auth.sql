-- ============================================================
-- LifeOS — Migración: autenticación multi-usuario
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Agregar columna user_id a todas las tablas
-- ----------------------------------------------------------------
ALTER TABLE categories         ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE events             ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE fin_categories     ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE month_balances     ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE savings            ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE savings_pockets    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE pocket_fundings    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE savings_withdrawals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE savings_year_balances ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE goals              ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------
-- 2. Corregir restricciones UNIQUE para que sean por usuario
--    (antes eran globales, ahora deben ser por user_id)
-- ----------------------------------------------------------------
ALTER TABLE month_balances DROP CONSTRAINT IF EXISTS month_balances_year_month_key;
ALTER TABLE month_balances
  ADD CONSTRAINT month_balances_user_year_month_key UNIQUE (user_id, year_month);

ALTER TABLE savings_year_balances DROP CONSTRAINT IF EXISTS savings_year_balances_year_key;
ALTER TABLE savings_year_balances
  ADD CONSTRAINT savings_year_balances_user_year_key UNIQUE (user_id, year);

-- ----------------------------------------------------------------
-- 3. Habilitar Row Level Security en todas las tablas
-- ----------------------------------------------------------------
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE month_balances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_pockets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pocket_fundings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_year_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals               ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 4. Crear políticas de aislamiento: cada usuario ve solo sus datos
-- ----------------------------------------------------------------
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
      'DROP POLICY IF EXISTS user_isolation ON %I;
       CREATE POLICY user_isolation ON %I
       FOR ALL
       USING  (auth.uid() = user_id)
       WITH CHECK (auth.uid() = user_id)',
      t, t
    );
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------
-- 5. Limpiar filas huérfanas (sin user_id) que venían del período
--    de prueba sin autenticación — esto es opcional pero limpia la BD
-- ----------------------------------------------------------------
DELETE FROM pocket_fundings      WHERE user_id IS NULL;
DELETE FROM savings_withdrawals  WHERE user_id IS NULL;
DELETE FROM pocket_fundings      WHERE user_id IS NULL;
DELETE FROM savings              WHERE user_id IS NULL;
DELETE FROM goals                WHERE user_id IS NULL;
DELETE FROM transactions         WHERE user_id IS NULL;
DELETE FROM events               WHERE user_id IS NULL;
DELETE FROM month_balances       WHERE user_id IS NULL;
DELETE FROM savings_year_balances WHERE user_id IS NULL;
DELETE FROM savings_pockets      WHERE user_id IS NULL;
DELETE FROM fin_categories       WHERE user_id IS NULL;
DELETE FROM categories           WHERE user_id IS NULL;
