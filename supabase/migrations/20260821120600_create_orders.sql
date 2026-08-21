-- orders: pedidos del comprador.
--
-- Supuesto: buyer_id on delete restrict — un pedido es un registro
-- histórico/financiero; no debe poder borrarse un perfil mientras tenga
-- pedidos asociados (a diferencia del resto de relaciones de catálogo).
-- Supuesto: check (total >= 0) como red de seguridad mínima; el valor real
-- lo calcula siempre create_order_from_cart (Fase 2.2, más abajo).
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado')),
  total numeric(12, 2) not null check (total >= 0),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create index orders_buyer_id_idx on public.orders (buyer_id);
