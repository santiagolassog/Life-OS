-- ══════════════════════════════════════════════════════════════════════════════
-- Agregar sort_order a hábitos
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.habits add column if not exists sort_order integer not null default 0;
