// Favoritos del comprador.

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Product } from "@/types/product";
import { getPublicUrl, PRODUCT_IMAGES_BUCKET } from "@/services/storage.service";
import type { ProductCondition } from "@/lib/constants/roles";

type Client = SupabaseClient<Database>;

export async function isFavorite(
  productId: string,
  userId: string,
  supabase: Client = createClient(),
): Promise<boolean> {
  const { data, error } = await supabase
    .from("favorites")
    .select("id")
    .eq("product_id", productId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * Alterna el favorito y devuelve el estado resultante.
 *
 * Se resuelve en dos pasos (leer y luego insertar/borrar) en vez de un upsert
 * porque la tabla no tiene un "toggle" natural: el estado es la existencia de
 * la fila.
 */
export async function toggle(
  productId: string,
  userId: string,
  supabase: Client = createClient(),
): Promise<boolean> {
  const already = await isFavorite(productId, userId, supabase);

  if (already) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("product_id", productId)
      .eq("user_id", userId);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase
    .from("favorites")
    .insert({ product_id: productId, user_id: userId });
  if (error) throw error;
  return true;
}

/** Productos marcados por el usuario, listos para pintar como cards. */
export async function listMine(
  userId: string,
  supabase: Client = createClient(),
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("favorites")
    .select(
      "created_at, products(*, product_images(image_path, position), reviews(rating))",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  type Row = {
    products:
      | (Database["public"]["Tables"]["products"]["Row"] & {
          product_images: { image_path: string; position: number }[] | null;
          reviews: { rating: number }[] | null;
        })
      | null;
  };

  return ((data ?? []) as unknown as Row[])
    // Un producto desactivado desaparece por RLS y llega como null: se omite
    // en vez de pintar una card vacía.
    .filter((row): row is Row & { products: NonNullable<Row["products"]> } =>
      row.products !== null,
    )
    .map(({ products: p }) => {
      const images = [...(p.product_images ?? [])].sort(
        (a, b) => a.position - b.position,
      );
      const ratings = (p.reviews ?? []).map((r) => r.rating);
      const {
        product_images: _images,
        reviews: _reviews,
        ...rest
      } = p;
      return {
        ...rest,
        price: Number(p.price),
        condition: p.condition as ProductCondition,
        image_url: images[0]
          ? getPublicUrl(PRODUCT_IMAGES_BUCKET, images[0].image_path, supabase)
          : null,
        average_rating:
          ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
            : null,
        review_count: ratings.length,
      };
    });
}
