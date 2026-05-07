-- ============================================================
-- LifeOS — Migración: campo deadline en objetivos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Agrega el campo deadline a goals (referencia suave: "YYYY-MM-DD")
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS deadline TEXT;
