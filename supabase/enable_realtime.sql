-- ============================================================
-- LifeOS — Habilitar Supabase Realtime en todas las tablas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- REPLICA IDENTITY FULL permite que los eventos DELETE incluyan
-- los datos del row eliminado (necesario para sincronizar borrados).

ALTER TABLE categories           REPLICA IDENTITY FULL;
ALTER TABLE events               REPLICA IDENTITY FULL;
ALTER TABLE fin_categories       REPLICA IDENTITY FULL;
ALTER TABLE transactions         REPLICA IDENTITY FULL;
ALTER TABLE month_balances       REPLICA IDENTITY FULL;
ALTER TABLE savings              REPLICA IDENTITY FULL;
ALTER TABLE savings_pockets      REPLICA IDENTITY FULL;
ALTER TABLE pocket_fundings      REPLICA IDENTITY FULL;
ALTER TABLE savings_withdrawals  REPLICA IDENTITY FULL;
ALTER TABLE savings_year_balances REPLICA IDENTITY FULL;
ALTER TABLE goals                REPLICA IDENTITY FULL;
ALTER TABLE loans                REPLICA IDENTITY FULL;
ALTER TABLE loan_payments        REPLICA IDENTITY FULL;
ALTER TABLE budgets              REPLICA IDENTITY FULL;
ALTER TABLE tasks                REPLICA IDENTITY FULL;
ALTER TABLE checklist_items      REPLICA IDENTITY FULL;

-- Agregar todas las tablas a la publicación de Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE
  categories, events, fin_categories, transactions,
  month_balances, savings, savings_pockets, pocket_fundings,
  savings_withdrawals, savings_year_balances, goals,
  loans, loan_payments, budgets, tasks, checklist_items;
