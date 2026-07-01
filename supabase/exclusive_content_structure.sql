-- ══════════════════════════════════════════════════════════════════════════════
-- Material exclusivo estructurado (reemplaza company_exclusive_videos)
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Materiales exclusivos por empresa ──────────────────────────────────────
create table if not exists public.exclusive_content (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  title       text not null,
  description text,
  sort_order  int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.exclusive_content enable row level security;

create policy "super_admin puede hacer todo en exclusive_content"
  on public.exclusive_content for all to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'super_admin')
  );

create policy "miembros pueden leer exclusive_content de su empresa"
  on public.exclusive_content for select to authenticated using (
    exists (
      select 1 from public.company_members
      where company_id = exclusive_content.company_id and user_id = auth.uid()
    )
  );

-- ── 2. Módulos dentro de materiales exclusivos (opcionales) ───────────────────
create table if not exists public.exclusive_modules (
  id          uuid primary key default gen_random_uuid(),
  content_id  uuid not null references public.exclusive_content(id) on delete cascade,
  title       text not null,
  description text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.exclusive_modules enable row level security;

create policy "super_admin puede hacer todo en exclusive_modules"
  on public.exclusive_modules for all to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'super_admin')
  );

create policy "miembros pueden leer exclusive_modules de su empresa"
  on public.exclusive_modules for select to authenticated using (
    exists (
      select 1 from public.exclusive_content ec
      join public.company_members cm on cm.company_id = ec.company_id
      where ec.id = exclusive_modules.content_id and cm.user_id = auth.uid()
    )
  );

-- ── 3. Lecciones exclusivas (module_id nullable = lección suelta) ─────────────
create table if not exists public.exclusive_lessons (
  id               uuid primary key default gen_random_uuid(),
  content_id       uuid not null references public.exclusive_content(id) on delete cascade,
  module_id        uuid references public.exclusive_modules(id) on delete cascade,
  title            text not null,
  lesson_type      text not null default 'video' check (lesson_type in ('video', 'document')),
  youtube_url      text,
  document_url     text,
  description      text,
  duration_minutes int,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

alter table public.exclusive_lessons enable row level security;

create policy "super_admin puede hacer todo en exclusive_lessons"
  on public.exclusive_lessons for all to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'super_admin')
  );

create policy "miembros pueden leer exclusive_lessons de su empresa"
  on public.exclusive_lessons for select to authenticated using (
    exists (
      select 1 from public.exclusive_content ec
      join public.company_members cm on cm.company_id = ec.company_id
      where ec.id = exclusive_lessons.content_id and cm.user_id = auth.uid()
    )
  );

-- ── 4. Progreso de lecciones exclusivas ───────────────────────────────────────
create table if not exists public.exclusive_lesson_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  lesson_id    uuid not null references public.exclusive_lessons(id) on delete cascade,
  completed    boolean not null default false,
  completed_at timestamptz,
  unique (user_id, lesson_id)
);

alter table public.exclusive_lesson_progress enable row level security;

create policy "usuario gestiona su propio progreso exclusivo"
  on public.exclusive_lesson_progress for all to authenticated using (user_id = auth.uid());

-- ── 5. También permitir lecciones sueltas en cursos globales ─────────────────
-- (academy_lessons ya tiene module_id nullable, solo asegurar)
alter table public.academy_lessons
  alter column youtube_url drop not null;  -- por si no se corrió antes

-- ── 6. Realtime ───────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.exclusive_content;
alter publication supabase_realtime add table public.exclusive_modules;
alter publication supabase_realtime add table public.exclusive_lessons;
alter publication supabase_realtime add table public.exclusive_lesson_progress;
