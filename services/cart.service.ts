// Carrito persistente (tabla cart_items).
//
// El carrito guarda producto + cantidad, nunca el precio: el precio que vale
// es el ACTUAL del producto, y solo se congela como snapshot dentro del RPC
// de checkout. Así nadie puede "guardar" un precio viejo dejando el carrito
// abierto.

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProductCondition } from "@/lib/constants/roles";
import { getPublicUrl, PRODUCT_IMAGES_BUCKET } from "@/services/storage.service";

type Client = SupabaseClient<Database>;

export type CartItem = {
  id: string;
  product_id: string;
  quantity: number;
  /**
   * `null` cuando el producto fue desactivado: RLS lo oculta y PostgREST
   * devuelve null en el embed. La UI lo muestra como "ya no disponible".
   */
  product: {
    id: string;
    title: string;
    price: number;
    stock: number;
    is_active: boolean;
    condition: ProductCondition;
    image_url: string | null;
  } | null;
};

const CART_SELECT =
  "id, product_id, quantity, products(id, title, price, stock, is_active, condition, product_images(image_path, position))";

type CartRow = {
  id: string;
  product_id: string;
  quantity: number;
  products:
    | {
        id: string;
        title: string;
        price: number | string;
        stock: number;
        is_active: boolean;
        condition: string;
        product_images: { image_path: string; position: number }[] | null;
      }
    | null;
};

export async function getItems(
  userId: string,
  supabase: Client = createClient(),
): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from("cart_items")
    .select(CART_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as unknown as CartRow[]).map((row) => {
    const p = row.products;
    if (!p) {
      return { id: row.id, product_id: row.product_id, quantity: row.quantity, product: null };
    }
    const images = [...(p.product_images ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    return {
      id: row.id,
      product_id: row.product_id,
      quantity: row.quantity,
      product: {
        id: p.id,
        title: p.title,
        price: Number(p.price),
        stock: p.stock,
        is_active: p.is_active,
        condition: p.condition as ProductCondition,
        image_url: images[0]
          ? getPublicUrl(PRODUCT_IMAGES_BUCKET, images[0].image_path, supabase)
          : null,
      },
    };
  });
}

/**
 * Agrega al carrito.
 *
 * Hay `unique(user_id, product_id)`, así que agregar dos veces el mismo
 * producto SUMA la cantidad en vez de crear otra fila. El total se limita al
 * stock para no llevar al usuario a un checkout que va a fallar.
 */
export async function addItem(
  userId: string,
  productId: string,
  quantity: number,
  supabase: Client = createClient(),
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();
  if (readError) throw readError;

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("stock")
    .eq("id", productId)
    .single();
  if (productError) throw productError;

  const desired = (existing?.quantity ?? 0) + quantity;
  const capped = Math.max(1, Math.min(desired, product.stock));

  if (existing) {
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: capped })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("cart_items")
    .insert({ user_id: userId, product_id: productId, quantity: capped });
  if (error) throw error;
}

export async function updateQuantity(
  itemId: string,
  quantity: number,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .update({ quantity: Math.max(1, quantity) })
    .eq("id", itemId);
  if (error) throw error;
}

export async function removeItem(
  itemId: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function clear(
  userId: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}
