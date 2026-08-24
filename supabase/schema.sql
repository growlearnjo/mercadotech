-- ============================================================
-- schema.sql — COPIA DE REFERENCIA, NO ES LA FUENTE DE VERDAD.
-- La fuente de verdad es supabase/migrations/*.sql (aplicadas en
-- orden por 'supabase db reset'). Este archivo se regenera
-- concatenando esas migraciones cada vez que cambian — nunca se
-- edita a mano ni se usa para aplicar cambios a la base de datos.
-- Generado: Fase 2.2 de MercadoTech_sesion2.md.
--
-- Nota (Fase 2.4): los buckets de Storage (product-images, avatars) y sus
-- políticas sobre storage.objects NO están en este archivo — al ser
-- políticas de acceso, no esquema de tablas de dominio, viven en
-- supabase/policies.sql junto con el resto de las políticas RLS.
-- ============================================================

-- ================================================================
-- Fuente: 20260821120000_setup_extensions_and_helpers.sql
-- ================================================================
-- Extensiones necesarias para uuid v4 (gen_random_uuid). Idempotente: en
-- Supabase (local y hosted) pgcrypto ya viene preinstalada en el schema
-- `extensions`; este create extension if not exists es solo para que las
-- migraciones sean reproducibles fuera de ese entorno.
create extension if not exists pgcrypto;

-- Utilidad compartida: mantiene `updated_at` al día en cada UPDATE. La usan
-- products y support_articles (únicas tablas con esa columna).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ================================================================
-- Fuente: 20260821120100_create_profiles.sql
-- ================================================================
-- profiles: 1:1 con auth.users. Mismo UUID como PK y FK, on delete cascade
-- (si se borra el usuario de auth, su perfil desaparece con él).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  avatar_path text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Políticas RLS: Fase 2.3. Sin políticas, esta tabla es inaccesible vía
-- PostgREST hasta entonces (esperado).

-- Trigger handle_new_user: crea el profile automáticamente al registrarse un
-- usuario en auth.users. SECURITY DEFINER porque el rol `authenticated` no
-- tiene permiso para escribir en auth.users ni, en ese instante, en profiles
-- (aún sin políticas); set search_path fijo por seguridad (evita hijacking
-- vía search_path en funciones SECURITY DEFINER).
--
-- Versión vigente: la de la Fase 3.3
-- (20260824194558_handle_new_user_metadata.sql), que lee display_name y role
-- de raw_user_meta_data. El role se filtra con lista blanca buyer|seller
-- porque ese metadato lo controla el cliente; registrarse como admin es
-- imposible por construcción. Es el único punto donde `role` puede fijarse:
-- después, protect_profile_role bloquea que el usuario cambie el suyo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(new.email, '@', 1)
    ),
    case
      when new.raw_user_meta_data->>'role' in ('buyer', 'seller')
        then new.raw_user_meta_data->>'role'
      else 'buyer'
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ================================================================
-- Fuente: 20260821120200_create_categories.sql
-- ================================================================
-- categories: árbol simple de categorías tecnológicas.
--
-- Supuesto: parent_id on delete set null (no lo especifica la spec). Borrar
-- una categoría padre no debe arrastrar sus hijas: quedan huérfanas (root)
-- en vez de perderse, para que un admin las reubique.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  parent_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

-- ================================================================
-- Fuente: 20260821120300_create_products.sql
-- ================================================================
-- products: catálogo publicado por vendedores.
--
-- Supuestos de integridad referencial (no especificados por la spec):
-- * seller_id on delete cascade: al borrar un perfil de vendedor, su catálogo
--   (mutable, no histórico) desaparece con él.
-- * category_id on delete restrict: no se puede borrar una categoría mientras
--   tenga productos activos apuntando a ella (evita huérfanos silenciosos);
--   el admin debe reasignarlos primero.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null,
  description text,
  brand text,
  condition text not null default 'nuevo'
    check (condition in ('nuevo', 'usado', 'reacondicionado')),
  price numeric(12, 2) not null check (price > 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create trigger set_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create index products_seller_id_idx on public.products (seller_id);
create index products_category_id_idx on public.products (category_id);
create index products_is_active_idx on public.products (is_active);

-- ================================================================
-- Fuente: 20260821120400_create_product_images.sql
-- ================================================================
-- product_images: galería ordenable. `position` define el orden; el
-- drag & drop de la sesión 3 actualiza este campo (no hay lógica de negocio
-- aquí, solo la columna que la soporta).
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_path text not null,
  position integer not null default 0
);

alter table public.product_images enable row level security;

create index product_images_product_id_idx on public.product_images (product_id);

-- ================================================================
-- Fuente: 20260821120500_create_cart_items.sql
-- ================================================================
-- cart_items: carrito persistente por usuario.
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  -- Un ítem por (usuario, producto): agregar el mismo producto de nuevo
  -- suma cantidad en vez de crear una fila duplicada.
  unique (user_id, product_id)
);

alter table public.cart_items enable row level security;

create index cart_items_user_id_idx on public.cart_items (user_id);

-- ================================================================
-- Fuente: 20260821120600_create_orders.sql
-- ================================================================
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

-- ================================================================
-- Fuente: 20260821120700_create_order_items.sql
-- ================================================================
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

-- ================================================================
-- Fuente: 20260821120800_create_questions.sql
-- ================================================================
-- questions: preguntas y respuestas estilo Mercado Libre. `answer` y
-- `answered_at` quedan null hasta que el vendedor responde.
--
-- Supuesto: user_id on delete cascade — a diferencia de orders, una
-- pregunta no es un registro financiero; puede desaparecer con el perfil.
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

create index questions_product_id_idx on public.questions (product_id);

-- ================================================================
-- Fuente: 20260821120900_create_reviews.sql
-- ================================================================
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

-- ================================================================
-- Fuente: 20260821121000_create_favorites.sql
-- ================================================================
-- favorites: lista de deseos por usuario.
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Un like/favorito único por (usuario, producto): evita duplicados por
  -- doble clic y simplifica el toggle en el frontend.
  unique (user_id, product_id)
);

alter table public.favorites enable row level security;

create index favorites_user_id_idx on public.favorites (user_id);

-- ================================================================
-- Fuente: 20260821121100_create_product_views.sql
-- ================================================================
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

-- ================================================================
-- Fuente: 20260821121200_create_support_articles.sql
-- ================================================================
-- support_articles: base de conocimiento (FAQ), fuente del RAG de soporte
-- (sesión 4).
--
-- Supuesto: `category` queda como texto libre sin check — la spec da
-- ejemplos ('envíos', 'pagos', 'devoluciones', 'cuenta') pero los marca como
-- "ej.", no como enum cerrado.
create table public.support_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_articles enable row level security;

create trigger set_support_articles_updated_at
  before update on public.support_articles
  for each row execute function public.set_updated_at();

-- ================================================================
-- Fuente: 20260821121300_create_support_tickets.sql
-- ================================================================
-- support_tickets: tickets de soporte (los usa el agente de voz, sesión 8).
--
-- Supuesto: user_id on delete cascade — igual criterio que questions.
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  status text not null default 'abierto'
    check (status in ('abierto', 'en_proceso', 'resuelto', 'cerrado')),
  channel text not null default 'chat' check (channel in ('chat', 'voz')),
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

create index support_tickets_user_id_idx on public.support_tickets (user_id);

-- ================================================================
-- Fuente: 20260821121400_create_ticket_messages.sql
-- ================================================================
-- ticket_messages: mensajes de un ticket. sender_role distingue quién
-- escribió cada mensaje (usuario, agente de IA/voz, o un humano que escaló).
create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_role text not null check (sender_role in ('usuario', 'agente', 'humano')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.ticket_messages enable row level security;

create index ticket_messages_ticket_id_idx on public.ticket_messages (ticket_id);

-- ================================================================
-- Fuente: 20260821121500_create_checkout_function.sql
-- ================================================================
-- create_order_from_cart: única vía para crear un pedido (el INSERT directo
-- del cliente en orders/order_items queda bloqueado por RLS en la Fase 2.3).
-- Corre como una única transacción implícita (el cuerpo de una función
-- plpgsql se ejecuta atómicamente dentro de la llamada):
--   1. Falla si el carrito está vacío.
--   2. Bloquea (`for update of p`) las filas de products involucradas para
--      serializar checkouts concurrentes sobre el mismo stock.
--   3. Falla con mensaje claro si algún producto está inactivo o sin stock.
--   4. Crea el order ('pendiente') y los order_items con snapshots.
--   5. Descuenta stock y vacía el carrito.
--
-- SECURITY DEFINER: corre con los privilegios del owner (postgres), que es
-- dueño de las tablas y por tanto bypasea RLS — es el mecanismo intencional
-- para que esta función pueda escribir en orders/order_items aunque el rol
-- authenticated no tenga INSERT directo sobre esas tablas.
-- set search_path fijo por seguridad (evita hijacking vía search_path).
create or replace function public.create_order_from_cart(p_buyer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total numeric(12, 2) := 0;
  v_item record;
  v_has_items boolean := false;
begin
  if p_buyer_id is distinct from auth.uid() then
    raise exception 'No autorizado: p_buyer_id no coincide con el usuario autenticado';
  end if;

  if not exists (select 1 from public.cart_items where user_id = p_buyer_id) then
    raise exception 'El carrito está vacío';
  end if;

  for v_item in
    select ci.product_id, ci.quantity, p.title, p.price, p.stock, p.is_active
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.user_id = p_buyer_id
    for update of p
  loop
    v_has_items := true;

    if not v_item.is_active then
      raise exception 'El producto "%" ya no está disponible', v_item.title;
    end if;

    if v_item.stock < v_item.quantity then
      raise exception 'Stock insuficiente para "%": disponible %, solicitado %',
        v_item.title, v_item.stock, v_item.quantity;
    end if;

    v_total := v_total + (v_item.price * v_item.quantity);
  end loop;

  -- Defensivo: cart_items no vacío pero el join no produjo filas (ej.
  -- producto ya borrado) — no debería ocurrir por las FKs, pero evita un
  -- pedido con total 0 y sin order_items si sucediera.
  if not v_has_items then
    raise exception 'El carrito está vacío';
  end if;

  insert into public.orders (buyer_id, status, total)
  values (p_buyer_id, 'pendiente', v_total)
  returning id into v_order_id;

  insert into public.order_items
    (order_id, product_id, seller_id, title_snapshot, price_snapshot, quantity)
  select v_order_id, p.id, p.seller_id, p.title, p.price, ci.quantity
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.user_id = p_buyer_id;

  update public.products p
  set stock = p.stock - ci.quantity
  from public.cart_items ci
  where ci.user_id = p_buyer_id
    and ci.product_id = p.id;

  delete from public.cart_items where user_id = p_buyer_id;

  return v_order_id;
end;
$$;

revoke execute on function public.create_order_from_cart(uuid) from public;
revoke execute on function public.create_order_from_cart(uuid) from anon;
grant execute on function public.create_order_from_cart(uuid) to authenticated;

