-- ═══════════════════════════════════════════════════════════════════
-- Eternity Electric app — banco de dados (Supabase / Postgres)
-- Cole este arquivo inteiro em: Supabase → SQL Editor → New query → Run
-- Seguro para rodar de novo (idempotente na maior parte).
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ───────── Empresas ─────────
create table if not exists public.companies (
  id    text primary key,
  name  text not null,
  trade text not null check (trade in ('electrical','hvac'))
);
insert into public.companies (id, name, trade) values
  ('eternity', 'Eternity Electric', 'electrical'),
  ('bluestar', 'Blue Star HVAC', 'hvac')
on conflict (id) do nothing;

-- ───────── Perfis (um por login) ─────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text not null default '',
  role        text not null default 'employee' check (role in ('admin','employee')),
  company_id  text references public.companies(id) default 'eternity',
  hourly_rate numeric(10,2) not null default 0,
  active      boolean not null default false,  -- novo cadastro só entra depois que o admin ativa
  created_at  timestamptz not null default now()
);

-- Cria o perfil automaticamente quando um login é criado.
-- Sempre nasce como FUNCIONÁRIO e INATIVO (ninguém consegue se cadastrar sozinho como admin).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name, role, active)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          'employee', false)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Funções auxiliares usadas pelas regras de segurança
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active);
$$;
create or replace function public.my_company() returns text
language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid() and active;
$$;

-- ───────── Projetos (o que a equipe pode ver: SEM valores) ─────────
create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  company_id     text not null references public.companies(id),
  name           text not null,
  client         text,
  address        text,
  lat            double precision,
  lng            double precision,
  radius_m       integer not null default 150,
  status         text not null default 'Active',
  start_date     date,
  est_completion date,
  details        jsonb not null default '{}'::jsonb,  -- setor, tipo, quartos, permit, paredes, Romex/MC, serviço, equipamento HVAC...
  scope          text not null default '',           -- escopo do contrato
  team_notes     text not null default '',           -- recado para a equipe
  created_at     timestamptz not null default now()
);

-- Valores da obra: tabela separada, SÓ administrador lê ou grava
create table if not exists public.project_financials (
  project_id     uuid primary key references public.projects(id) on delete cascade,
  contract_value numeric(12,2) not null default 0,
  budget         numeric(12,2) not null default 0,
  est_hours      numeric(10,2) not null default 0
);

create table if not exists public.project_tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  grp          text not null default 'Outros',
  label        text not null,
  done         boolean not null default false,
  done_by_name text,
  done_at      timestamptz,
  sort         integer not null default 0
);
create index if not exists project_tasks_project on public.project_tasks(project_id);

create table if not exists public.project_files (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,
  mime       text,
  size       bigint,
  path       text not null,   -- caminho no bucket "project-files"
  created_at timestamptz not null default now()
);
create index if not exists project_files_project on public.project_files(project_id);

-- ───────── Ponto ─────────
create table if not exists public.time_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id),
  company_id text not null references public.companies(id),
  project_id uuid references public.projects(id) on delete set null,
  check_in   timestamptz not null,
  check_out  timestamptz,
  rate       numeric(10,2) not null default 0,   -- valor/hora no momento do ponto
  in_lat double precision, in_lng double precision,
  out_lat double precision, out_lng double precision,
  in_photo  text, out_photo text,                  -- caminhos no bucket "punch-photos"
  created_at timestamptz not null default now()
);
create index if not exists time_entries_company_in on public.time_entries(company_id, check_in);
create index if not exists time_entries_user on public.time_entries(user_id, check_in);

-- ───────── Gastos e receitas ─────────
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  company_id   text not null references public.companies(id),
  project_id   uuid references public.projects(id) on delete set null,
  kind         text not null default 'expense' check (kind in ('expense','revenue')),
  category     text not null,   -- material, gasolina, subcontractor, permit, equipamento, outros, receita
  amount       numeric(12,2) not null check (amount >= 0),
  vendor       text,
  date         date not null default current_date,
  note         text,
  receipt_path text,             -- caminho no bucket "receipts"
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists expenses_company_date on public.expenses(company_id, date);

