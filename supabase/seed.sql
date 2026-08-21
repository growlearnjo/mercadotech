-- ============================================================
-- seed.sql — Datos de prueba (Fase 2.5)
-- ============================================================
-- Se ejecuta automáticamente después de las migraciones en
-- `supabase db reset`. Alimenta las pantallas de la sesión 3, el RAG de la
-- sesión 4 (los 10 artículos de FAQ se vectorizan tal cual) y los E2E de la
-- sesión 6 (estos 6 usuarios son los usuarios de prueba).
--
-- Contraseña de laboratorio para los 6 usuarios: MercadoTech123!
-- Se guarda con `extensions.crypt(..., extensions.gen_salt('bf'))` (pgcrypto,
-- ya habilitado en la Fase 2.2) — un hash bcrypt real que GoTrue acepta, no
-- un placeholder: los 6 usuarios pueden iniciar sesión de verdad desde la
-- sesión 3 en adelante. Calificado con el schema `extensions` porque en
-- Supabase hosted pgcrypto se instala ahí (no en `public` como a veces
-- ocurre en el stack local), y el search_path de la sesión de seed no lo
-- incluye por defecto.
--
-- Convención de UUIDs fijos por prefijo (para poder referenciarlos en tests
-- futuros sin tener que consultarlos primero). Solo se fija el id de las
-- tablas que lo necesitan (referenciadas por otra fila o útiles de citar
-- directamente); el resto usa el default gen_random_uuid(). El prefijo debe
-- ser un dígito hexadecimal válido (0-9, a-f) — 'g'..'z' no son UUID válido:
--   a0000000-... usuarios/profiles     6xxxxxxx-... questions
--   b0000000-... products              7xxxxxxx-... support_articles
--   c0000000-... orders                8xxxxxxx-... support_tickets
--   d0000000-... categories
--
-- GAP CONOCIDO (documentado a propósito, no es un olvido): los `image_path`
-- de product_images apuntan a rutas con la convención correcta del bucket
-- (`{seller_id}/{product_id}/{n}.jpg`), pero esos archivos NO existen todavía
-- en Storage — nadie los subió por la UI (eso es trabajo de la sesión 3).
-- Cualquier <img> que intente renderizarlos dará 404 hasta entonces.

-- ============================================================
-- 1. USUARIOS (auth.users + auth.identities; profiles vía trigger)
-- ============================================================
-- insert en auth.users dispara handle_new_user (Fase 2.2), que crea la fila
-- en public.profiles con role='buyer' y display_name = prefijo del email.
-- Después ajustamos role/display_name/phone según corresponda (el trigger
-- protect_profile_role, Fase 2.3, no bloquea esto: no hay JWT en este
-- contexto de seed, así que su chequeo se salta a propósito).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'buyer1@mercadotech.test',
   extensions.crypt('MercadoTech123!', extensions.gen_salt('bf')), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"María Fernanda Quispe"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'buyer2@mercadotech.test',
   extensions.crypt('MercadoTech123!', extensions.gen_salt('bf')), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Jorge Luis Ramírez"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'buyer3@mercadotech.test',
   extensions.crypt('MercadoTech123!', extensions.gen_salt('bf')), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Ana Lucía Torres"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'seller1@mercadotech.test',
   extensions.crypt('MercadoTech123!', extensions.gen_salt('bf')), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"TecnoStore Perú"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005',
   'authenticated', 'authenticated', 'seller2@mercadotech.test',
   extensions.crypt('MercadoTech123!', extensions.gen_salt('bf')), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"GamerZone Lima"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000006',
   'authenticated', 'authenticated', 'admin@mercadotech.test',
   extensions.crypt('MercadoTech123!', extensions.gen_salt('bf')), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Soporte MercadoTech"}',
   now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id,
       jsonb_build_object('sub', id::text, 'email', email),
       'email', id::text, now(), now(), now()
from auth.users
where id in (
  'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006'
);

update public.profiles set display_name = 'María Fernanda Quispe', phone = '+51 987 111 001'
  where id = 'a0000000-0000-0000-0000-000000000001';
update public.profiles set display_name = 'Jorge Luis Ramírez', phone = '+51 987 111 002'
  where id = 'a0000000-0000-0000-0000-000000000002';
update public.profiles set display_name = 'Ana Lucía Torres', phone = '+51 987 111 003'
  where id = 'a0000000-0000-0000-0000-000000000003';
update public.profiles set display_name = 'TecnoStore Perú', role = 'seller', phone = '+51 987 222 001'
  where id = 'a0000000-0000-0000-0000-000000000004';
