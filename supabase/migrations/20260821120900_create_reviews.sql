-- reviews: reseñas verificadas — la política RLS de INSERT (Fase 2.3) exige
-- que order_id apunte a un pedido 'entregado' del propio comprador que
-- contenga product_id; aquí solo se garantiza la integridad referencial.
--
-- Supuesto: buyer_id on delete cascade (igual criterio que questions);
-- order_id on delete cascade — si el pedido que la verifica desaparece, la
-- reseña pierde su fundamento y debe desaparecer con él.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  -- Una reseña por comprador y producto.
  unique (product_id, buyer_id)
);

alter table public.reviews enable row level security;

create index reviews_product_id_idx on public.reviews (product_id);
