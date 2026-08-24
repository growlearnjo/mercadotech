"use client";

import * as React from "react";

import * as cartService from "@/services/cart.service";
import type { CartItem } from "@/services/cart.service";
import { checkout as checkoutOrder } from "@/services/order.service";

/**
 * Estado del carrito compartido entre TODOS los `useCart()`.
 *
 * El carrito se consume desde dos sitios a la vez: el contador del navbar y la
 * pantalla que lo modifica (ficha de producto, /carrito). Con estado local por
 * hook, agregar un producto no actualizaba el contador hasta recargar. Un
 * store a nivel de módulo + `useSyncExternalStore` mantiene el mismo API del
 * hook y sincroniza a todos los consumidores sin envolver la app en un
 * provider.
 */
type CartState = {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  /** Usuario cuyo carrito está cargado; null = sin sesión. */
  userId: string | null;
};

let state: CartState = { items: [], loading: true, error: null, userId: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<CartState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
/** En el servidor no hay carrito que mostrar: se sirve un estado vacío estable. */
const SERVER_STATE: CartState = {
  items: [],
  loading: false,
  error: null,
  userId: null,
};
const getServerSnapshot = () => SERVER_STATE;

/** Evita relanzar la misma carga desde cada consumidor montado a la vez. */
let inFlight: Promise<void> | null = null;

async function loadCart(userId: string | null) {
  if (!userId) {
    setState({ items: [], loading: false, userId: null });
    return;
  }
  if (inFlight) return inFlight;
  setState({ loading: true, error: null, userId });
  inFlight = cartService
    .getItems(userId)
    .then((items) => setState({ items, loading: false }))
    .catch(() => setState({ error: "No pudimos cargar tu carrito.", loading: false }))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function useCart(userId: string | null) {
  const snapshot = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Carga (o vacía) el carrito cuando cambia la sesión.
  React.useEffect(() => {
    if (snapshot.userId === userId && !snapshot.loading) return;
    void loadCart(userId);
    // `snapshot` fuera de deps a propósito: solo interesa reaccionar al usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const reload = React.useCallback(() => loadCart(userId), [userId]);

  const add = React.useCallback(
    async (productId: string, quantity: number) => {
      if (!userId) return false;
      try {
        await cartService.addItem(userId, productId, quantity);
        await loadCart(userId);
        return true;
      } catch {
        setState({ error: "No pudimos agregar el producto." });
        return false;
      }
    },
    [userId],
  );

  const update = React.useCallback(
    async (itemId: string, quantity: number) => {
      try {
        await cartService.updateQuantity(itemId, quantity);
        setState({
          items: state.items.map((i) =>
            i.id === itemId ? { ...i, quantity } : i,
          ),
        });
      } catch {
        setState({ error: "No pudimos actualizar la cantidad." });
        void loadCart(userId);
      }
    },
    [userId],
  );

  const remove = React.useCallback(async (itemId: string) => {
    try {
      await cartService.removeItem(itemId);
      setState({ items: state.items.filter((i) => i.id !== itemId) });
    } catch {
      setState({ error: "No pudimos quitar el producto." });
    }
  }, []);

  /**
   * Checkout. Devuelve el id del pedido, o lanza con el mensaje del RPC.
   *
   * Tras un fallo se RECARGA el carrito: el motivo típico es que el stock
   * cambió mientras tanto, así que lo que hay en pantalla ya no es cierto.
   */
  const checkout = React.useCallback(async (): Promise<string> => {
    if (!userId) throw new Error("Necesitas iniciar sesión.");
    try {
      const orderId = await checkoutOrder(userId);
      // El RPC ya vació el carrito; basta con refrescar.
      await loadCart(userId);
      return orderId;
    } catch (err) {
      await loadCart(userId);
      throw err;
    }
  }, [userId]);

  // El subtotal usa el precio ACTUAL del producto; el snapshot se fija dentro
  // del RPC, así que hasta el checkout este número puede cambiar.
  const subtotal = snapshot.items.reduce(
    (sum, item) => sum + (item.product ? item.product.price * item.quantity : 0),
    0,
  );
  const count = snapshot.items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items: snapshot.items,
    subtotal,
    count,
    loading: snapshot.loading,
    error: snapshot.error,
    add,
    update,
    remove,
    checkout,
    reload,
  };
}