update public.profiles set display_name = 'GamerZone Lima', role = 'seller', phone = '+51 987 222 002'
  where id = 'a0000000-0000-0000-0000-000000000005';
update public.profiles set display_name = 'Soporte MercadoTech', role = 'admin', phone = '+51 987 333 001'
  where id = 'a0000000-0000-0000-0000-000000000006';

-- ============================================================
-- 2. CATEGORÍAS (8, tecnológicas)
-- ============================================================
insert into public.categories (id, name, slug) values
  ('d0000000-0000-0000-0000-000000000001', 'Laptops', 'laptops'),
  ('d0000000-0000-0000-0000-000000000002', 'Smartphones', 'smartphones'),
  ('d0000000-0000-0000-0000-000000000003', 'Componentes de PC', 'componentes-pc'),
  ('d0000000-0000-0000-0000-000000000004', 'Audio', 'audio'),
  ('d0000000-0000-0000-0000-000000000005', 'Gaming', 'gaming'),
  ('d0000000-0000-0000-0000-000000000006', 'Monitores', 'monitores'),
  ('d0000000-0000-0000-0000-000000000007', 'Accesorios', 'accesorios'),
  ('d0000000-0000-0000-0000-000000000008', 'Redes', 'redes');

-- ============================================================
-- 3. PRODUCTOS (16: 8 de TecnoStore Perú, 8 de GamerZone Lima)
-- ============================================================
-- b0000000-...08 y ...16 quedan inactivos; b0000000-...06 queda con stock 0
-- pero activo (para poder verse en el catálogo y probar que el checkout
-- rechaza la compra por falta de stock).
insert into public.products (id, seller_id, category_id, title, description, brand, condition, price, stock, is_active) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001',
   'Laptop Lenovo IdeaPad Slim 3 15.6" Ryzen 5 16GB 512GB SSD',
   'Ideal para estudios y teletrabajo: pantalla Full HD antirreflejo, batería de todo el día y arranque rápido con SSD NVMe.',
   'Lenovo', 'nuevo', 2199.00, 8, true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001',
   'Laptop ASUS Vivobook 15 Intel Core i5 8GB 512GB SSD',
   'Delgada y liviana, con teclado numérico completo. Perfecta para oficina y navegación diaria.',
   'ASUS', 'nuevo', 1899.00, 5, true),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003',
   'Memoria RAM Kingston Fury Beast 16GB DDR4 3200MHz',
   'Disipador de aluminio, compatible con la mayoría de placas AMD e Intel de la última generación.',
   'Kingston', 'nuevo', 219.00, 25, true),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003',
   'SSD NVMe Western Digital Blue SN580 1TB',
   'Velocidades de lectura de hasta 4150 MB/s. La forma más simple de acelerar cualquier PC o laptop.',
   'Western Digital', 'nuevo', 289.00, 15, true),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000006',
   'Monitor LG 24" Full HD IPS 75Hz',
   'Panel IPS con buenos ángulos de visión y colores fieles, ideal para oficina y uso multimedia.',
   'LG', 'nuevo', 549.00, 10, true),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000006',
   'Monitor Samsung Odyssey 27" Curvo 144Hz Gaming',
   'Curvatura 1000R y tiempo de respuesta de 1ms para gaming competitivo. Compatible con AMD FreeSync.',
   'Samsung', 'nuevo', 999.00, 0, true),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000008',
   'Router TP-Link Archer C6 AC1200 Dual Band',
   'Cobertura estable para toda la casa, 4 antenas externas y gestión sencilla desde la app Tether.',
   'TP-Link', 'nuevo', 149.00, 20, true),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001',
   'Laptop HP Pavilion 14" Core i3 8GB 256GB (Reacondicionada)',
   'Equipo reacondicionado, revisado y con garantía de 6 meses. Excelente para tareas básicas.',
   'HP', 'reacondicionado', 1299.00, 4, false),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002',
   'Smartphone Samsung Galaxy A54 5G 128GB',
   'Pantalla Super AMOLED de 120Hz, cámara principal de 50MP y protección IP67 contra polvo y agua.',
   'Samsung', 'nuevo', 1399.00, 12, true),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002',
   'Smartphone Xiaomi Redmi Note 13 Pro 256GB',
   'Cámara de 200MP con estabilización óptica y carga rápida de 67W incluida en la caja.',
   'Xiaomi', 'nuevo', 1099.00, 18, true),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000004',
   'Audífonos Logitech G435 Gaming Inalámbricos',
   'Ligeros (167g), con Bluetooth y dongle 2.4GHz simultáneos. Hasta 18 horas de batería.',
   'Logitech', 'nuevo', 249.00, 30, true),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000004',
   'Parlante JBL Flip 6 Bluetooth',
   'Resistente al agua (IP67), sonido potente y hasta 12 horas de reproducción continua.',
   'JBL', 'nuevo', 449.00, 14, true),
  ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005',
   'Teclado Mecánico Logitech G413 SE',
   'Switches táctiles, estructura de aluminio resistente y retroiluminación blanca uniforme.',
   'Logitech', 'nuevo', 329.00, 20, true),
  ('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005',
   'Mouse Gamer Razer DeathAdder V3',
   'Forma ergonómica icónica, sensor óptico de 30000 DPI y switches ópticos de alta durabilidad.',
   'Razer', 'nuevo', 259.00, 22, true),
  ('b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000007',
   'Mochila para Laptop Targus 15.6"',
   'Compartimento acolchado, resistente al agua y con bolsillo organizador para accesorios.',
   'Targus', 'nuevo', 129.00, 40, true),
  ('b0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002',
   'Smartphone Samsung Galaxy S21 128GB (Usado)',
   'Equipo usado en buen estado, batería verificada sobre 85% de salud. Incluye cargador.',
   'Samsung', 'usado', 1599.00, 6, false);

