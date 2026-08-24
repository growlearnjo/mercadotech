// Pedidos del comprador.
//
// El checkout es SIMULADO: no hay pasarela de pago ni se pide ningún dato de
// tarjeta. `create_order_from_cart` crea el pedido en estado 'pendiente',
// congela precios y títulos como snapshots, descuenta stock y vacía el
// carrito, todo en una transacción.

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Order, OrderItem } from "@/types/order";
import type { OrderStatus } from "@/lib/constants/roles";

type Client = SupabaseClient<Database>;

const ORDER_SELECT =
  "*, order_items(id, order_id, product_id, seller_id, quantity, price_snapshot, title_snapshot)";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items:
    | (Database["public"]["Tables"]["order_items"]["Row"] & {
        price_snapshot: number | string;
      })[]
    | null;
};

function toOrder(row: OrderRow): Order {
  return {
    ...row,
    total: Number(row.total),
    status: row.status as OrderStatus,
    items: (row.order_items ?? []).map((item) => ({
      ...item,
      price_snapshot: Number(item.price_snapshot),
    })) as OrderItem[],
  };
}

/**
 * Checkout simulado.
 *
 * El error del RPC se propaga TAL CUAL: el mensaje de Postgres ya identifica
 * el producto concreto que falló ("Stock insuficiente para X: disponible N,
 * solicitado M"), y reescribirlo aquí perdería esa información.
 */
export async function checkout(
  userId: string,
  supabase: Client = createClient(),
): Promise<string> {
  const { data, error } = await supabase.rpc("create_order_from_cart", {
    p_buyer_id: userId,
  });
  if (error) throw error;
  return data as string;
}

export async function listMyOrders(
  userId: string,
  supabase: Client = createClient(),
): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as OrderRow[]).map(toOrder);
}

/** Un pedido. RLS devuelve null si no es del usuario: se trata como no existe. */
export async function getOrderById(
  orderId: string,
  supabase: Client = createClient(),
): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return toOrder(data as unknown as OrderRow);
}

/**
 * Cancela un pedido que siga pendiente.
 *
 * El `eq('status','pendiente')` no es decorativo: evita cancelar uno ya pagado
 * si la pantalla estaba desactualizada. La RLS lo bloquearía igualmente.
 *
 * OJO (decisión 11): cancelar NO repone el stock — no hay trigger para eso y
 * está fuera del alcance de esta sesión. La UI lo advierte.
 */
export async function cancelIfPending(
  orderId: string,
  supabase: Client = createClient(),
): Promise<boolean> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "cancelado" })
    .eq("id", orderId)
    .eq("status", "pendiente")
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
