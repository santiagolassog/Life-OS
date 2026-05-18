-- ══════════════════════════════════════════════════════════════════════════════
-- LifeOS Enterprise Schema
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Perfiles de usuario (registro público de usuarios autenticados) ─────────
create table if not exists public.user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email        text,
  role         text not null default 'user'
                  check (role in ('super_admin', 'user')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Trigger para crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Insertar perfiles para usuarios existentes (no borra los existentes)
insert into public.user_profiles (id, email, display_name)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'display_name', split_part(au.email, '@', 1))
from auth.users au
on conflict (id) do nothing;

-- RLS user_profiles
alter table public.user_profiles enable row level security;

create policy "usuarios autenticados pueden leer perfiles"
  on public.user_profiles for select
  to authenticated using (true);

create policy "usuario puede actualizar su propio perfil"
  on public.user_profiles for update
  to authenticated using (auth.uid() = id);

create policy "super_admin puede actualizar cualquier perfil"
  on public.user_profiles for update
  to authenticated using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  );


-- ── 2. Empresas ────────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  description text,
  logo_url    text,
  plan        text not null default 'basic'
                  check (plan in ('basic', 'pro', 'enterprise')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.companies enable row level security;

create policy "super_admin puede hacer todo en companies"
  on public.companies for all
  to authenticated using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

create policy "miembros pueden leer su empresa"
  on public.companies for select
  to authenticated using (
    exists (
      select 1 from public.company_members
      where company_id = companies.id and user_id = auth.uid()
    )
  );


-- ── 3. Miembros de empresa ─────────────────────────────────────────────────────
create table if not exists public.company_members (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member'
                  check (role in ('owner', 'admin', 'member')),
  joined_at   timestamptz not null default now(),
  unique (company_id, user_id)
);

alter table public.company_members enable row level security;

create policy "super_admin puede hacer todo en company_members"
  on public.company_members for all
  to authenticated using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

create policy "miembros pueden ver sus propias membresías"
  on public.company_members for select
  to authenticated using (user_id = auth.uid());


-- ── 4. Módulos habilitados por empresa ─────────────────────────────────────────
-- module_key: 'tiempo' | 'dinero' | 'lista' | 'objetivos' | 'habitos' | 'revision' | 'academia'
create table if not exists public.company_modules (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  module_key  text not null,
  enabled     boolean not null default true,
  unique (company_id, module_key)
);

alter table public.company_modules enable row level security;

create policy "super_admin puede hacer todo en company_modules"
  on public.company_modules for all
  to authenticated using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

create policy "miembros pueden leer módulos de su empresa"
  on public.company_modules for select
  to authenticated using (
    exists (
      select 1 from public.company_members
      where company_id = company_modules.company_id and user_id = auth.uid()
    )
  );


-- ── 5. Cursos de Academia ──────────────────────────────────────────────────────
create table if not exists public.academy_courses (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  title        text not null,
  description  text,
  thumbnail_url text,
  sort_order   int not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.academy_courses enable row level security;

create policy "super_admin puede hacer todo en academy_courses"
  on public.academy_courses for all
  to authenticated using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

create policy "miembros pueden leer cursos de su empresa"
  on public.academy_courses for select
  to authenticated using (
    exists (
      select 1 from public.company_members
      where company_id = academy_courses.company_id and user_id = auth.uid()
    )
  );


-- ── 6. Lecciones de cursos (videos YouTube) ────────────────────────────────────
create table if not exists public.academy_lessons (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references public.academy_courses(id) on delete cascade,
  title            text not null,
  youtube_url      text not null,
  description      text,
  duration_minutes int,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

alter table public.academy_lessons enable row level security;

create policy "super_admin puede hacer todo en academy_lessons"
  on public.academy_lessons for all
  to authenticated using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

create policy "miembros pueden leer lecciones de su empresa"
  on public.academy_lessons for select
  to authenticated using (
    exists (
      select 1 from public.academy_courses ac
      join public.company_members cm on cm.company_id = ac.company_id
      where ac.id = academy_lessons.course_id and cm.user_id = auth.uid()
    )
  );


-- ── 7. Progreso de lecciones por usuario ──────────────────────────────────────
create table if not exists public.academy_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  lesson_id    uuid not null references public.academy_lessons(id) on delete cascade,
  completed    boolean not null default false,
  completed_at timestamptz,
  unique (user_id, lesson_id)
);

alter table public.academy_progress enable row level security;

create policy "usuario puede gestionar su propio progreso"
  on public.academy_progress for all
  to authenticated using (user_id = auth.uid());

create policy "super_admin puede leer todo el progreso"
  on public.academy_progress for select
  to authenticated using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );


-- ── 8. Habilitar realtime para tablas enterprise ───────────────────────────────
alter publication supabase_realtime add table public.companies;
alter publication supabase_realtime add table public.company_members;
alter publication supabase_realtime add table public.company_modules;
alter publication supabase_realtime add table public.academy_courses;
alter publication supabase_realtime add table public.academy_lessons;
alter publication supabase_realtime add table public.academy_progress;
alter publication supabase_realtime add table public.user_profiles;


-- ── 9. Para marcar a Santiago como super_admin ────────────────────────────────
-- Reemplaza el email con el tuyo y ejecuta DESPUÉS de hacer login al menos una vez
-- update public.user_profiles
-- set role = 'super_admin'
-- where email = 'TU_EMAIL@aqui.com';