-- ============================================================
-- 4. PRODUCT_IMAGES (2-3 por producto; paths con la convención del bucket)
-- ============================================================
insert into public.product_images (product_id, image_path, position) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000001/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000001/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000001/3.jpg', 2),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000002/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000002/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000003/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000003/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000004/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000004/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000005/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000005/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000006/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000006/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000006/3.jpg', 2),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000007/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000007/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000008/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000008/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000009/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000009/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000009/3.jpg', 2),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000010/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000010/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000011/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000011/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000012/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000012/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000013/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000013/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000014/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000014/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000015/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000015/2.jpg', 1),
  ('b0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000016/1.jpg', 0),
  ('b0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000016/2.jpg', 1);

-- ============================================================
-- 5. PEDIDOS + ORDER_ITEMS (1+ por cada uno de los 5 estados)
-- ============================================================
-- c0000000-...01 y ...06 quedan 'entregado' (para poder tener reseñas
-- verificadas sobre ellos). c0000000-...04 es multi-vendedor a propósito
-- (un ítem de cada seller), para poder probar que cada vendedor solo ve SUS
-- ítems dentro de un mismo pedido compartido.
insert into public.orders (id, buyer_id, status, total, created_at) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'entregado', 2418.00, now() - interval '20 days'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'pendiente', 298.00, now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'pagado', 1399.00, now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'enviado', 798.00, now() - interval '5 days'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'cancelado', 1099.00, now() - interval '10 days'),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'entregado', 588.00, now() - interval '15 days');

insert into public.order_items (order_id, product_id, seller_id, title_snapshot, price_snapshot, quantity) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004',
   'Laptop Lenovo IdeaPad Slim 3 15.6" Ryzen 5 16GB 512GB SSD', 2199.00, 1),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004',
   'Memoria RAM Kingston Fury Beast 16GB DDR4 3200MHz', 219.00, 1),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000004',
   'Router TP-Link Archer C6 AC1200 Dual Band', 149.00, 2),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000005',
   'Smartphone Samsung Galaxy A54 5G 128GB', 1399.00, 1),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000005',
   'Audífonos Logitech G435 Gaming Inalámbricos', 249.00, 1),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004',
   'Monitor LG 24" Full HD IPS 75Hz', 549.00, 1),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000005',
   'Smartphone Xiaomi Redmi Note 13 Pro 256GB', 1099.00, 1),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000005',
   'Teclado Mecánico Logitech G413 SE', 329.00, 1),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000005',
   'Mouse Gamer Razer DeathAdder V3', 259.00, 1);

