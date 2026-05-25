-- ══════════════════════════════════════════════════════════════════════════════
-- Recordatorios
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  date        text not null,          -- "YYYY-MM-DD"
  time        text not null,          -- "HH:MM"
  done        boolean not null default false,
  snoozed_to  timestamptz,            -- si fue pospuesto, nueva hora
  created_at  timestamptz not null default now()
);

alter table public.reminders enable row level security;

create policy "usuario gestiona sus propios recordatorios"
  on public.reminders for all to authenticated using (user_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table public.reminders;
