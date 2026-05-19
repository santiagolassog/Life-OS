-- ══════════════════════════════════════════════════════════════════════════════
-- Agrega tabla academy_modules (capa entre cursos y lecciones)
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Tabla de módulos
create table if not exists public.academy_modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.academy_courses(id) on delete cascade,
  title       text not null,
  description text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.academy_modules enable row level security;

create policy "super_admin puede hacer todo en academy_modules"
  on public.academy_modules for all
  to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'super_admin')
  );

create policy "miembros pueden leer módulos de su empresa"
  on public.academy_modules for select
  to authenticated using (
    exists (
      select 1 from public.academy_courses ac
      join public.company_members cm on cm.company_id = ac.company_id
      where ac.id = academy_modules.course_id and cm.user_id = auth.uid()
    )
  );

-- 2. Agregar module_id a lecciones (nullable para compat con lecciones existentes)
alter table public.academy_lessons
  add column if not exists module_id uuid references public.academy_modules(id) on delete cascade;

-- 3. Realtime
alter publication supabase_realtime add table public.academy_modules;