-- ============================================================
-- 6. PREGUNTAS (8: 4 respondidas, 4 sin responder)
-- ============================================================
insert into public.questions (id, product_id, user_id, question, answer, answered_at, created_at) values
  ('60000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   '¿La laptop viene con Windows instalado o hay que comprarlo aparte?',
   'Viene con Windows 11 Home preinstalado y activado, sin costo adicional.', now() - interval '4 days', now() - interval '5 days'),
  ('60000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003',
   '¿Se le puede ampliar la RAM más adelante?',
   'Sí, tiene un slot adicional libre; soporta hasta 24GB en total (16GB soldados + 8GB en el slot).', now() - interval '2 days', now() - interval '3 days'),
  ('60000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001',
   '¿Es liberado para cualquier operador?',
   'Sí, todos nuestros equipos se venden liberados de fábrica.', now() - interval '6 days', now() - interval '7 days'),
  ('60000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002',
   '¿Cuándo vuelve a haber stock de este monitor?',
   'Estimamos reposición en 1-2 semanas; puedes dejarnos tu correo para avisarte.', now() - interval '1 day', now() - interval '2 days'),
  ('60000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003',
   '¿El teclado tiene retroiluminación?', null, null, now() - interval '1 day'),
  ('60000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002',
   '¿Cuánto dura la batería con uso normal, no solo en gaming?', null, null, now() - interval '2 days'),
  ('60000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   '¿Este SSD es compatible con laptops o solo con PC de escritorio?', null, null, now() - interval '3 hours'),
  ('60000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000003',
   '¿Tiene alguna marca de uso visible en la pantalla?', null, null, now() - interval '6 hours');

-- ============================================================
-- 7. RESEÑAS (solo sobre pedidos 'entregado': c...01 y c...06)
-- ============================================================
insert into public.reviews (product_id, buyer_id, order_id, rating, comment, created_at) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   5, 'Excelente para el teletrabajo, silenciosa y rápida. Llegó bien empacada y antes de lo esperado.', now() - interval '18 days'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   4, 'Cumple lo que promete, instalación sencilla. Le bajo un punto porque el empaque venía algo golpeado.', now() - interval '18 days'),
  ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006',
   5, 'Se siente muy sólido y las teclas responden increíble para escribir y jugar.', now() - interval '13 days'),
  ('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006',
   4, 'Buen mouse, cómodo para manos medianas. El sensor es muy preciso.', now() - interval '13 days');

-- ============================================================
-- 8. FAVORITOS Y PRODUCT_VIEWS (muestra)
-- ============================================================
insert into public.favorites (user_id, product_id) values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000009'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000011'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000006'),
  ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002');

insert into public.product_views (product_id, user_id, viewed_at) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', now() - interval '6 days'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', now() - interval '4 days'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now() - interval '19 days'),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', now() - interval '8 days'),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', now() - interval '5 days'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', now() - interval '1 days');

