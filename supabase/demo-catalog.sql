-- ============================================================
-- CATÁLOGO DE DEMOSTRACIÓN — MercadoTech
-- ============================================================
--
-- QUÉ ES: 20 productos repartidos entre las 8 categorías, para que la tienda
-- de producción tenga algo que enseñar en la demo. Todos quedan a nombre de
-- UNA cuenta de vendedor que ya existe, la tuya.
--
-- QUÉ NO ES, Y POR QUÉ IMPORTA: esto NO es una migración y no debe moverse a
-- `supabase/migrations/`. Las migraciones definen el ESQUEMA y se ejecutan en
-- todos los entornos —tu Docker local en cada `supabase db reset`, y el
-- Supabase efímero del CI en cada pull request—. Este archivo son DATOS y
-- depende de un usuario que solo existe en producción: como migración
-- reventaría por clave foránea y dejaría el CI en rojo de forma permanente.
--
-- CÓMO SE USA:
--   1. Edita la línea marcada con <<< EDITA con el correo de tu cuenta.
--   2. Pega este archivo entero en el SQL Editor del proyecto hosted.
--   3. Ejecuta. Es idempotente: repetirlo actualiza, no duplica.
--
-- DESPUÉS FALTA UN PASO: aquí solo se escriben las RUTAS de las imágenes. Los
-- archivos hay que subirlos a Storage aparte (ver scripts/), igual que en
-- local `npm run db:images` sube lo que el seed solo dejó referenciado. Hasta
-- entonces el catálogo se ve con los placeholders de `ProductImage`.
--
-- IDs: los 16 primeros productos reutilizan a propósito los identificadores
-- del seed de laboratorio, porque las fotos de `supabase/seed-images/` están
-- nombradas con ellos. Los cuatro últimos (…17 a …20) son nuevos y equilibran
-- las categorías que habían quedado con un solo producto.
-- ============================================================

do $$
declare
  -- <<< EDITA: el correo con el que te registraste como vendedor.
  v_email  text := 'cambiame@ejemplo.com';

  v_seller uuid;
  v_role   text;
