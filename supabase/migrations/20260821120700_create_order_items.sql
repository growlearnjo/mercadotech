-- order_items: snapshot de título y precio en el momento de la compra — si
-- el vendedor edita el producto después, el pedido histórico no cambia.
-- seller_id queda denormalizado (no derivable solo de product_id sin un
-- join) para que las políticas RLS del vendedor (Fase 2.3) no necesiten
-- resolverlo en caliente contra products.
--
-- Supuesto: product_id y seller_id on delete restrict — mismo criterio que
-- orders.buyer_id: preservar el historial de pedidos íntegro.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  seller_id uuid not null references public.profiles (id) on delete restrict,
  title_snapshot text not null,
  price_snapshot numeric(12, 2) not null check (price_snapshot > 0),
  quantity integer not null check (quantity > 0)
);

alter table public.order_items enable row level security;

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_seller_id_idx on public.order_items (seller_id);