-- ============================================================
-- 9. ARTÍCULOS DE SOPORTE / FAQ (10, contenido real — base del RAG, sesión 4)
-- ============================================================
insert into public.support_articles (id, title, content, category, is_published) values
  ('70000000-0000-0000-0000-000000000001', '¿Cuánto demora el envío de mi pedido?',
   'Los tiempos de entrega dependen de tu distrito y del vendedor. En Lima Metropolitana, la mayoría de pedidos llegan entre 2 y 4 días hábiles después de que el vendedor los despacha. Para provincias, el rango habitual es de 4 a 8 días hábiles, dependiendo del operador logístico y la zona.

Puedes ver el estado de tu pedido en todo momento desde la sección "Mis pedidos": los estados posibles son pendiente, pagado, enviado y entregado. Cuando el vendedor marca un pedido como "enviado", normalmente ya cuenta con un código de seguimiento que también aparece ahí.

Si tu pedido lleva más de 10 días hábiles en estado "pagado" sin pasar a "enviado", te recomendamos contactar directamente al vendedor desde la sección de preguntas del producto, o abrir un ticket de soporte para que un agente revise el caso.',
   'envíos', true),
  ('70000000-0000-0000-0000-000000000002', '¿Los envíos a provincia tienen costo adicional?',
   'El costo de envío varía según el vendedor, el peso/tamaño del producto y el destino. Algunos vendedores ofrecen envío gratuito para compras sobre cierto monto; esa información, cuando aplica, se muestra en la página del producto antes de agregarlo al carrito.

Para provincias alejadas de la costa (selva y zonas altoandinas), es común que el costo sea algo mayor debido a la logística adicional que requieren los operadores de transporte.

Si tienes dudas sobre el costo de envío a tu ciudad para un producto específico, puedes preguntarle directamente al vendedor usando la sección de preguntas y respuestas de ese producto, antes de comprar.',
   'envíos', true),
  ('70000000-0000-0000-0000-000000000003', '¿Puedo cambiar la dirección de entrega después de comprar?',
   'Si tu pedido todavía está en estado "pendiente" o "pagado" (aún no ha sido despachado), puedes solicitar el cambio de dirección contactando directamente al vendedor a través de la sección de preguntas del producto o abriendo un ticket de soporte.

Una vez que el pedido pasa a estado "enviado", ya no es posible modificar la dirección, porque el paquete ya fue entregado al operador logístico con los datos originales.

Recomendamos siempre verificar tu dirección de entrega, referencia y número de contacto antes de confirmar la compra, para evitar contratiempos en la entrega.',
   'envíos', true),
  ('70000000-0000-0000-0000-000000000004', '¿Qué métodos de pago están disponibles?',
   'MercadoTech es una plataforma de demostración: el checkout simula el proceso de compra (crea el pedido y descuenta el stock) pero no procesa cobros reales ni solicita datos de tarjetas. Ningún pedido genera un cargo verdadero.

En una plataforma real, esta sección explicaría los métodos disponibles (tarjetas de crédito/débito, billeteras digitales, pago contra entrega, etc.) y sus tiempos de acreditación. Aquí, el estado "pagado" de un pedido representa ese paso simulado dentro del flujo de compra.

Si tienes dudas sobre por qué tu pedido aparece en un estado distinto al esperado, revisa la sección "Mis pedidos" o contacta a soporte.',
   'pagos', true),
  ('70000000-0000-0000-0000-000000000005', '¿Por qué mi pedido sigue en estado "pendiente"?',
   'Un pedido queda en estado "pendiente" apenas se crea, antes de que se registre el pago (simulado en esta plataforma). Es el primer paso del flujo y es completamente normal que permanezca así por un tiempo breve.

Si notas que un pedido lleva varias horas en "pendiente" sin avanzar a "pagado", puede deberse a una demora del vendedor en procesarlo. Te recomendamos revisar nuevamente en un rato o contactar al vendedor.

Ningún monto se cobra realmente en esta plataforma: el estado "pendiente" no implica ningún cargo pendiente de tu parte.',
   'pagos', true),
  ('70000000-0000-0000-0000-000000000006', '¿Cómo sé si un cobro fue correcto?',
   'Como se explica en el artículo sobre métodos de pago, MercadoTech no realiza cobros reales: es un entorno de práctica y demostración. El estado "pagado" de un pedido es una simulación del flujo de checkout, no un cargo efectivo a ningún medio de pago.

En una plataforma real, aquí encontrarías instrucciones para verificar un cobro: revisar el comprobante enviado por correo, contrastar el monto con el resumen de tu pedido, y qué hacer ante un cobro duplicado o incorrecto.

Si algo en el monto total de tu pedido no coincide con lo esperado (por ejemplo, precio o cantidad), contáctanos mediante un ticket de soporte con el número de pedido.',
   'pagos', true),
  ('70000000-0000-0000-0000-000000000007', '¿Cómo solicito la devolución de un producto?',
   'Puedes solicitar la devolución de un producto dentro de los 7 días calendario posteriores a que el pedido pase a estado "entregado". Para iniciarla, abre un ticket de soporte indicando el número de pedido, el producto y el motivo de la devolución.

Los productos deben devolverse en las mismas condiciones en que fueron recibidos: sin señales de uso excesivo, con su empaque original y accesorios completos, salvo que la devolución se deba a un defecto de fábrica.

Una vez que el vendedor confirma la recepción y buen estado del producto devuelto, se coordina el reembolso o cambio según corresponda. Los tiempos de respuesta del vendedor pueden variar, pero soporte hace seguimiento si no hay respuesta en 48 horas.',
   'devoluciones', true),
  ('70000000-0000-0000-0000-000000000008', '¿Qué pasa si el producto llega dañado o incompleto?',
   'Si tu producto llega con daños visibles, defectos de fábrica o le falta algún accesorio indicado en la publicación, debes reportarlo cuanto antes abriendo un ticket de soporte con fotos del producto y del empaque recibido.

Este tipo de casos tiene prioridad sobre una devolución por simple arrepentimiento: el vendedor es responsable de resolverlo mediante cambio, reposición del accesorio faltante o reembolso, sin costo adicional para ti.

Te recomendamos revisar el pedido apenas lo recibes, antes de deshacerte del empaque, ya que puede ser solicitado como parte del proceso de reclamo.',
   'devoluciones', true),
  ('70000000-0000-0000-0000-000000000009', '¿Cómo actualizo mis datos de cuenta?',
   'Puedes actualizar tu nombre visible, teléfono y foto de perfil desde la sección de tu cuenta una vez que hayas iniciado sesión. Los cambios se guardan de inmediato y se reflejan en tus futuras preguntas, reseñas y pedidos.

El correo electrónico con el que te registraste identifica tu cuenta y no se puede editar libremente por motivos de seguridad; si necesitas cambiarlo, debes contactar a soporte mediante un ticket.

Tu rol dentro de la plataforma (comprador, vendedor o administrador) tampoco puede modificarlo el propio usuario: solo el equipo de MercadoTech puede otorgar o cambiar el rol de vendedor.',
   'cuenta', true),
  ('70000000-0000-0000-0000-000000000010', '¿Cómo me convierto en vendedor dentro de MercadoTech?',
   'Para operar como vendedor necesitas que tu cuenta tenga el rol "seller" habilitado. Esto no lo puede activar el propio usuario desde su perfil: es una validación que realiza el equipo de MercadoTech para mantener la calidad del catálogo.

Una vez habilitado como vendedor, podrás publicar productos con su galería de imágenes, gestionar tu stock y precios, responder preguntas de compradores sobre tus productos y hacer seguimiento a tus pedidos desde tu panel de vendedor.

Si quieres solicitar el rol de vendedor, abre un ticket de soporte indicando el tipo de productos que planeas vender.',
   'cuenta', true);

