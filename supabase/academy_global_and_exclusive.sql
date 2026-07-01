-- ══════════════════════════════════════════════════════════════════════════════
-- Academia: Cursos globales + contenido exclusivo por empresa
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Hacer company_id nullable en academy_courses (cursos ahora son globales)
alter table public.academy_courses
  alter column company_id drop not null;

-- ── 2. Tabla de acceso empresa-curso (qué empresas pueden ver qué cursos)
create table if not exists public.company_course_access (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  course_id   uuid not null references public.academy_courses(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  unique (company_id, course_id)
);

alter table public.company_course_access enable row level security;

create policy "super_admin puede hacer todo en company_course_access"
  on public.company_course_access for all
  to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'super_admin')
  );

create policy "miembros pueden leer su acceso a cursos"
  on public.company_course_access for select
  to authenticated using (
    exists (
      select 1 from public.company_members
      where company_id = company_course_access.company_id and user_id = auth.uid()
    )
  );

-- Migrar cursos existentes: crear acceso automático para la empresa que tenía asignada
insert into public.company_course_access (id, company_id, course_id)
select gen_random_uuid(), company_id, id
from public.academy_courses
where company_id is not null
on conflict (company_id, course_id) do nothing;

-- ── 3. Tabla de videos exclusivos por empresa
create table if not exists public.company_exclusive_videos (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  title            text not null,
  youtube_url      text not null,
  description      text,
  duration_minutes int,
  sort_order       int not null default 0,
  published        boolean not null default true,
  created_at       timestamptz not null default now()
);

alter table public.company_exclusive_videos enable row level security;

create policy "super_admin puede hacer todo en exclusive_videos"
  on public.company_exclusive_videos for all
  to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'super_admin')
  );

create policy "miembros pueden leer videos exclusivos de su empresa"
  on public.company_exclusive_videos for select
  to authenticated using (
    exists (
      select 1 from public.company_members
      where company_id = company_exclusive_videos.company_id and user_id = auth.uid()
    )
  );

-- ── 4. Progreso de videos exclusivos
create table if not exists public.exclusive_video_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  video_id     uuid not null references public.company_exclusive_videos(id) on delete cascade,
  completed    boolean not null default false,
  completed_at timestamptz,
  unique (user_id, video_id)
);

alter table public.exclusive_video_progress enable row level security;

create policy "usuario puede gestionar su propio progreso exclusivo"
  on public.exclusive_video_progress for all
  to authenticated using (user_id = auth.uid());

-- ── 5. Realtime
alter publication supabase_realtime add table public.company_course_access;
alter publication supabase_realtime add table public.company_exclusive_videos;
alter publication supabase_realtime add table public.exclusive_video_progress;
