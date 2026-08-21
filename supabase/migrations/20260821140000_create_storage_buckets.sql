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
