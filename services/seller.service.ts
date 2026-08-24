// Operaciones del vendedor sobre sus productos y pedidos.

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type { SellerOrder } from "@/types/order";
import type { Product } from "@/types/product";
import type { SellerOrder } from "@/types/order";
import type { OrderStatus, ProductCondition } from "@/lib/constants/roles";
import { getPublicUrl, PRODUCT_IMAGES_BUCKET } from "@/services/storage.service";

type Client = SupabaseClient<Database>;

/** Error de FK cuando el producto ya tiene ventas (decisión 10). */
export class ProductHasSalesError extends Error {
  constructor() {
    super("Este producto tiene ventas; desactívalo en lugar de eliminarlo.");
    this.name = "ProductHasSalesError";
  }
}

const SELLER_PRODUCT_SELECT =
  "*, product_images(image_path, position), reviews(rating)";

type SellerProductRow = Database["public"]["Tables"]["products"]["Row"] & {
  product_images: { image_path: string; position: number }[] | null;
  reviews: { rating: number }[] | null;
};

function toProduct(row: SellerProductRow, supabase: Client): Product {
  const images = [...(row.product_images ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const ratings = (row.reviews ?? []).map((r) => r.rating);
  const { product_images: _images, reviews: _reviews, ...rest } = row;
  return {
    ...rest,
    price: Number(row.price),
    condition: row.condition as ProductCondition,
    image_url: images[0]
      ? getPublicUrl(PRODUCT_IMAGES_BUCKET, images[0].image_path, supabase)
      : null,
    average_rating:
      ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : null,
    review_count: ratings.length,
  };
}

/**
 * Productos del vendedor, INCLUIDOS los inactivos.
 *
 * No se filtra por `is_active` a propósito: la RLS deja al dueño ver los
 * suyos aunque estén despublicados, y en su panel debe verlos para poder
 * reactivarlos.
 */
export async function listMyProducts(
  sellerId: string,
  supabase: Client = createClient(),
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(SELLER_PRODUCT_SELECT)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as SellerProductRow[]).map((row) =>
    toProduct(row, supabase),
  );
}

export type ProductPayload = {
  title: string;
  description: string | null;
  brand: string | null;
  category_id: string;
  condition: ProductCondition;
  price: number;
  stock: number;
};

export async function createProduct(
  sellerId: string,
  payload: ProductPayload,
  supabase: Client = createClient(),
): Promise<string> {
  const { data, error } = await supabase
    .from("products")
    .insert({ ...payload, seller_id: sellerId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateProduct(
  productId: string,
  payload: Partial<ProductPayload>,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", productId);
  if (error) throw error;
}

export async function toggleActive(
  productId: string,
  isActive: boolean,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId);
  if (error) throw error;
}

/**
 * Elimina un producto.
 *
 * `order_items.product_id` es `on delete restrict`: si el producto se vendió
 * alguna vez, Postgres lo rechaza con 23503. Se traduce a un error propio
 * para que la UI sugiera desactivar en vez de mostrar jerga de base de datos.
 */
export async function deleteProduct(
  productId: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) {
    if (error.code === "23503") throw new ProductHasSalesError();
    throw error;
  }
}

/**
 * Pedidos que contienen algún ítem de este vendedor.
 *
 * Se parte de `order_items` y no de `orders` porque la relación relevante es
 * "mis ítems": un pedido puede tener productos de varios vendedores y cada uno
 * debe ver solo los suyos.
 */
export async function listMyOrders(
  sellerId: string,
  supabase: Client = createClient(),
): Promise<SellerOrder[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, order_id, title_snapshot, quantity, price_snapshot, orders!inner(id, status, created_at)",
    )
    .eq("seller_id", sellerId);
  if (error) throw error;

  type Row = {
    id: string;
    order_id: string;
    title_snapshot: string;
    quantity: number;
    price_snapshot: number | string;
    orders: { id: string; status: string; created_at: string };
  };

  const byOrder = new Map<string, SellerOrder>();
  for (const row of (data ?? []) as unknown as Row[]) {
    const existing = byOrder.get(row.order_id);
    const item = {
      id: row.id,
      title_snapshot: row.title_snapshot,
      quantity: row.quantity,
      price_snapshot: Number(row.price_snapshot),
    };
    if (existing) {
      existing.items.push(item);
      existing.myTotal += item.price_snapshot * item.quantity;
    } else {
      byOrder.set(row.order_id, {
        id: row.order_id,
        status: row.orders.status as OrderStatus,
        created_at: row.orders.created_at,
        items: [item],
        myTotal: item.price_snapshot * item.quantity,
      });
    }
  }

  return [...byOrder.values()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

/**
 * Cambia el estado de un pedido.
 *
 * LIMITACIÓN DEL MODELO: el estado vive en `orders`, no en `order_items`, así
 * que en un pedido con varios vendedores mover la tarjeta afecta al pedido
 * COMPLETO, no solo a los ítems propios. Resolverlo exigiría un estado por
 * ítem — cambio de esquema fuera del alcance de esta sesión.
 *
 * La RLS solo admite pagado/enviado/entregado (el vendedor no puede cancelar)
 * y NO valida la secuencia: eso lo hace el hook.
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);
  if (error) throw error;
}
