-- ═══════════════════════════════════════════════════════════════════
-- Atualização 004 — Agenda dos sócios, escala dos funcionários,
-- e-mail de cada usuário (para receber avisos da agenda). Seguro rodar de novo.
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists email text;

-- Agenda compartilhada dos administradores (Eternity + Blue Star juntas)
create table if not exists public.calendar_events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  date            date not null,
  start_time      time,
  end_time        time,
  company_id      text references public.companies(id),     -- null = geral
  project_id      uuid references public.projects(id) on delete set null,
  who             text not null default 'todos',            -- 'todos' ou id do responsável
  notes           text,
  done            boolean not null default false,
  created_by      uuid references public.profiles(id),
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists calendar_events_date on public.calendar_events(date);
alter table public.calendar_events enable row level security;
drop policy if exists calendar_admin on public.calendar_events;
create policy calendar_admin on public.calendar_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.calendar_events to authenticated;
revoke all on public.calendar_events from anon;

-- Escala: onde cada funcionário trabalha em cada dia
create table if not exists public.work_schedule (
  id          uuid primary key default gen_random_uuid(),
  company_id  text not null references public.companies(id),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  date        date not null,
  project_id  uuid references public.projects(id) on delete cascade,
  start_time  time,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists work_schedule_date on public.work_schedule(company_id, date);
create index if not exists work_schedule_user on public.work_schedule(user_id, date);
alter table public.work_schedule enable row level security;
drop policy if exists schedule_read on public.work_schedule;
create policy schedule_read on public.work_schedule for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists schedule_admin on public.work_schedule;
create policy schedule_admin on public.work_schedule for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.work_schedule to authenticated;
revoke all on public.work_schedule from anon;

-- Blue Star: e-mail de resposta e endereço do app
insert into public.app_config (key, value) values
  ('admin_email_bluestar', 'bluestarhvac.inc@gmail.com'),
  ('app_url_bluestar', 'https://bluestar-hvac.netlify.app')
on conflict (key) do nothing;
