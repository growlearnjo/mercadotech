-- product_views: cada apertura de un producto es un evento (sin contador
-- agregado). Solo authenticated puede insertar (política Fase 2.3), por eso
-- user_id es not null.
--
-- Supuesto: user_id on delete cascade — dato de analítica, no crítico.
create table public.product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now()
);

alter table public.product_views enable row level security;

create index product_views_product_id_idx on public.product_views (product_id);
