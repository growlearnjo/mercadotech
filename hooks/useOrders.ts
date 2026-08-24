"use client";

import * as React from "react";

import * as orderService from "@/services/order.service";
import type { Order } from "@/types/order";

/** Lista de pedidos del comprador. */
export function useOrders(userId: string | null) {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    if (!userId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    orderService
      .listMyOrders(userId)
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch(() => {
        if (active) setError("No pudimos cargar tus pedidos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, reloadToken]);

  return { orders, loading, error, retry: () => setReloadToken((t) => t + 1) };
}

/** Detalle de un pedido + cancelación. */
export function useOrder(orderId: string) {
  const [order, setOrder] = React.useState<Order | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    orderService
      .getOrderById(orderId)
      .then((data) => {
        if (!active) return;
        setOrder(data);
        // RLS devuelve null para un pedido ajeno: indistinguible de "no existe",
        // y así debe ser (no se filtra la existencia de pedidos de otros).
        if (!data) setError("Este pedido no existe o no es tuyo.");
      })
      .catch(() => {
        if (active) setError("No pudimos cargar el pedido.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId, reloadToken]);

  const cancel = React.useCallback(async () => {
    try {
      const done = await orderService.cancelIfPending(orderId);
      setReloadToken((t) => t + 1);
      return done;
    } catch {
      setError("No pudimos cancelar el pedido.");
      return false;
    }
  }, [orderId]);

  return { order, loading, error, cancel, retry: () => setReloadToken((t) => t + 1) };
}
