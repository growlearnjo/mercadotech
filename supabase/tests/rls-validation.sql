-- ============================================================
-- rls-validation.sql — Fase 2.6: validación de políticas RLS
-- ============================================================
-- Objetivo: intentar ROMPER las políticas reales de
-- supabase/migrations/20260821130000_create_rls_policies.sql, no confirmar
-- que "probablemente" funcionan. Cada escenario se derivó leyendo esa
-- migración política por política (no la spec, no de memoria) y
-- contrastando contra los 9 escenarios mínimos de MercadoTech_sesion2.md
-- Fase 2.6 — que están todos cubiertos, más los negativos adicionales que
-- surgieron de leer el código real.
--
-- Requiere `supabase/seed.sql` ya aplicado (usa sus UUIDs fijos).
--
-- Cada prueba: un bloque begin/rollback independiente (si una prueba falla
-- con un error no planeado, no arrastra a las siguientes). Dentro de cada
-- bloque: comentario ESCENARIO + ESPERADO, luego `set local role` +
-- `set local request.jwt.claims`, luego la acción. Ninguna prueba usa la
-- service role para la acción bajo prueba; cuando una prueba necesita
-- datos adicionales que el seed no tiene (ej. carritos para el checkout),
-- ese INSERT se marca explícitamente como "-- SETUP (no es la prueba)" y
-- corre en el mismo begin/rollback, así que no ensucia el seed.
--
-- UUIDs del seed usados aquí (ver supabase/seed.sql):
--   buyer1=a...01 buyer2=a...02 buyer3=a...03 seller1=a...04 seller2=a...05 admin=a...06
--   P1..P8 (seller1, P8 inactivo) = b...01..08 · P9..P16 (seller2, P16 inactivo, P6 stock=0) = b...09..16
--   O1=c...01(buyer1,entregado) O2=c...02(buyer1,pendiente) O3=c...03(buyer2,pagado)
--   O4=c...04(buyer2,enviado,multi-vendedor) O5=c...05(buyer3,cancelado) O6=c...06(buyer3,entregado)

-- ================================================================
-- 1. ANÓNIMO
-- ================================================================

-- ESCENARIO 1: anónimo lista productos.
-- ESPERADO: 14 filas (las 16 menos los 2 inactivos b...08 y b...16).
begin;
set local role anon;
select count(*) as productos_visibles from public.products;
rollback;

-- ESCENARIO 2: anónimo intenta ver cart_items.
-- ESPERADO: error de permiso (sin GRANT select para anon).
begin;
set local role anon;
select * from public.cart_items;
rollback;

-- ESCENARIO 3: anónimo intenta ver orders.
-- ESPERADO: error de permiso (sin GRANT select para anon).
begin;
set local role anon;
select * from public.orders;
rollback;

-- ESCENARIO 4: anónimo intenta ver support_tickets.
-- ESPERADO: error de permiso (sin GRANT select para anon).
begin;
set local role anon;
select * from public.support_tickets;
rollback;

-- ESCENARIO 5: anónimo lee categories, questions, reviews y support_articles
-- publicados (todas explícitamente públicas en la spec).
-- ESPERADO: 8, 8, 4 y 10 filas respectivamente, sin error.
begin;
set local role anon;
select count(*) from public.categories;
select count(*) from public.questions;
select count(*) from public.reviews;
select count(*) from public.support_articles;
rollback;

-- ================================================================
-- 2. PROFILES
-- ================================================================

-- ESCENARIO 6: buyer1 ve su propio perfil.
-- ESPERADO: 1 fila.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select display_name from public.profiles where id = 'a0000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 7: buyer1 intenta ver el perfil de buyer2.
-- ESPERADO: 0 filas (RLS lo filtra, no es un error).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select count(*) as deberia_ser_cero from public.profiles where id = 'a0000000-0000-0000-0000-000000000002';
rollback;

