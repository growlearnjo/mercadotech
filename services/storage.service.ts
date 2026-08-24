// Resolución de URLs públicas de Supabase Storage.
//
// Nace en la Fase 3.4 con lo mínimo (decisión 4 de la spec): las imágenes de
// producto se muestran desde la 3.4, aunque la subida no llegue hasta la 3.7.
// Esta última la ampliará con upload/remove.

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { MIME_EXTENSION } from "@/lib/constants/product";

type Client = SupabaseClient<Database>;

/** Buckets creados en la migración de Storage (Fase 2.4). */
export const PRODUCT_IMAGES_BUCKET = "product-images";
export const AVATARS_BUCKET = "avatars";

/**
 * URL pública de un objeto.
 *
 * `getPublicUrl` es puramente sintáctico: construye la URL, no comprueba que
 * el objeto exista. Por eso las imágenes del seed —que no están subidas—
 * devuelven una URL válida que luego da 404, y por eso todo `<Image>` de
 * producto pasa por `ProductImage`, que degrada a placeholder.
 */
export function getPublicUrl(
  bucket: string,
  path: string,
  supabase: Client = createClient(),
): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Sube una imagen de producto.
 *
 * El path es `{seller_id}/{product_id}/{n}.{ext}` porque la política RLS del
 * bucket comprueba que la PRIMERA carpeta sea el id del vendedor: por eso no
 * se puede subir nada antes de conocer el `product_id` (decisión 12).
 */
export async function uploadProductImage(
  file: File,
  sellerId: string,
  productId: string,
  n: number,
  supabase: Client = createClient(),
): Promise<string> {
  const ext = MIME_EXTENSION[file.type] ?? "jpg";
  const path = `${sellerId}/${productId}/${n}.${ext}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  return path;
}

/** Borra la imagen del bucket y su fila en `product_images`. */
export async function deleteProductImage(
  imageId: string,
  path: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([path]);
  if (storageError) throw storageError;

  const { error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId);
  if (error) throw error;
}

/**
 * Persiste el orden de la galería.
 *
 * Se envían las filas COMPLETAS y no solo `{id, position}`: un upsert parcial
 * dejaría `product_id` e `image_path` a null y violaría sus NOT NULL.
 */
export async function saveImageOrder(
  items: { id: string; product_id: string; image_path: string; position: number }[],
  supabase: Client = createClient(),
): Promise<void> {
  if (items.length === 0) return;
  const { error } = await supabase.from("product_images").upsert(items);
  if (error) throw error;
}

/** Inserta la fila de una imagen recién subida. */
export async function insertProductImage(
  productId: string,
  imagePath: string,
  position: number,
  supabase: Client = createClient(),
): Promise<{ id: string; product_id: string; image_path: string; position: number }> {
  const { data, error } = await supabase
    .from("product_images")
    .insert({ product_id: productId, image_path: imagePath, position })
    .select()
    .single();
  if (error) throw error;
  return data;
}