begin
  -- El vendedor se resuelve POR CORREO, nunca con el uuid escrito a mano: así
  -- este archivo no contiene ningún dato personal y sigue sirviendo si la
  -- cuenta se rehace.
  select p.id, p.role
    into v_seller, v_role
    from public.profiles p
    join auth.users u on u.id = p.id
   where lower(u.email) = lower(v_email);

  if v_seller is null then
    raise exception
      'No hay ninguna cuenta con el correo %. Regístrate primero en /register y vuelve a ejecutar.',
      v_email;
  end if;

  if v_role <> 'seller' then
    raise exception
      'La cuenta % existe pero su rol es "%", no "seller". Un comprador no puede tener productos: crea la cuenta eligiendo vendedor.',
      v_email, v_role;
  end if;

  -- ----------------------------------------------------------
  -- 20 PRODUCTOS (8 categorías cubiertas)
  -- ----------------------------------------------------------
  -- El monitor Samsung queda con stock 0 A PROPÓSITO: en la demo sirve para
  -- enseñar que el catálogo lo muestra marcado "Sin stock" y que el carrito
  -- rechaza la compra. Todo lo demás queda activo y con stock.
  insert into public.products
    (id, seller_id, category_id, title, description, brand, condition, price, stock, is_active)
  values
    -- Laptops (d…01)
    ('b0000000-0000-0000-0000-000000000001', v_seller, 'd0000000-0000-0000-0000-000000000001',
     'Laptop Lenovo IdeaPad Slim 3 15.6" Ryzen 5 16GB 512GB SSD',
     'Ideal para estudios y teletrabajo: pantalla Full HD antirreflejo, batería de todo el día y arranque rápido con SSD NVMe.',
     'Lenovo', 'nuevo', 2199.00, 8, true),
    ('b0000000-0000-0000-0000-000000000002', v_seller, 'd0000000-0000-0000-0000-000000000001',
     'Laptop ASUS Vivobook 15 Intel Core i5 8GB 512GB SSD',
     'Delgada y liviana, con teclado numérico completo. Perfecta para oficina y navegación diaria.',
     'ASUS', 'nuevo', 1899.00, 5, true),
    ('b0000000-0000-0000-0000-000000000008', v_seller, 'd0000000-0000-0000-0000-000000000001',
     'Laptop HP Pavilion 14" Core i3 8GB 256GB (Reacondicionada)',
     'Equipo reacondicionado, revisado y con garantía de 6 meses. Excelente para tareas básicas.',
     'HP', 'reacondicionado', 1299.00, 4, true),

    -- Smartphones (d…02)
    ('b0000000-0000-0000-0000-000000000009', v_seller, 'd0000000-0000-0000-0000-000000000002',
     'Smartphone Samsung Galaxy A54 5G 128GB',
     'Pantalla Super AMOLED de 120Hz, cámara principal de 50MP y protección IP67 contra polvo y agua.',
     'Samsung', 'nuevo', 1399.00, 12, true),
    ('b0000000-0000-0000-0000-000000000010', v_seller, 'd0000000-0000-0000-0000-000000000002',
     'Smartphone Xiaomi Redmi Note 13 Pro 256GB',
     'Cámara de 200MP con estabilización óptica y carga rápida de 67W incluida en la caja.',
     'Xiaomi', 'nuevo', 1099.00, 18, true),
    ('b0000000-0000-0000-0000-000000000016', v_seller, 'd0000000-0000-0000-0000-000000000002',
     'Smartphone Samsung Galaxy S21 128GB (Usado)',
     'Equipo usado en buen estado, batería verificada sobre 85% de salud. Incluye cargador.',
     'Samsung', 'usado', 1599.00, 6, true),

    -- Componentes de PC (d…03)
    ('b0000000-0000-0000-0000-000000000003', v_seller, 'd0000000-0000-0000-0000-000000000003',
     'Memoria RAM Kingston Fury Beast 16GB DDR4 3200MHz',
     'Disipador de aluminio, compatible con la mayoría de placas AMD e Intel de la última generación.',
     'Kingston', 'nuevo', 219.00, 25, true),
    ('b0000000-0000-0000-0000-000000000004', v_seller, 'd0000000-0000-0000-0000-000000000003',
     'SSD NVMe Western Digital Blue SN580 1TB',
     'Velocidades de lectura de hasta 4150 MB/s. La forma más simple de acelerar cualquier PC o laptop.',
     'Western Digital', 'nuevo', 289.00, 15, true),
    ('b0000000-0000-0000-0000-000000000020', v_seller, 'd0000000-0000-0000-0000-000000000003',
     'Fuente de Poder Corsair CV650 650W 80 Plus Bronze',
     'Certificación 80 Plus Bronze, ventilador silencioso y protecciones contra sobretensión y cortocircuito.',
     'Corsair', 'nuevo', 349.00, 12, true),

    -- Audio (d…04)
    ('b0000000-0000-0000-0000-000000000011', v_seller, 'd0000000-0000-0000-0000-000000000004',
     'Audífonos Logitech G435 Gaming Inalámbricos',
     'Ligeros (167g), con Bluetooth y dongle 2.4GHz simultáneos. Hasta 18 horas de batería.',
     'Logitech', 'nuevo', 249.00, 30, true),
    ('b0000000-0000-0000-0000-000000000012', v_seller, 'd0000000-0000-0000-0000-000000000004',
     'Parlante JBL Flip 6 Bluetooth',
     'Resistente al agua (IP67), sonido potente y hasta 12 horas de reproducción continua.',
     'JBL', 'nuevo', 449.00, 14, true),

    -- Gaming (d…05)
    ('b0000000-0000-0000-0000-000000000013', v_seller, 'd0000000-0000-0000-0000-000000000005',
     'Teclado Mecánico Logitech G413 SE',
     'Switches táctiles, estructura de aluminio resistente y retroiluminación blanca uniforme.',
     'Logitech', 'nuevo', 329.00, 20, true),
    ('b0000000-0000-0000-0000-000000000014', v_seller, 'd0000000-0000-0000-0000-000000000005',
     'Mouse Gamer Razer DeathAdder V3',
     'Forma ergonómica icónica, sensor óptico de 30000 DPI y switches ópticos de alta durabilidad.',
     'Razer', 'nuevo', 259.00, 22, true),

    -- Monitores (d…06)
    ('b0000000-0000-0000-0000-000000000005', v_seller, 'd0000000-0000-0000-0000-000000000006',
     'Monitor LG 24" Full HD IPS 75Hz',
     'Panel IPS con buenos ángulos de visión y colores fieles, ideal para oficina y uso multimedia.',
     'LG', 'nuevo', 549.00, 10, true),
    ('b0000000-0000-0000-0000-000000000006', v_seller, 'd0000000-0000-0000-0000-000000000006',
     'Monitor Samsung Odyssey 27" Curvo 144Hz Gaming',
     'Curvatura 1000R y tiempo de respuesta de 1ms para gaming competitivo. Compatible con AMD FreeSync.',
     'Samsung', 'nuevo', 999.00, 0, true),

    -- Accesorios (d…07)
    ('b0000000-0000-0000-0000-000000000015', v_seller, 'd0000000-0000-0000-0000-000000000007',
     'Mochila para Laptop Targus 15.6"',
     'Compartimento acolchado, resistente al agua y con bolsillo organizador para accesorios.',
     'Targus', 'nuevo', 129.00, 40, true),
    ('b0000000-0000-0000-0000-000000000017', v_seller, 'd0000000-0000-0000-0000-000000000007',
     'Hub USB-C Anker 7 en 1 con HDMI 4K',
     'Convierte un puerto USB-C en HDMI 4K, dos USB 3.0, lector SD/microSD y carga rápida de 100W.',
     'Anker', 'nuevo', 189.00, 28, true),
    ('b0000000-0000-0000-0000-000000000018', v_seller, 'd0000000-0000-0000-0000-000000000007',
     'Base Refrigerante para Laptop Cooler Master NotePal X150R',
     'Ventilador silencioso de 160mm, altura ajustable y soporte para laptops de hasta 17 pulgadas.',
     'Cooler Master', 'nuevo', 119.00, 35, true),

    -- Redes (d…08)
    ('b0000000-0000-0000-0000-000000000007', v_seller, 'd0000000-0000-0000-0000-000000000008',
     'Router TP-Link Archer C6 AC1200 Dual Band',
     'Cobertura estable para toda la casa, 4 antenas externas y gestión sencilla desde la app Tether.',
     'TP-Link', 'nuevo', 149.00, 20, true),
    ('b0000000-0000-0000-0000-000000000019', v_seller, 'd0000000-0000-0000-0000-000000000008',
     'Repetidor WiFi TP-Link RE305 AC1200 Dual Band',
     'Extiende la señal a las zonas muertas de la casa. Indicador de intensidad para ubicarlo bien.',
     'TP-Link', 'nuevo', 139.00, 24, true)

  on conflict (id) do update set
    seller_id   = excluded.seller_id,
    category_id = excluded.category_id,
    title       = excluded.title,
    description = excluded.description,
    brand       = excluded.brand,
    condition   = excluded.condition,
    price       = excluded.price,
    stock       = excluded.stock,
    is_active   = excluded.is_active;

  -- ----------------------------------------------------------
  -- GALERÍAS
  -- ----------------------------------------------------------
  -- El `image_path` sigue la convención del bucket: {seller_id}/{product_id}/N.jpg
  -- Se construye con el uuid real del vendedor, por eso no puede escribirse a
  -- mano. Se borra antes de insertar para que reejecutar no duplique fotos.
  delete from public.product_images
   where product_id in (select id from public.products where seller_id = v_seller);

  insert into public.product_images (product_id, image_path, position)
  select m.pid,
         v_seller || '/' || m.pid || '/' || (n + 1) || '.jpg',
         n
    from (values
      ('b0000000-0000-0000-0000-000000000001'::uuid, 3),
      ('b0000000-0000-0000-0000-000000000002'::uuid, 2),
      ('b0000000-0000-0000-0000-000000000003'::uuid, 2),
      ('b0000000-0000-0000-0000-000000000004'::uuid, 2),
      ('b0000000-0000-0000-0000-000000000005'::uuid, 2),
      ('b0000000-0000-0000-0000-000000000006'::uuid, 3),
      ('b0000000-0000-0000-0000-000000000007'::uuid, 2),
      ('b0000000-0000-0000-0000-000000000008'::uuid, 2),
      ('b0000000-0000-0000-0000-000000000009'::uuid, 3),
      ('b0000000-0000-0000-0000-000000000010'::uuid, 2),
      ('b0000000-0000-0000-0000-000000000011'::uuid, 2),
      ('b0000000-0000-0000-0000-000000000012'::uuid, 2),
      ('b0000000-0000-0000-0000-000000000013'::uuid, 2),
      ('b0000000-0000-0000-0000-000000000014'::uuid, 2),
      ('b0000000-0000-0000-0000-000000000015'::uuid, 2),
      ('b0000000-0000-0000-0000-000000000016'::uuid, 2),
      -- Los cuatro nuevos llevan una sola foto: la toman prestada de un
      -- producto hermano en el paso de subida a Storage.
      ('b0000000-0000-0000-0000-000000000017'::uuid, 1),
      ('b0000000-0000-0000-0000-000000000018'::uuid, 1),
      ('b0000000-0000-0000-0000-000000000019'::uuid, 1),
      ('b0000000-0000-0000-0000-000000000020'::uuid, 1)
    ) as m(pid, cnt)
    cross join lateral generate_series(0, m.cnt - 1) as n;

  raise notice 'Listo: % productos y % imágenes para el vendedor %.',
    (select count(*) from public.products where seller_id = v_seller),
    (select count(*) from public.product_images pi
       join public.products p on p.id = pi.product_id where p.seller_id = v_seller),
    v_email;
end $$;

-- ============================================================
-- Verificación (debe devolver 20 productos y las 8 categorías con al menos 1):
--   select count(*) from public.products;
--   select c.name, count(p.id)
--     from public.categories c
--     left join public.products p on p.category_id = c.id
--    group by c.name order by c.name;
-- ============================================================
