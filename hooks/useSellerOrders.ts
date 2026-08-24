"use client";

import * as React from "react";

import * as sellerService from "@/services/seller.service";
import type { SellerOrder } from "@/services/seller.service";
import { ORDER_STATUS_FLOW } from "@/lib/constants/orders";
import type { OrderStatus } from "@/lib/constants/roles";

export type MoveResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * ¿Es válido mover de `from` a `to`?
 *
 * La RLS acepta cualquier destino de la lista permitida y NO comprueba el
 * orden: aceptaría `entregado → pagado`. Esa regla de negocio la impone el
 * hook, que es donde la spec la coloca.
 */
function validateTransition(
  from: OrderStatus,
  to: OrderStatus,
): MoveResult {
  if (from === to) return { ok: true };
  if (from === "cancelado") {
    return { ok: false, message: "Un pedido cancelado no se puede reactivar." };
  }
  if (to === "cancelado") {
    return {
      ok: false,
      message: "Solo el comprador puede cancelar un pedido.",
    };
  }
  const fromIndex = ORDER_STATUS_FLOW.indexOf(from as (typeof ORDER_STATUS_FLOW)[number]);
  const toIndex = ORDER_STATUS_FLOW.indexOf(to as (typeof ORDER_STATUS_FLOW)[number]);
  if (fromIndex === -1 || toIndex === -1) {
    return { ok: false, message: "Estado no válido." };
  }
  if (toIndex !== fromIndex + 1) {
    return {
      ok: false,
      message: `Un pedido avanza de a un paso: de "${from}" solo puede pasar a "${ORDER_STATUS_FLOW[fromIndex + 1] ?? "—"}".`,
    };
  }
  return { ok: true };
}

export function useSellerOrders(sellerId: string | null) {
  const [orders, setOrders] = React.useState<SellerOrder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    if (!sellerId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    sellerService
      .listMyOrders(sellerId)
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch(() => {
        if (active) setError("No pudimos cargar los pedidos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sellerId, reloadToken]);

  const move = React.useCallback(
    async (orderId: string, to: OrderStatus): Promise<MoveResult> => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return { ok: false, message: "Pedido no encontrado." };

      const check = validateTransition(order.status, to);
      if (!check.ok) return check;
      if (order.status === to) return { ok: true };

      // Optimista: la tarjeta salta de columna al soltar.
      const previous = orders;
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: to } : o)),
      );
      try {
        await sellerService.updateOrderStatus(orderId, to);
        return { ok: true };
      } catch {
        setOrders(previous);
        return { ok: false, message: "No pudimos actualizar el pedido." };
      }
    },
    [orders],
  );

  /** Pedidos agrupados por estado, para las columnas del kanban. */
  const byStatus = React.useMemo(() => {
    const groups: Record<OrderStatus, SellerOrder[]> = {
      pendiente: [],
      pagado: [],
      enviado: [],
      entregado: [],
      cancelado: [],
    };
    for (const order of orders) groups[order.status]?.push(order);
    return groups;
  }, [orders]);

  return {
    orders,
    byStatus,
    loading,
    error,
    move,
    reload: () => setReloadToken((t) => t + 1),
  };
}
