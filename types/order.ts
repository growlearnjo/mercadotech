// Tipos de dominio de pedidos.
import type { Database } from "@/types/database";
import type { OrderStatus } from "@/lib/constants/roles";

/**
 * Línea de un pedido. `price_snapshot` y `title_snapshot` congelan el precio y
 * el título al momento de la compra: el pedido no debe cambiar si el vendedor
 * edita el producto después. `price_snapshot` es `numeric` → ya parseado.
 */
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"] & {
  price_snapshot: number;
};

/**
 * Pedido con sus líneas. `total` es `numeric` (ya parseado) y `status` se
 * estrecha a la unión de `lib/constants/roles.ts`, que refleja el CHECK de la
 * migración.
 */
export type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  total: number;
  status: OrderStatus;
  items: OrderItem[];
};

/**
 * Pedido visto desde el panel del VENDEDOR.
 *
 * Solo trae los ítems de ese vendedor y su propio total, porque un pedido
 * puede incluir productos de varios. Vive aquí y no en `seller.service` para
 * que los componentes del kanban puedan tiparse sin importar un service
 * (regla de capas del CLAUDE.md).
 */
export type SellerOrder = {
  id: string;
  status: OrderStatus;
  created_at: string;
  items: {
    id: string;
    title_snapshot: string;
    quantity: number;
    price_snapshot: number;
  }[];
  /** Suma de los ítems propios, NO `orders.total`. */
  myTotal: number;
};
