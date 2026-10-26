-- ═══════════════════════════════════════════════════════════════════
-- Atualização 003 — Notas, Avisos, limites de material/mão de obra,
-- e-mail do cliente (relatório diário), proposta por e-mail, promoções.
-- Seguro rodar de novo.
-- ═══════════════════════════════════════════════════════════════════

-- Limites e contato do cliente (só administrador lê: tabela já é admin-only)
alter table public.project_financials
  add column if not exists material_budget numeric(12,2) not null default 0,
  add column if not exists labor_budget    numeric(12,2) not null default 0,
  add column if not exists client_email    text,
  add column if not exists client_phone    text,
  add column if not exists daily_report    boolean not null default true,
  add column if not exists last_report_at  timestamptz;

-- Notas: o que a IA leu da foto
alter table public.expenses add column if not exists ai jsonb;

-- Avisos da obra (funcionários reportam; administrador recebe)
create table if not exists public.notices (
  id          uuid primary key default gen_random_uuid(),
  company_id  text not null references public.companies(id),
  project_id  uuid references public.projects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id),
  author_name text,
  text        text not null,
  photo_path  text,
  resolved    boolean not null default false,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notices_company on public.notices(company_id, created_at desc);
alter table public.notices enable row level security;
drop policy if exists notices_read on public.notices;
create policy notices_read on public.notices for select to authenticated
  using (public.is_admin() or company_id = public.my_company());
drop policy if exists notices_insert on public.notices;
create policy notices_insert on public.notices for insert to authenticated
  with check (public.is_admin() or (user_id = auth.uid() and company_id = public.my_company()));
drop policy if exists notices_admin on public.notices;
create policy notices_admin on public.notices for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.notices to authenticated;
revoke all on public.notices from anon;

-- Fotos dos avisos: mesma regra dos recibos (cada um na própria pasta; admin vê tudo)
insert into storage.buckets (id, name, public) values ('notice-photos', 'notice-photos', false) on conflict (id) do nothing;
drop policy if exists own_upload on storage.objects;
create policy own_upload on storage.objects for insert to authenticated
  with check (bucket_id in ('punch-photos','receipts','notice-photos') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists own_read on storage.objects;
create policy own_read on storage.objects for select to authenticated
  using (bucket_id in ('punch-photos','receipts','notice-photos') and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists admin_media on storage.objects;
create policy admin_media on storage.objects for delete to authenticated
  using (bucket_id in ('punch-photos','receipts','notice-photos') and public.is_admin());

-- Promoções com foto (buscadas automaticamente)
alter table public.deals
  add column if not exists image_url  text,
  add column if not exists was_price  numeric(12,2),
  add column if not exists source     text not null default 'manual',
  add column if not exists fetched_at timestamptz;

-- Proposta: link público para o cliente ver e aceitar
alter table public.proposals
  add column if not exists public_token uuid not null default gen_random_uuid(),
  add column if not exists sent_at      timestamptz,
  add column if not exists accepted_at  timestamptz;
create unique index if not exists proposals_token on public.proposals(public_token);

-- Configurações internas (só o servidor lê; nenhuma regra = ninguém do app acessa)
create table if not exists public.app_config (key text primary key, value text not null);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
insert into public.app_config (key, value) values
  ('cron_secret', encode(gen_random_bytes(24), 'hex')),
  ('admin_email', 'office@eternityelectrical.com'),
  ('from_email', 'Eternity Electric <office@eternityelectrical.com>'),
  ('app_url', 'https://eternity-electric.netlify.app')
on conflict (key) do nothing;

-- Tarefas agendadas (horário UTC)
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.call_servicos(p_action text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://zvjirpqmyjhawtteainq.supabase.co/functions/v1/servicos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2amlycHFteWpoYXd0dGVhaW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1NDAzNTYsImV4cCI6MjEwODExNjM1Nn0.SN8nci_MAk9EEYJT7UEWOkEROQkjqGamizl7kbrhJAA',
      'x-cron-secret', (select value from public.app_config where key = 'cron_secret')),
    body := jsonb_build_object('action', p_action),
    timeout_milliseconds := 120000);
end $$;
revoke all on function public.call_servicos(text) from public, anon, authenticated;

select cron.unschedule(jobname) from cron.job where jobname in ('relatorio-diario', 'folha-semanal', 'promocoes');
select cron.schedule('relatorio-diario', '0 22 * * *', $$select public.call_servicos('dailyReports')$$);   -- 6 PM (verão) / 5 PM (inverno) em Boston
select cron.schedule('folha-semanal',    '0 1 * * 0', $$select public.call_servicos('weeklyPayroll')$$);   -- sábado ~9 PM em Boston
select cron.schedule('promocoes',        '30 11 * * *', $$select public.call_servicos('fetchDeals')$$);    -- 7:30 AM em Boston