-- ═══════════ REGRAS DE SEGURANÇA (Row Level Security) ═══════════
alter table public.companies          enable row level security;
alter table public.profiles           enable row level security;
alter table public.projects           enable row level security;
alter table public.project_financials enable row level security;
alter table public.project_tasks      enable row level security;
alter table public.project_files      enable row level security;
alter table public.time_entries       enable row level security;
alter table public.expenses           enable row level security;

drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies for select to authenticated using (true);

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated
  using (public.is_admin() or (company_id = public.my_company() and status in ('Active','Planned','On Hold')));
drop policy if exists projects_admin on public.projects;
create policy projects_admin on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists fin_admin on public.project_financials;
create policy fin_admin on public.project_financials for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists tasks_read on public.project_tasks;
create policy tasks_read on public.project_tasks for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));   -- herda a regra de projects
drop policy if exists tasks_admin on public.project_tasks;
create policy tasks_admin on public.project_tasks for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists files_read on public.project_files;
create policy files_read on public.project_files for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));
drop policy if exists files_admin on public.project_files;
create policy files_admin on public.project_files for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Funcionário vê só o próprio ponto; não grava direto (usa clock_in / clock_out com hora do servidor)
drop policy if exists time_read on public.time_entries;
create policy time_read on public.time_entries for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists time_admin on public.time_entries;
create policy time_admin on public.time_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Funcionário lança e vê só os próprios gastos (nunca receita)
drop policy if exists exp_read on public.expenses;
create policy exp_read on public.expenses for select to authenticated using (created_by = auth.uid() or public.is_admin());
drop policy if exists exp_insert on public.expenses;
create policy exp_insert on public.expenses for insert to authenticated
  with check (public.is_admin() or (created_by = auth.uid() and kind = 'expense' and company_id = public.my_company()));
drop policy if exists exp_admin on public.expenses;
create policy exp_admin on public.expenses for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- Permissões explícitas (funciona mesmo com "Automatically expose new tables" desligado).
-- Quem protege os dados são as regras RLS acima: sem regra, ninguém vê nada.
grant usage on schema public to authenticated;
grant select on public.companies to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects, public.project_financials, public.project_tasks,
  public.project_files, public.time_entries, public.expenses to authenticated;
revoke all on public.companies, public.profiles, public.projects, public.project_financials, public.project_tasks,
  public.project_files, public.time_entries, public.expenses from anon;

-- ═══════════ FUNÇÕES DO APP ═══════════
-- Bater entrada. p_time só é aceito para ponto feito sem internet (até 24h atrás, nunca no futuro).
create or replace function public.clock_in(p_project_id uuid, p_lat double precision, p_lng double precision, p_photo text, p_time timestamptz default null)
returns public.time_entries language plpgsql security definer set search_path = public as $$
declare me public.profiles; t timestamptz; rec public.time_entries;
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if me.id is null then raise exception 'Usuário inativo.'; end if;
  if exists (select 1 from public.time_entries where user_id = me.id and check_out is null) then
    raise exception 'Você já tem uma entrada aberta. Bata a saída primeiro.';
  end if;
  if p_project_id is not null and not exists (select 1 from public.projects where id = p_project_id and company_id = me.company_id) then
    raise exception 'Obra inválida.';
  end if;
  t := case when p_time is not null and p_time <= now() and p_time > now() - interval '24 hours' then p_time else now() end;
  insert into public.time_entries (user_id, company_id, project_id, check_in, rate, in_lat, in_lng, in_photo)
  values (me.id, me.company_id, p_project_id, t, me.hourly_rate, p_lat, p_lng, p_photo)
  returning * into rec;
  return rec;
end $$;

