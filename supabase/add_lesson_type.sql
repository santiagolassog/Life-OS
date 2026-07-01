-- ══════════════════════════════════════════════════════════════════════════════
-- Agrega soporte de tipo de lección (video / document) a academy_lessons
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.academy_lessons
  add column if not exists lesson_type text not null default 'video'
    check (lesson_type in ('video', 'document'));

-- Para lecciones existentes, document_url será null (solo tienen youtube_url)
alter table public.academy_lessons
  add column if not exists document_url text;
