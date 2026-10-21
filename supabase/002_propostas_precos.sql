-- ═══════════════════════════════════════════════════════════════════
-- Atualização 002 — Propostas e Preços de material
-- Rode uma vez no SQL Editor (seguro rodar de novo). Só administrador acessa.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.proposals (
  id          uuid primary key default gen_random_uuid(),
  company_id  text not null references public.companies(id),
  number      text,
  status      text not null default 'Rascunho',
  total       numeric(12,2) not null default 0,
  data        jsonb not null default '{}'::jsonb,   -- cliente, escopo, itens, pagamento, materiais...
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists proposals_company on public.proposals(company_id, updated_at desc);

create table if not exists public.materials (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text,
  unit        text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.material_prices (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  store       text not null,
  price       numeric(12,2) not null check (price >= 0),
  date        date not null default current_date,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists material_prices_mat on public.material_prices(material_id, store, date desc);

create table if not exists public.deals (
  id          uuid primary key default gen_random_uuid(),
  store       text not null,
  title       text not null,
  price       numeric(12,2),
  valid_until date,
  url         text,
  note        text,
  created_at  timestamptz not null default now()
);

alter table public.proposals       enable row level security;
alter table public.materials       enable row level security;
alter table public.material_prices enable row level security;
alter table public.deals           enable row level security;

drop policy if exists proposals_admin on public.proposals;
create policy proposals_admin on public.proposals for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists materials_admin on public.materials;
create policy materials_admin on public.materials for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists material_prices_admin on public.material_prices;
create policy material_prices_admin on public.material_prices for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists deals_admin on public.deals;
create policy deals_admin on public.deals for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.proposals, public.materials, public.material_prices, public.deals to authenticated;
revoke all on public.proposals, public.materials, public.material_prices, public.deals from anon;