create or replace function public.clock_out(p_lat double precision, p_lng double precision, p_photo text, p_time timestamptz default null)
returns public.time_entries language plpgsql security definer set search_path = public as $$
declare rec public.time_entries; t timestamptz;
begin
  select * into rec from public.time_entries where user_id = auth.uid() and check_out is null order by check_in desc limit 1;
  if rec.id is null then raise exception 'Nenhuma entrada aberta.'; end if;
  t := case when p_time is not null and p_time <= now() and p_time > rec.check_in then p_time else now() end;
  update public.time_entries set check_out = t, out_lat = p_lat, out_lng = p_lng, out_photo = p_photo
   where id = rec.id returning * into rec;
  return rec;
end $$;

-- Marcar tarefa como feita (funcionário só nas obras da própria empresa)
create or replace function public.set_task_done(p_task_id uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if me.id is null then raise exception 'Usuário inativo.'; end if;
  if not public.is_admin() and not exists (
    select 1 from public.project_tasks t join public.projects p on p.id = t.project_id
     where t.id = p_task_id and p.company_id = me.company_id) then
    raise exception 'Sem permissão.';
  end if;
  update public.project_tasks
     set done = p_done,
         done_by_name = case when p_done then me.full_name else null end,
         done_at = case when p_done then now() else null end
   where id = p_task_id;
end $$;

-- Admin troca a senha de um funcionário
create or replace function public.admin_set_password(p_user_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_admin() then raise exception 'Sem permissão.'; end if;
  if length(p_password) < 6 then raise exception 'A senha precisa ter pelo menos 6 caracteres.'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')) where id = p_user_id;
end $$;

revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.clock_in(uuid, double precision, double precision, text, timestamptz) to authenticated;
grant execute on function public.clock_out(double precision, double precision, text, timestamptz) to authenticated;
grant execute on function public.set_task_done(uuid, boolean) to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;


-- Primeiro acesso: enquanto não existir administrador, o app mostra "Criar administrador".
create or replace function public.needs_setup() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where role = 'admin');
$$;
create or replace function public.claim_first_admin(p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  if exists (select 1 from public.profiles where role = 'admin') then raise exception 'Já existe um administrador.'; end if;
  update public.profiles set role = 'admin', active = true,
         full_name = coalesce(nullif(p_name, ''), full_name)
   where id = auth.uid();
end $$;
grant execute on function public.needs_setup() to anon, authenticated;
grant execute on function public.claim_first_admin(text) to authenticated;

-- ═══════════ ARQUIVOS (Storage) ═══════════
insert into storage.buckets (id, name, public) values
  ('project-files', 'project-files', false),
  ('punch-photos', 'punch-photos', false),
  ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Plantas: admin envia/apaga; funcionário baixa se a obra é da empresa dele (pasta = id do projeto)
drop policy if exists pf_read on storage.objects;
create policy pf_read on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and (public.is_admin() or exists (
    select 1 from public.projects p where p.id::text = (storage.foldername(name))[1] and p.company_id = public.my_company())));
drop policy if exists pf_admin on storage.objects;
create policy pf_admin on storage.objects for all to authenticated
  using (bucket_id = 'project-files' and public.is_admin()) with check (bucket_id = 'project-files' and public.is_admin());

-- Selfies do ponto e recibos: cada funcionário envia na própria pasta; admin vê tudo
drop policy if exists own_upload on storage.objects;
create policy own_upload on storage.objects for insert to authenticated
  with check (bucket_id in ('punch-photos','receipts') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists own_read on storage.objects;
create policy own_read on storage.objects for select to authenticated
  using (bucket_id in ('punch-photos','receipts') and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists admin_media on storage.objects;
create policy admin_media on storage.objects for delete to authenticated
  using (bucket_id in ('punch-photos','receipts') and public.is_admin());

-- ═══════════ PRIMEIRO ADMINISTRADOR ═══════════
-- Não precisa fazer nada aqui: abra o app e use "Primeiro acesso" para criar o administrador.
