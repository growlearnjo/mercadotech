-- ============================================================
-- policies.sql — COPIA DE REFERENCIA, NO ES LA FUENTE DE VERDAD.
-- La fuente de verdad es supabase/migrations/*.sql. Este archivo se
-- regenera copiando la migración de políticas cada vez que cambia.
-- Generado: Fase 2.3 de MercadoTech_sesion2.md.
-- ============================================================

-- Fase 2.3 — Políticas RLS. Una migración dedicada, tal como pide la spec.
--
-- Convenciones usadas en todo el archivo:
-- * (select auth.uid()) en vez de auth.uid() a secas: el planner lo trata
--   como un initplan (se evalúa una vez por consulta, no una vez por fila).
-- * Cada política declara explícitamente `to anon` / `to authenticated` en
--   vez de dejarla en el "public" por defecto: el rol autorizado queda
--   documentado en la propia política, no solo inferido del GRANT.
-- * Los GRANTs van al final, agrupados por tabla. Donde la spec dice
--   "vía función" o "—" (no permitido), NO se otorga el GRANT — es
--   intencional (ver comentario en esa sección), no un olvido.
-- * Donde la spec exige edición PARCIAL de una fila ("solo status",
--   "solo answer", "solo cerrar", "role no editable por el propio
--   usuario"), una política RLS sola no basta: un WITH CHECK no puede
--   comparar contra la fila anterior. Se usa un trigger BEFORE UPDATE
--   dedicado por tabla (mismo patrón que profiles.role) para bloquear
--   cualquier columna fuera de la permitida.

-- ============================================================
-- Helper: is_admin()
-- ============================================================
-- SECURITY DEFINER + search_path fijo: corre con los privilegios del owner
-- (bypasea RLS de profiles, evitando recursión de políticas) y evita
-- hijacking vía search_path. STABLE: el planner puede evitar reevaluarla
-- más de lo necesario dentro de una misma consulta.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- ============================================================
-- Helpers: rompen la recursión cruzada entre orders <-> order_items
-- ============================================================
-- orders necesita preguntar "¿tiene este pedido algún ítem de este
-- vendedor?" (consulta order_items) y order_items necesita preguntar
-- "¿es este pedido del comprador X?" (consulta orders). Si cada política
-- hiciera esa consulta directa contra la otra tabla, esa subconsulta
-- dispararía las políticas RLS de la otra tabla — que a su vez vuelven a
-- consultar la primera, y Postgres corta con "infinite recursion detected
-- in policy". SECURITY DEFINER bypasea RLS en la tabla consultada (corre
-- como el owner), rompiendo el ciclo — mismo mecanismo que is_admin().
create or replace function public.order_has_seller_item(p_order_id uuid, p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.order_items oi
    where oi.order_id = p_order_id and oi.seller_id = p_seller_id
  );
$$;

create or replace function public.order_belongs_to_buyer(p_order_id uuid, p_buyer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.buyer_id = p_buyer_id
  );
$$;

-- ============================================================
-- profiles
-- ============================================================
-- Protección de columna: role NO editable por el propio usuario. Un WITH
-- CHECK no puede ver el valor anterior de la fila, así que se resuelve con
-- un trigger (igual que sugiere la spec: "vía política/trigger").
--
-- Guard `(select auth.uid()) is not null`: el trigger corre para CUALQUIER
-- UPDATE, incluido el de una sesión sin JWT (postgres, migraciones, seed, o
-- el futuro cliente admin de lib/supabase/admin.ts con la service role key
-- — ese cliente ya bypasea RLS por completo, pero los TRIGGERS no forman
-- parte de RLS y disparan igual). Sin este guard, ni el propio backend
-- admin podría promover a un vendedor a seller/admin. Solo se exige
-- is_admin() cuando la sesión SÍ tiene una identidad autenticada real (el
-- camino gobernado por RLS vía PostgREST).
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
begin
  if (select auth.uid()) is not null
     and new.role is distinct from old.role
     and not public.is_admin()
  then
    raise exception 'No tienes permiso para cambiar tu propio rol';
  end if;
  return new;
end;
$$;

create trigger protect_profile_role_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- SELECT: el dueño ve su perfil; admin ve todos (moderación).
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id or public.is_admin());

-- INSERT: ninguna política — el único INSERT válido es el del trigger
-- handle_new_user (Fase 2.2), que corre SECURITY DEFINER y bypasea RLS.
-- No hay GRANT de insert para authenticated (ver sección de GRANTs).

-- UPDATE: solo el dueño. La spec no menciona un UPDATE admin-wide aquí (a
-- diferencia del SELECT); la promoción de roles queda para el cliente admin
-- (service role, bypasea RLS) de una sesión futura.
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- DELETE: no contemplado en la spec ("—" implícito) — sin política, sin GRANT.

-- ============================================================
-- categories
-- ============================================================
create policy "categories_select_all"
on public.categories for select
to anon, authenticated
using (true);

create policy "categories_insert_admin"
on public.categories for insert
to authenticated
with check (public.is_admin());

create policy "categories_update_admin"
on public.categories for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "categories_delete_admin"
on public.categories for delete
to authenticated
using (public.is_admin());

-- ============================================================
-- products
-- ============================================================
-- SELECT: público si is_active; el vendedor también ve los suyos inactivos.
create policy "products_select_active_or_own"
on public.products for select
to anon, authenticated
using (is_active or seller_id = (select auth.uid()));

-- INSERT: authenticated con seller_id = auth.uid() y rol 'seller'.
create policy "products_insert_own_as_seller"
on public.products for insert
to authenticated
with check (
  seller_id = (select auth.uid())
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'seller'
  )
);

-- UPDATE/DELETE: solo el vendedor dueño (la pertenencia ya implica el rol:
-- ningún producto puede tener como seller_id a alguien que no sea seller,
-- porque el INSERT lo exige).
create policy "products_update_own"
on public.products for update
to authenticated
using (seller_id = (select auth.uid()))
with check (seller_id = (select auth.uid()));

create policy "products_delete_own"
on public.products for delete
to authenticated
using (seller_id = (select auth.uid()));

-- ============================================================
-- product_images
-- ============================================================
-- Misma visibilidad que su producto.
create policy "product_images_select_visible_product"
on public.product_images for select
to anon, authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_images.product_id
      and (p.is_active or p.seller_id = (select auth.uid()))
  )
);

create policy "product_images_insert_own_product"
on public.product_images for insert
to authenticated
with check (
  exists (
    select 1 from public.products p
    where p.id = product_images.product_id
      and p.seller_id = (select auth.uid())
  )
);

create policy "product_images_update_own_product"
on public.product_images for update
to authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_images.product_id
      and p.seller_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.products p
    where p.id = product_images.product_id
      and p.seller_id = (select auth.uid())
  )
);

create policy "product_images_delete_own_product"
on public.product_images for delete
to authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_images.product_id
      and p.seller_id = (select auth.uid())
  )
);

-- ============================================================
-- cart_items
-- ============================================================
-- El carrito solo lo ve y edita su dueño, punto.
create policy "cart_items_select_own"
on public.cart_items for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "cart_items_insert_own"
on public.cart_items for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "cart_items_update_own"
on public.cart_items for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "cart_items_delete_own"
on public.cart_items for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ============================================================
-- orders
-- ============================================================
-- Bloqueo de columnas: sea cual sea la política que autorizó el UPDATE
-- (vendedor o comprador), buyer_id/total/created_at/id son inmutables. El
-- INSERT directo del cliente no existe (ver GRANTs); solo create_order_from_cart
-- escribe estos campos, siempre en el momento de creación.
-- Guard `(select auth.uid()) is not null`: igual razón que en
-- protect_profile_role — sin esto, ni un backend con service role podría
-- corregir un pedido (ej. reembolso, ajuste manual).
create or replace function public.lock_order_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if (select auth.uid()) is not null
     and (
       new.id is distinct from old.id
       or new.buyer_id is distinct from old.buyer_id
       or new.total is distinct from old.total
       or new.created_at is distinct from old.created_at
     )
  then
    raise exception 'orders: solo status es editable vía RLS (id, buyer_id, total y created_at son inmutables)';
  end if;
  return new;
end;
$$;

create trigger lock_order_immutable_fields_trigger
  before update on public.orders
  for each row execute function public.lock_order_immutable_fields();

-- SELECT: comprador dueño, vendedor con ítems en el pedido, o admin.
create policy "orders_select_buyer_own"
on public.orders for select
to authenticated
using (buyer_id = (select auth.uid()));

create policy "orders_select_seller_has_items"
on public.orders for select
to authenticated
using (public.order_has_seller_item(orders.id, (select auth.uid())));

create policy "orders_select_admin"
on public.orders for select
to authenticated
using (public.is_admin());

-- INSERT: ninguna política — únicamente create_order_from_cart (SECURITY
-- DEFINER) escribe en orders. Sin GRANT de insert para authenticated.

-- UPDATE, vendedor: solo puede AVANZAR el status de pedidos con ítems suyos.
-- Supuesto (documentado arriba): no se codifica la secuencia estricta de
-- estados aquí, solo el conjunto de destinos válidos para este actor.
create policy "orders_update_seller_advance_status"
on public.orders for update
to authenticated
using (public.order_has_seller_item(orders.id, (select auth.uid())))
with check (
  status in ('pagado', 'enviado', 'entregado')
  and public.order_has_seller_item(orders.id, (select auth.uid()))
);

-- UPDATE, comprador: solo puede cancelar un pedido que esté 'pendiente'.
create policy "orders_update_buyer_cancel"
on public.orders for update
to authenticated
using (
  buyer_id = (select auth.uid())
  and status = 'pendiente'
)
with check (
  buyer_id = (select auth.uid())
  and status = 'cancelado'
);

-- DELETE: no contemplado en la spec ("—") — sin política, sin GRANT.

-- ============================================================
-- order_items
-- ============================================================
-- SELECT: comprador del pedido, vendedor de sus ítems, o admin.
create policy "order_items_select_buyer_of_order"
on public.order_items for select
to authenticated
using (public.order_belongs_to_buyer(order_items.order_id, (select auth.uid())));

create policy "order_items_select_seller_own"
on public.order_items for select
to authenticated
using (seller_id = (select auth.uid()));

create policy "order_items_select_admin"
on public.order_items for select
to authenticated
using (public.is_admin());

-- INSERT/UPDATE/DELETE: ninguna política — solo create_order_from_cart
-- escribe en order_items. Sin GRANT de insert/update/delete.

-- ============================================================
-- questions
-- ============================================================
-- Bloqueo de columnas: el vendedor dueño del producto solo puede escribir
-- answer/answered_at; el resto de la fila es inmutable para él (no hay
-- política de UPDATE para el propio autor de la pregunta ni para admin,
-- así que este trigger no necesita un bypass).
-- Guard `(select auth.uid()) is not null`: misma razón — no bloquear
-- correcciones hechas por un backend con service role.
create or replace function public.lock_question_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if (select auth.uid()) is not null
     and (
       new.id is distinct from old.id
       or new.product_id is distinct from old.product_id
       or new.user_id is distinct from old.user_id
       or new.question is distinct from old.question
       or new.created_at is distinct from old.created_at
     )
  then
    raise exception 'questions: solo answer/answered_at son editables vía RLS';
  end if;
  return new;
end;
$$;

create trigger lock_question_immutable_fields_trigger
  before update on public.questions
  for each row execute function public.lock_question_immutable_fields();

-- SELECT: público (el producto es público).
create policy "questions_select_all"
on public.questions for select
to anon, authenticated
using (true);

-- INSERT: cualquier authenticated, atribuida a sí mismo.
create policy "questions_insert_own"
on public.questions for insert
to authenticated
with check (user_id = (select auth.uid()));

-- UPDATE: solo el vendedor dueño del producto (para responder).
create policy "questions_update_product_owner"
on public.questions for update
to authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = questions.product_id
      and p.seller_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.products p
    where p.id = questions.product_id
      and p.seller_id = (select auth.uid())
  )
);

-- DELETE: autor de la pregunta o admin.
create policy "questions_delete_author_or_admin"
on public.questions for delete
to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

-- ============================================================
-- reviews
-- ============================================================
-- SELECT: público.
create policy "reviews_select_all"
on public.reviews for select
to anon, authenticated
using (true);

-- INSERT: comprador con un pedido 'entregado' que contenga el producto.
create policy "reviews_insert_verified_purchase"
on public.reviews for insert
to authenticated
with check (
  buyer_id = (select auth.uid())
  and exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.id = reviews.order_id
      and o.buyer_id = (select auth.uid())
      and o.status = 'entregado'
      and oi.product_id = reviews.product_id
  )
);

-- UPDATE: solo autor, y la fila resultante debe seguir apuntando a una
-- compra 'entregada' válida del mismo producto (evita que editar la reseña
-- sirva para reasignarla a un pedido/producto no verificado).
create policy "reviews_update_own_still_verified"
on public.reviews for update
to authenticated
using (buyer_id = (select auth.uid()))
with check (
  buyer_id = (select auth.uid())
  and exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.id = reviews.order_id
      and o.buyer_id = (select auth.uid())
      and o.status = 'entregado'
      and oi.product_id = reviews.product_id
  )
);

-- DELETE: autor o admin (moderación).
create policy "reviews_delete_author_or_admin"
on public.reviews for delete
to authenticated
using (buyer_id = (select auth.uid()) or public.is_admin());

-- ============================================================
-- favorites
-- ============================================================
create policy "favorites_select_own"
on public.favorites for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "favorites_insert_own"
on public.favorites for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- UPDATE: no contemplado ("—") — un favorito se crea o se borra, no se edita.

create policy "favorites_delete_own"
on public.favorites for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ============================================================
-- product_views
-- ============================================================
-- SELECT: el vendedor del producto (analítica de su catálogo) o admin.
create policy "product_views_select_seller_or_admin"
on public.product_views for select
to authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_views.product_id
      and p.seller_id = (select auth.uid())
  )
  or public.is_admin()
);

-- INSERT: cualquier authenticated, atribuida a sí mismo.
create policy "product_views_insert_own"
on public.product_views for insert
to authenticated
with check (user_id = (select auth.uid()));

-- UPDATE/DELETE: no contemplado ("—") — un evento de vista es inmutable.

-- ============================================================
-- support_articles
-- ============================================================
-- SELECT: público si is_published; admin ve también los borradores
-- (supuesto: necesario para poder moderarlos antes de publicarlos).
create policy "support_articles_select_published_or_admin"
on public.support_articles for select
to anon, authenticated
using (is_published or public.is_admin());

create policy "support_articles_insert_admin"
on public.support_articles for insert
to authenticated
with check (public.is_admin());

create policy "support_articles_update_admin"
on public.support_articles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "support_articles_delete_admin"
on public.support_articles for delete
to authenticated
using (public.is_admin());

-- ============================================================
-- support_tickets
-- ============================================================
-- Bloqueo de columnas: el dueño del ticket solo puede cerrarlo (status =
-- 'cerrado'); admin puede editar libremente (moderación/soporte).
-- Guard `(select auth.uid()) is not null`: misma razón — un backend con
-- service role (o un admin actuando desde ahí) debe poder editar el ticket
-- libremente, igual que ya puede is_admin() vía JWT.
create or replace function public.lock_ticket_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.subject is distinct from old.subject
     or new.channel is distinct from old.channel
     or new.created_at is distinct from old.created_at
     or new.status is distinct from 'cerrado'
  then
    raise exception 'support_tickets: el dueño solo puede cerrar el ticket (status = ''cerrado''); ningún otro campo es editable';
  end if;
  return new;
end;
$$;

create trigger lock_ticket_immutable_fields_trigger
  before update on public.support_tickets
  for each row execute function public.lock_ticket_immutable_fields();

-- SELECT: dueño o admin.
create policy "support_tickets_select_own_or_admin"
on public.support_tickets for select
to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

-- INSERT: dueño.
create policy "support_tickets_insert_own"
on public.support_tickets for insert
to authenticated
with check (user_id = (select auth.uid()));

-- UPDATE: dueño (el trigger restringe a solo cerrar) o admin.
create policy "support_tickets_update_own_or_admin"
on public.support_tickets for update
to authenticated
using (user_id = (select auth.uid()) or public.is_admin())
with check (user_id = (select auth.uid()) or public.is_admin());

-- DELETE: no contemplado ("—").

-- ============================================================
-- ticket_messages
-- ============================================================
-- SELECT/INSERT: dueño del ticket o admin.
create policy "ticket_messages_select_ticket_owner_or_admin"
on public.ticket_messages for select
to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id = ticket_messages.ticket_id
      and (t.user_id = (select auth.uid()) or public.is_admin())
  )
);

create policy "ticket_messages_insert_ticket_owner_or_admin"
on public.ticket_messages for insert
to authenticated
with check (
  exists (
    select 1 from public.support_tickets t
    where t.id = ticket_messages.ticket_id
      and (t.user_id = (select auth.uid()) or public.is_admin())
  )
);

-- UPDATE/DELETE: no contemplado ("—") — un mensaje de ticket es inmutable.

-- ============================================================
-- GRANTs de la Data API (anon / authenticated)
-- ============================================================
-- Lección de ReadHub: RLS sin GRANT produce errores opacos de permiso.
-- Aquí se otorga exactamente lo que la tabla de la spec permite por rol y
-- operación; donde dice "vía función" o "—" (no permitido) NO se otorga —
-- es intencional, no un olvido: así el propio nivel de privilegios SQL
-- refuerza la regla, sin depender solo de que la política RLS no matchee.
grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;

grant select, insert, update, delete on public.cart_items to authenticated;

-- orders: sin insert (solo create_order_from_cart), sin delete.
grant select, update on public.orders to authenticated;

-- order_items: sin insert/update/delete (solo create_order_from_cart).
grant select on public.order_items to authenticated;

grant select on public.questions to anon, authenticated;
grant insert, update, delete on public.questions to authenticated;

grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;

-- favorites: sin update (no aplica).
grant select, insert, delete on public.favorites to authenticated;

-- product_views: sin update/delete (evento inmutable).
grant select, insert on public.product_views to authenticated;

grant select on public.support_articles to anon, authenticated;
grant insert, update, delete on public.support_articles to authenticated;

-- support_tickets: sin delete.
grant select, insert, update on public.support_tickets to authenticated;

-- ticket_messages: sin update/delete (mensaje inmutable).
grant select, insert on public.ticket_messages to authenticated;

-- ================================================================
-- Fuente: 20260821140000_create_storage_buckets.sql (Fase 2.4)
-- ================================================================
-- Fase 2.4 — Storage: buckets y políticas.
--
-- Convención de paths (obligatoria, la valida la política — no la aplicación):
--   product-images/{seller_id}/{product_id}/{n}.{ext}
--   avatars/{user_id}/{n}.{ext}
--
-- (storage.foldername(name))[1] devuelve el PRIMER segmento de carpeta del
-- objeto (todo lo que precede al nombre de archivo, sin incluirlo). Para
-- "b1.../p1.../1.jpg" es 'b1...'; para "u1.../avatar.jpg" es 'u1...'. Se
-- compara contra (select auth.uid())::text — mismo patrón "(select ...)"
-- usado en el resto de las políticas para evitar reevaluación por fila.
--
-- Supuesto (alcance explícito, no adelanta la sesión 3): la política solo
-- verifica que el primer segmento sea el propio auth.uid(); NO valida que
-- {product_id} (segundo segmento) pertenezca realmente a ese vendedor en
-- public.products. Cualquier vendedor autenticado puede escribir bajo su
-- propia carpeta con cualquier product_id como subcarpeta — no hay fuga
-- entre vendedores (cada uno solo escribe bajo su propio uid), solo queda
-- sin verificar la coherencia interna del subpath, que le corresponde a la
-- capa de servicio (product.service.ts, sesión 3) al construir el path al
-- subir la imagen.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ============================================================
-- product-images
-- ============================================================
-- SELECT: bucket público para lectura. El flag `public` en storage.buckets
-- ya sirve los objetos sin auth vía la URL pública (/object/public/...),
-- pero esta política además cubre list()/download() por la API normal
-- (que sí evalúa RLS sobre storage.objects, a diferencia de la URL pública).
create policy "product_images_bucket_select_public"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

-- INSERT/DELETE: solo dentro de la propia carpeta ({seller_id}/...). No
-- se valida el rol 'seller' aquí (storage.objects no conoce public.profiles
-- por diseño de esta política); el flujo de publicar productos de la
-- sesión 3 ya exige seller_id = auth.uid() al crear el producto en la
-- tabla products, que es donde sí se valida el rol.
create policy "product_images_bucket_insert_own_folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "product_images_bucket_delete_own_folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Sin política de UPDATE: el flujo de la galería es subir un archivo nuevo
-- (nombre incremental `{n}.{ext}`) + borrar el que sobra; no hay caso de
-- uso para sobrescribir un objeto existente en el mismo path. El orden de
-- la galería lo gobierna product_images.position (Fase 2.2), no el nombre
-- del archivo en Storage.

-- ============================================================
-- avatars
-- ============================================================
create policy "avatars_bucket_select_public"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'avatars');

create policy "avatars_bucket_insert_own_folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatars_bucket_delete_own_folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Sin política de UPDATE, mismo criterio que product-images: reemplazar un
-- avatar es subir uno nuevo + borrar el anterior (o dejar que conviva hasta
-- que el usuario actualice profiles.avatar_path), no sobrescribir in-place.

-- ================================================================
-- Fuente: 20260826150300_knowledge_embeddings_rls.sql
-- ================================================================
-- Políticas RLS de knowledge_embeddings (Fase 4.1, decisión 1: la IA exige
-- sesión). Mismas convenciones que 20260821130000_create_rls_policies.sql:
-- (select auth.uid()) como initplan, rol explícito por política, GRANTs
-- agrupados al final y omitidos a propósito donde no corresponde.

-- SELECT: solo authenticated, NUNCA anon. Dos razones (documentadas en la
-- spec): (1) evita que la pestaña "Resultados con IA" y los asistentes
-- queden medio-rotos para un anónimo (verían la pestaña pero sin acceso real
-- a los datos); se resuelve mostrando el aviso de login en la UI en vez de
-- exponer la tabla; (2) protege la cuota gratuita mensual de Hugging Face de
-- tráfico anónimo. Los productos inactivos no se filtran aquí: la
-- hidratación contra `products` (vector-search.service, Fase 4.4) descarta
-- los inactivos y las fichas huérfanas.
create policy "knowledge_embeddings_select_authenticated"
on public.knowledge_embeddings for select
to authenticated
using (true);

-- INSERT/UPDATE/DELETE: sin política y sin GRANT (ver abajo). Solo escribe
-- el cliente admin (service role), que bypasea RLS por completo desde
-- embedding.service.ts, invocado únicamente por app/api/v1/reindex/route.ts
-- y scripts/index-all.ts (Fase 4.3) — nunca desde el navegador.

grant select on public.knowledge_embeddings to authenticated;

-- ================================================================
-- Fuente: 20260826180000_grant_service_role_knowledge_access.sql
-- ================================================================
-- GRANTs para service_role — Fase 4.3 (indexación).
--
-- Este proyecto NUNCA otorga privilegios por default (no hay
-- ALTER DEFAULT PRIVILEGES ni un GRANT ALL ON ALL TABLES): cada rol recibe
-- exactamente lo que sus políticas necesitan, tabla por tabla (convención
-- de 20260821130000_create_rls_policies.sql). Hasta esta sesión ningún
-- código usaba el cliente admin (service role) para tocar tablas de
-- dominio — lib/supabase/admin.ts existía pero nada lo llamaba — así que el
-- hueco nunca se manifestó. La Fase 4.1 ya cubrió knowledge_embeddings para
-- anon/authenticated, pero olvidó que service_role BYPASEA RLS, NO los
-- GRANTs: sin esto, embedding.service.ts falla con
-- "permission denied for table products" (42501) al indexar (misma lección
-- de ReadHub que motivó los GRANTs de la Fase 2.3: RLS sin GRANT = error
-- opaco — aquí aplica también al rol que bypasea RLS).
--
-- service_role necesita:
-- * SELECT en products y support_articles: son las fuentes que
--   embedding.service.ts lee para armar el texto a vectorizar.
-- * SELECT en categories: products.categories(name) es un join embebido en
--   esa misma consulta (nombre de categoría → texto del embedding).
-- * ALL en knowledge_embeddings: es el único rol que escribe ahí (Fase 4.1:
--   sin política ni GRANT para authenticated en INSERT/UPDATE/DELETE).
grant select on public.products to service_role;
grant select on public.support_articles to service_role;
grant select on public.categories to service_role;
grant select, insert, update, delete on public.knowledge_embeddings to service_role;