-- ============================================================
-- 10. TICKETS DE SOPORTE + MENSAJES (2 tickets)
-- ============================================================
insert into public.support_tickets (id, user_id, subject, status, channel, created_at) values
  ('80000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Mi pedido lleva varios días en estado pendiente', 'en_proceso', 'chat', now() - interval '1 day'),
  ('80000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003',
   'Quiero devolver un producto que no era lo que esperaba', 'resuelto', 'chat', now() - interval '9 days');

insert into public.ticket_messages (ticket_id, sender_role, content, created_at) values
  ('80000000-0000-0000-0000-000000000001', 'usuario',
   'Hola, mi pedido c0000000-...0002 sigue en pendiente desde ayer, ¿es normal?', now() - interval '1 day'),
  ('80000000-0000-0000-0000-000000000001', 'agente',
   'Hola María, gracias por escribirnos. Ese tiempo está dentro de lo normal mientras el vendedor procesa el pago simulado; si en 24 horas más no avanza, lo escalamos directamente con el vendedor.', now() - interval '1 day' + interval '10 minutes'),
  ('80000000-0000-0000-0000-000000000001', 'humano',
   'Buenas María, soy Renzo del equipo de soporte. Ya contacté al vendedor para que revise tu pedido hoy mismo.', now() - interval '20 hours'),
  ('80000000-0000-0000-0000-000000000002', 'usuario',
   'El Redmi Note que compré llegó bien pero quiero devolverlo, ¿cómo hago?', now() - interval '9 days'),
  ('80000000-0000-0000-0000-000000000002', 'agente',
   'Claro Ana, puedes solicitar la devolución dentro de los 7 días desde la entrega. Indícanos el motivo y coordinamos con el vendedor.', now() - interval '9 days' + interval '15 minutes'),
  ('80000000-0000-0000-0000-000000000002', 'usuario',
   'Ya no era necesario, al final decidí quedármelo. ¡Gracias!', now() - interval '8 days'),
  ('80000000-0000-0000-0000-000000000002', 'agente',
   'Perfecto, cerramos el ticket entonces. Cualquier cosa nos vuelves a escribir.', now() - interval '8 days' + interval '5 minutes');

-- ============================================================
-- RESUMEN
-- ============================================================
-- Usuarios (6, contraseña MercadoTech123! para todos):
--   buyer1@mercadotech.test  (María Fernanda Quispe — comprador)
--   buyer2@mercadotech.test  (Jorge Luis Ramírez   — comprador)
--   buyer3@mercadotech.test  (Ana Lucía Torres     — comprador)
--   seller1@mercadotech.test (TecnoStore Perú      — vendedor)
--   seller2@mercadotech.test (GamerZone Lima       — vendedor)
--   admin@mercadotech.test   (Soporte MercadoTech  — admin)
--
-- Conteos: categories=8 · products=16 (2 inactivos, 1 con stock 0) ·
-- product_images=35 · orders=6 (los 5 estados, 2 'entregado') ·
-- order_items=9 · questions=8 (4 respondidas) · reviews=4 · favorites=5 ·
-- product_views=8 · support_articles=10 (envíos 3, pagos 3, devoluciones 2,
-- cuenta 2) · support_tickets=2 · ticket_messages=7.
