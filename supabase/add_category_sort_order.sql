-- ============================================================
-- LifeOS — Migración: orden manual de áreas/categorías
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
