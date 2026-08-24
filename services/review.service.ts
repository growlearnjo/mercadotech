// Reseñas verificadas.
//
// "Verificada" no es una etiqueta decorativa: el esquema exige `order_id`, y
// la política RLS lo cruza con un pedido `entregado` del comprador que
// contenga ese producto. Sin compra no hay reseña, por construcción.

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Review } from "@/types/review";

type Client = SupabaseClient<Database>;

/**
 * Etiqueta del autor.
 *
 * Decisión 8 de la spec: `profiles` solo es legible por su dueño o un admin,
 * así que NO se puede mostrar el nombre real de quien reseñó. Mostrar nombres
 * exigiría una vista `public_profiles` (migración nueva), fuera de alcance.
 */
const AUTHOR_LABEL = "Comprador verificado";

export async function listByProduct(
  productId: string,
  supabase: Client = createClient(),
): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, author_label: AUTHOR_LABEL }));
}

/** Promedio y número de reseñas de un producto. */
export async function getAverage(
  productId: string,
  supabase: Client = createClient(),
): Promise<{ average: number | null; count: number }> {
  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("product_id", productId);
  if (error) throw error;

  const ratings = (data ?? []).map((row) => row.rating);
  if (ratings.length === 0) return { average: null, count: 0 };
  return {
    average: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
    count: ratings.length,
  };
}

export type CanReviewResult = {
  allowed: boolean;
  /** Pedido entregado que habilita la reseña; se envía en `create`. */
  orderId: string | null;
  /** Motivo por el que no se puede, para explicarlo en la UI. */
  reason: "sin_compra" | "ya_resenado" | null;
};

/**
 * ¿Puede este usuario reseñar este producto?
 *
 * Busca un pedido suyo en estado `entregado` que incluya el producto y
 * comprueba que aún no haya dejado reseña (hay unique por comprador/producto).
 * Es defensa en profundidad: la RLS lo garantiza igualmente, pero así la UI
 * no ofrece un formulario que va a fallar.
 */
export async function canReview(
  productId: string,
  userId: string,
  supabase: Client = createClient(),
): Promise<CanReviewResult> {
  const { data: existing, error: existingError } = await supabase
    .from("reviews")
    .select("id")
    .eq("product_id", productId)
    .eq("buyer_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { allowed: false, orderId: null, reason: "ya_resenado" };

  const { data, error } = await supabase
    .from("order_items")
    .select("order_id, orders!inner(status, buyer_id)")
    .eq("product_id", productId)
    .eq("orders.buyer_id", userId)
    .eq("orders.status", "entregado")
    .limit(1);
  if (error) throw error;

  const orderId = data?.[0]?.order_id ?? null;
  return orderId
    ? { allowed: true, orderId, reason: null }
    : { allowed: false, orderId: null, reason: "sin_compra" };
}

export async function create(
  params: {
    productId: string;
    orderId: string;
    buyerId: string;
    rating: number;
    comment: string | null;
  },
  supabase: Client = createClient(),
): Promise<Review> {
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      product_id: params.productId,
      order_id: params.orderId,
      buyer_id: params.buyerId,
      rating: params.rating,
      comment: params.comment,
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, author_label: AUTHOR_LABEL };
}