-- ESCENARIO 8 (spec #7): buyer1 intenta cambiar su propio role a 'admin'.
-- ESPERADO: excepción "No tienes permiso para cambiar tu propio rol"
-- (trigger protect_profile_role_trigger).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 9: buyer1 intenta editar el perfil de buyer2 (no el propio).
-- ESPERADO: 0 filas afectadas (USING lo filtra).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.profiles set display_name = 'Hackeado' where id = 'a0000000-0000-0000-0000-000000000002';
rollback;

-- ESCENARIO 10: admin ve todos los perfiles (moderación).
-- ESPERADO: 6 filas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
select count(*) as perfiles_visibles_admin from public.profiles;
rollback;

-- ================================================================
-- 3. CATEGORIES
-- ================================================================

-- ESCENARIO 11: buyer1 (no admin) intenta crear una categoría.
-- ESPERADO: 0 filas insertadas (WITH CHECK is_admin() falla).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.categories (name, slug) values ('Impresoras', 'impresoras');
rollback;

-- ESCENARIO 12: admin crea una categoría.
-- ESPERADO: 1 fila insertada.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
insert into public.categories (name, slug) values ('Impresoras', 'impresoras');
select count(*) as categorias_totales from public.categories;
rollback;

-- ESCENARIO 13: seller1 (no admin) intenta borrar una categoría.
-- ESPERADO: 0 filas afectadas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
delete from public.categories where id = 'd0000000-0000-0000-0000-000000000001';
rollback;

-- ================================================================
-- 4. PRODUCTS (spec #4: vendedor CRUD de SUS productos, no ajenos)
-- ================================================================

-- ESCENARIO 14: seller1 ve sus propios productos inactivos además de los
-- activos de todo el catálogo.
-- ESPERADO: >= 1 fila para el producto inactivo propio (b...08).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select count(*) as ve_su_inactivo from public.products where id = 'b0000000-0000-0000-0000-000000000008';
rollback;

-- ESCENARIO 15: seller2 NO ve el producto inactivo de seller1 (no es suyo
-- y no está activo).
-- ESPERADO: 0 filas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000005", "role": "authenticated"}';
select count(*) as deberia_ser_cero from public.products where id = 'b0000000-0000-0000-0000-000000000008';
rollback;

-- ESCENARIO 16: buyer1 (role='buyer') intenta publicar un producto.
-- ESPERADO: 0 filas (WITH CHECK exige role='seller').
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.products (seller_id, category_id, title, price, stock)
values ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Producto de buyer', 100, 1);
rollback;

-- ESCENARIO 17: seller1 intenta publicar un producto suplantando a seller2
-- como dueño (seller_id ajeno).
-- ESPERADO: 0 filas (WITH CHECK exige seller_id = auth.uid()).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
insert into public.products (seller_id, category_id, title, price, stock)
values ('a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 'Producto suplantado', 100, 1);
rollback;

-- ESCENARIO 18 (spec #4): seller2 intenta editar un producto de seller1.
-- ESPERADO: 0 filas afectadas (products_update_own lo bloquea).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000005", "role": "authenticated"}';
update public.products set price = 1.00 where id = 'b0000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 19 (spec #4): seller1 edita SU producto.
-- ESPERADO: 1 fila afectada, price = 1500.00.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
update public.products set price = 1500.00 where id = 'b0000000-0000-0000-0000-000000000001';
select price from public.products where id = 'b0000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 20: seller2 intenta borrar un producto de seller1.
-- ESPERADO: 0 filas afectadas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000005", "role": "authenticated"}';
delete from public.products where id = 'b0000000-0000-0000-0000-000000000001';
rollback;

-- ================================================================
-- 5. PRODUCT_IMAGES
-- ================================================================

-- ESCENARIO 21: seller2 intenta subir metadata de imagen bajo un producto
-- de seller1 (no dueño).
-- ESPERADO: 0 filas (WITH CHECK exige ser dueño del producto).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000005", "role": "authenticated"}';
insert into public.product_images (product_id, image_path, position)
values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000001/x.jpg', 9);
rollback;

-- ESCENARIO 22: seller1 sube metadata de imagen para SU producto.
-- ESPERADO: 1 fila insertada.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
insert into public.product_images (product_id, image_path, position)
values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000001/9.jpg', 9);
rollback;

-- ================================================================
-- 6. CART_ITEMS (spec #2: comprador ve/edita SU carrito, no el de otro)
-- ================================================================

-- ESCENARIO 23: buyer1 agrega un producto a SU carrito.
-- ESPERADO: 1 fila insertada.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.cart_items (user_id, product_id, quantity)
values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 1);
select count(*) from public.cart_items where user_id = 'a0000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 24 (spec #2): buyer1 intenta insertar un cart_item A NOMBRE DE
-- buyer2 (user_id ajeno).
-- ESPERADO: 0 filas (WITH CHECK exige user_id = auth.uid()).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.cart_items (user_id, product_id, quantity)
values ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 1);
rollback;

-- ESCENARIO 25 (spec #2): buyer1 intenta ver el carrito de buyer2.
-- ESPERADO: 0 filas (carrito de buyer2 está vacío en el seed de por sí,
-- pero aquí sembramos uno de buyer2 en la misma transacción para probar
-- de verdad el aislamiento -- SETUP (no es la prueba) --).
begin;
insert into public.cart_items (user_id, product_id, quantity)
values ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000009', 2);
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select count(*) as deberia_ser_cero from public.cart_items where user_id = 'a0000000-0000-0000-0000-000000000002';
reset role;
rollback;

-- ================================================================
-- 7. ORDERS (spec #5: vendedor ve pedidos con sus ítems, no ajenos)
-- ================================================================

-- ESCENARIO 26: buyer1 ve sus propios pedidos (O1, O2).
-- ESPERADO: 2 filas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select count(*) as pedidos_buyer1 from public.orders;
rollback;

-- ESCENARIO 27 (spec #5): seller1 ve los pedidos que contienen ítems suyos
-- (O1 tiene b...01/b...03; O2 tiene b...07; O4 tiene b...05) aunque el
-- comprador sea otro.
-- ESPERADO: 3 filas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select count(*) as pedidos_visibles_seller1 from public.orders;
rollback;

-- ESCENARIO 28 (spec #5): seller2 NO ve pedidos que no tienen ítems suyos
-- (ve O3, O4, O5, O6 = 4; NO ve O1 ni O2, que son 100% de seller1).
-- ESPERADO: 4 filas (no 6).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000005", "role": "authenticated"}';
select count(*) as pedidos_visibles_seller2 from public.orders;
rollback;

-- ESCENARIO 29: admin ve todos los pedidos.
-- ESPERADO: 6 filas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
select count(*) as pedidos_visibles_admin from public.orders;
rollback;

-- ESCENARIO 30: cualquier authenticated intenta un INSERT directo en orders
-- (bypaseando create_order_from_cart).
-- ESPERADO: error de permiso (sin GRANT insert para authenticated).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.orders (buyer_id, status, total) values ('a0000000-0000-0000-0000-000000000001', 'pendiente', 1);
rollback;

-- ESCENARIO 31: seller1 avanza el status de O2 (tiene su ítem b...07,
-- está 'pendiente') a 'pagado'.
-- ESPERADO: 1 fila afectada, status = 'pagado'.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
update public.orders set status = 'pagado' where id = 'c0000000-0000-0000-0000-000000000002';
select status from public.orders where id = 'c0000000-0000-0000-0000-000000000002';
rollback;

-- ESCENARIO 32: seller1 intenta CANCELAR O2 (fuera del conjunto permitido
-- para el vendedor: pagado/enviado/entregado).
-- ESPERADO: error "new row violates row-level security policy" (WITH CHECK).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
update public.orders set status = 'cancelado' where id = 'c0000000-0000-0000-0000-000000000002';
rollback;

-- ESCENARIO 33: seller2 (sin ítems en O2) intenta tocar el status de O2.
-- ESPERADO: 0 filas afectadas (USING lo filtra).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000005", "role": "authenticated"}';
update public.orders set status = 'pagado' where id = 'c0000000-0000-0000-0000-000000000002';
rollback;

-- ESCENARIO 34 (spec #5 variante): comprador cancela SU pedido 'pendiente' (O2).
-- ESPERADO: 1 fila afectada, status = 'cancelado'.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.orders set status = 'cancelado' where id = 'c0000000-0000-0000-0000-000000000002';
select status from public.orders where id = 'c0000000-0000-0000-0000-000000000002';
rollback;

-- ESCENARIO 35: comprador intenta cancelar un pedido que YA NO está
-- 'pendiente' (O3 está 'pagado').
-- ESPERADO: 0 filas afectadas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
update public.orders set status = 'cancelado' where id = 'c0000000-0000-0000-0000-000000000003';
rollback;

-- ESCENARIO 36: seller1 (autorizado por USING vía O2) intenta de contrabando
-- cambiar también el total junto con el status.
-- ESPERADO: error (lock_order_immutable_fields_trigger: total es inmutable).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
update public.orders set status = 'pagado', total = 1.00 where id = 'c0000000-0000-0000-0000-000000000002';
rollback;

-- ================================================================
-- 8. ORDER_ITEMS
-- ================================================================

-- ESCENARIO 37: buyer1 ve los order_items de SU pedido O1.
-- ESPERADO: 2 filas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select count(*) from public.order_items where order_id = 'c0000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 38: buyer2 (no es comprador ni vendedor en O1) intenta ver los
-- order_items de O1.
-- ESPERADO: 0 filas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select count(*) as deberia_ser_cero from public.order_items where order_id = 'c0000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 39: seller1 ve SUS ítems dentro del pedido multi-vendedor O4
-- (el ítem b...05), sin ver el de seller2 (b...11) como si fuera suyo.
-- ESPERADO: 1 fila (no 2).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select count(*) as items_propios_en_O4 from public.order_items
where order_id = 'c0000000-0000-0000-0000-000000000004' and seller_id = 'a0000000-0000-0000-0000-000000000004';
rollback;

-- ESCENARIO 40: cualquier authenticated intenta INSERT directo en order_items.
-- ESPERADO: error de permiso (sin GRANT insert).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.order_items (order_id, product_id, seller_id, title_snapshot, price_snapshot, quantity)
values ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'x', 1, 1);
rollback;

-- ================================================================
-- 9. QUESTIONS (spec #6: vendedor responde SOLO sus productos)
-- ================================================================

-- ESCENARIO 41: buyer2 pregunta sobre un producto, atribuida a sí mismo.
-- ESPERADO: 1 fila insertada.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
insert into public.questions (product_id, user_id, question)
values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '¿Prueba?');
rollback;

-- ESCENARIO 42: buyer2 intenta insertar una pregunta A NOMBRE DE buyer3.
-- ESPERADO: 0 filas (WITH CHECK exige user_id = auth.uid()).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
insert into public.questions (product_id, user_id, question)
values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', '¿Suplantación?');
rollback;

-- ESCENARIO 43 (spec #6): seller1 responde una pregunta de SU producto (Q5, sobre b...02).
-- ESPERADO: 1 fila afectada, answer = 'Respuesta de prueba'.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
update public.questions set answer = 'Respuesta de prueba' where id = '60000000-0000-0000-0000-000000000005';
select answer from public.questions where id = '60000000-0000-0000-0000-000000000005';
rollback;

-- ESCENARIO 44 (spec #6): seller1 intenta responder una pregunta de un
-- producto de seller2 (Q3, sobre b...09).
-- ESPERADO: 0 filas afectadas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
update public.questions set answer = 'Intento ajeno' where id = '60000000-0000-0000-0000-000000000003';
rollback;

-- ESCENARIO 45: seller1 intenta, de contrabando, reescribir el texto de la
-- pregunta (question) al mismo tiempo que la responde.
-- ESPERADO: error (lock_question_immutable_fields_trigger).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
update public.questions set answer = 'ok', question = 'Pregunta reescrita' where id = '60000000-0000-0000-0000-000000000005';
rollback;

-- ESCENARIO 46: el autor de una pregunta la borra.
-- ESPERADO: 1 fila afectada.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
delete from public.questions where id = '60000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 47 (spec #8): admin borra una pregunta ajena (moderación).
-- ESPERADO: 1 fila afectada.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
delete from public.questions where id = '60000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 48: un tercero (no autor, no dueño del producto, no admin)
-- intenta borrar la pregunta de otro.
-- ESPERADO: 0 filas afectadas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
delete from public.questions where id = '60000000-0000-0000-0000-000000000001';
rollback;

-- ================================================================
-- 10. REVIEWS (spec #3: reseña exige pedido 'entregado')
-- ================================================================

-- ESCENARIO 49 (spec #3): buyer2 (sin pedido 'entregado' con b...01) intenta
-- reseñar b...01.
-- ESPERADO: 0 filas (WITH CHECK con EXISTS falla).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
insert into public.reviews (product_id, buyer_id, order_id, rating, comment)
values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 5, 'Sin compra verificada');
rollback;

-- ESCENARIO 50 (spec #3): buyer2 reseña b...09, que SÍ compró y le fue
-- 'entregado'... espera, O3 (buyer2, b...09) está 'pagado', no 'entregado'
-- -- confirma que el estado exacto también importa, no solo "compró".
-- ESPERADO: 0 filas (status='pagado', no 'entregado').
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
insert into public.reviews (product_id, buyer_id, order_id, rating, comment)
values ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 4, 'Pedido aun no entregado');
rollback;

-- ESCENARIO 51 (spec #3): buyer3 reseña b...13, que compró en O6
-- ('entregado').
-- ESPERADO: 1 fila insertada (usamos un producto sin reseña previa de
-- buyer3 para no chocar con el unique(product_id,buyer_id) del seed:
-- b...14 ya tiene reseña de buyer3, probamos con un producto nuevo del
-- mismo pedido -- aquí agregamos primero el order_item vía SETUP).
begin;
insert into public.order_items (order_id, product_id, seller_id, title_snapshot, price_snapshot, quantity)
values ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000005', 'Parlante JBL Flip 6 Bluetooth', 449.00, 1);
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
insert into public.reviews (product_id, buyer_id, order_id, rating, comment)
values ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006', 5, 'Compra verificada, entregado');
select count(*) as reseña_insertada from public.reviews
where product_id = 'b0000000-0000-0000-0000-000000000012' and buyer_id = 'a0000000-0000-0000-0000-000000000003';
reset role;
rollback;

-- ESCENARIO 52: buyer1 edita su propia reseña de b...01 (cambia el rating).
-- ESPERADO: 1 fila afectada, rating = 3.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.reviews set rating = 3 where product_id = 'b0000000-0000-0000-0000-000000000001' and buyer_id = 'a0000000-0000-0000-0000-000000000001';
select rating from public.reviews where product_id = 'b0000000-0000-0000-0000-000000000001' and buyer_id = 'a0000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 53: buyer1 intenta, de contrabando, reasignar su reseña de
-- b...01 a un producto que NUNCA compró (b...09).
-- ESPERADO: error (WITH CHECK de reviews_update_own_still_verified vuelve a
-- exigir la compra 'entregada' del NUEVO product_id).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.reviews set product_id = 'b0000000-0000-0000-0000-000000000009'
where product_id = 'b0000000-0000-0000-0000-000000000001' and buyer_id = 'a0000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 54 (spec #8): admin borra una reseña ajena (moderación).
-- ESPERADO: 1 fila afectada.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
delete from public.reviews where product_id = 'b0000000-0000-0000-0000-000000000001' and buyer_id = 'a0000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 55: un tercero (no autor, no admin) intenta borrar la reseña
-- de otro comprador.
-- ESPERADO: 0 filas afectadas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
delete from public.reviews where product_id = 'b0000000-0000-0000-0000-000000000001' and buyer_id = 'a0000000-0000-0000-0000-000000000001';
rollback;

-- ================================================================
-- 11. FAVORITES
-- ================================================================

-- ESCENARIO 56: buyer1 ve SUS favoritos, no los de buyer2.
-- ESPERADO: 2 filas (los del seed para buyer1), no las 5 totales.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select count(*) as favoritos_buyer1 from public.favorites;
rollback;

-- ESCENARIO 57: buyer1 intenta insertar un favorito a nombre de buyer2.
-- ESPERADO: 0 filas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.favorites (user_id, product_id) values ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001');
rollback;

-- ================================================================
-- 12. PRODUCT_VIEWS
-- ================================================================

-- ESCENARIO 58: seller1 ve las vistas de SU producto b...01.
-- ESPERADO: >= 1 fila.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select count(*) as vistas_visibles from public.product_views where product_id = 'b0000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 59: seller2 intenta ver las vistas del producto de seller1 (b...01).
-- ESPERADO: 0 filas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000005", "role": "authenticated"}';
select count(*) as deberia_ser_cero from public.product_views where product_id = 'b0000000-0000-0000-0000-000000000001';
rollback;

-- ================================================================
-- 13. SUPPORT_ARTICLES
-- ================================================================

-- ESCENARIO 60: anon NO ve un artículo sin publicar.
-- ESPERADO: 0 filas (-- SETUP: se crea un artículo is_published=false
-- dentro de esta misma transacción, no es la prueba en sí --).
begin;
insert into public.support_articles (id, title, content, category, is_published)
values ('70000000-0000-0000-0000-000000000099', 'Borrador interno', 'contenido no publico', 'cuenta', false);
set local role anon;
select count(*) as deberia_ser_cero from public.support_articles where id = '70000000-0000-0000-0000-000000000099';
reset role;
rollback;

-- ESCENARIO 61: admin SÍ ve ese mismo artículo sin publicar.
-- ESPERADO: 1 fila (-- SETUP igual que arriba --).
begin;
insert into public.support_articles (id, title, content, category, is_published)
values ('70000000-0000-0000-0000-000000000099', 'Borrador interno', 'contenido no publico', 'cuenta', false);
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
select count(*) as visible_para_admin from public.support_articles where id = '70000000-0000-0000-0000-000000000099';
reset role;
rollback;

-- ESCENARIO 62: buyer1 (no admin) intenta crear un artículo de soporte.
-- ESPERADO: 0 filas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.support_articles (title, content, category) values ('x', 'y', 'cuenta');
rollback;

-- ESCENARIO 63 (spec #8): admin edita un artículo existente (moderación /
-- mantenimiento de la base de conocimiento).
-- ESPERADO: 1 fila afectada.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
update public.support_articles set content = content || ' [editado]' where id = '70000000-0000-0000-0000-000000000001';
select content like '%[editado]' as editado_ok from public.support_articles where id = '70000000-0000-0000-0000-000000000001';
rollback;

-- ================================================================
-- 14. SUPPORT_TICKETS
-- ================================================================

-- ESCENARIO 64: buyer1 ve SU ticket, no los de otros.
-- ESPERADO: 1 fila.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select count(*) as tickets_buyer1 from public.support_tickets;
rollback;

-- ESCENARIO 65: buyer1 (dueño) cierra su propio ticket.
-- ESPERADO: 1 fila afectada, status = 'cerrado'.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.support_tickets set status = 'cerrado' where id = '80000000-0000-0000-0000-000000000001';
select status from public.support_tickets where id = '80000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 66: buyer1 intenta cambiar el status de su ticket a algo
-- distinto de 'cerrado' (ej. 'resuelto').
-- ESPERADO: error (lock_ticket_immutable_fields_trigger solo permite 'cerrado').
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.support_tickets set status = 'resuelto' where id = '80000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 67: buyer1 intenta, de contrabando, cambiar el subject junto
-- con el cierre.
-- ESPERADO: error (mismo trigger: subject es inmutable para el dueño).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.support_tickets set status = 'cerrado', subject = 'Otro asunto' where id = '80000000-0000-0000-0000-000000000001';
rollback;

-- ESCENARIO 68: admin edita libremente el subject de un ticket ajeno.
-- ESPERADO: 1 fila afectada (is_admin() bypasea el trigger de bloqueo).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
update public.support_tickets set subject = 'Reclasificado por soporte' where id = '80000000-0000-0000-0000-000000000001';
select subject from public.support_tickets where id = '80000000-0000-0000-0000-000000000001';
rollback;

-- ================================================================
-- 15. TICKET_MESSAGES
-- ================================================================

-- ESCENARIO 69: buyer1 escribe un mensaje en SU propio ticket.
-- ESPERADO: 1 fila insertada.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.ticket_messages (ticket_id, sender_role, content)
values ('80000000-0000-0000-0000-000000000001', 'usuario', 'Mensaje de prueba');
rollback;

-- ESCENARIO 70: buyer1 intenta escribir un mensaje en el ticket de buyer3.
-- ESPERADO: 0 filas.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
insert into public.ticket_messages (ticket_id, sender_role, content)
values ('80000000-0000-0000-0000-000000000002', 'usuario', 'Intento ajeno');
rollback;

-- ================================================================
-- 16. CHECKOUT: create_order_from_cart (spec #9)
-- ================================================================

-- ESCENARIO 71 (spec #9): carrito vacío.
-- ESPERADO: excepción "El carrito está vacío".
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select public.create_order_from_cart('a0000000-0000-0000-0000-000000000002');
rollback;

-- ESCENARIO 72 (spec #9): stock insuficiente, debe nombrar el producto.
-- ESPERADO: excepción "Stock insuficiente para "Router TP-Link..."..."
-- (-- SETUP: agregamos al carrito más unidades que el stock disponible --).
begin;
insert into public.cart_items (user_id, product_id, quantity)
values ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000007', 999);
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select public.create_order_from_cart('a0000000-0000-0000-0000-000000000002');
reset role;
rollback;

-- ESCENARIO 73: producto con stock 0 (b...06) en el carrito.
-- ESPERADO: excepción de stock insuficiente (disponible 0, solicitado 1)
-- (-- SETUP --).
begin;
insert into public.cart_items (user_id, product_id, quantity)
values ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000006', 1);
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select public.create_order_from_cart('a0000000-0000-0000-0000-000000000002');
reset role;
rollback;

-- ESCENARIO 74: producto inactivo (b...08) en el carrito.
-- ESPERADO: excepción "ya no está disponible"
-- (-- SETUP: forzamos temporalmente is_active=true al insertar el
-- cart_item porque cart_items no tiene FK de "producto activo"; luego lo
-- volvemos a poner inactivo antes de intentar el checkout --).
begin;
update public.products set is_active = true where id = 'b0000000-0000-0000-0000-000000000008';
insert into public.cart_items (user_id, product_id, quantity)
values ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000008', 1);
update public.products set is_active = false where id = 'b0000000-0000-0000-0000-000000000008';
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select public.create_order_from_cart('a0000000-0000-0000-0000-000000000002');
reset role;
rollback;

-- ESCENARIO 75: buyer2 intenta hacer checkout PASANDO EL UUID de buyer3
-- como p_buyer_id (suplantación).
-- ESPERADO: excepción "No autorizado: p_buyer_id no coincide...".
begin;
insert into public.cart_items (user_id, product_id, quantity)
values ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000015', 1);
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select public.create_order_from_cart('a0000000-0000-0000-0000-000000000003');
reset role;
rollback;

-- ESCENARIO 76 (spec #9): checkout exitoso — crea el pedido, descuenta
-- stock y vacía el carrito.
-- ESPERADO: pedido creado con total=298.00 (149*2), stock de b...07 baja de
-- 20 a 18, carrito de buyer2 queda en 0 filas.
begin;
insert into public.cart_items (user_id, product_id, quantity)
values ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000007', 2);
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select public.create_order_from_cart('a0000000-0000-0000-0000-000000000002') as nuevo_pedido \gset
select status, total from public.orders where id = :'nuevo_pedido';
select title_snapshot, price_snapshot, quantity from public.order_items where order_id = :'nuevo_pedido';
reset role;
select stock from public.products where id = 'b0000000-0000-0000-0000-000000000007';
select count(*) as carrito_restante from public.cart_items where user_id = 'a0000000-0000-0000-0000-000000000002';
rollback;
