// Tests de services/order.service.ts (Fase 6.3). Cliente inyectado, sin red.
//
// El checkout es SIMULADO: no hay pasarela de pago en ningún momento del
// proyecto. Todo el trabajo lo hace el RPC `create_order_from_cart`, y este
// service solo lo llama y propaga su error TAL CUAL — por eso el test afirma
// el MENSAJE de Postgres, no un `toThrow()` a secas.

import { describe, expect, it } from "vitest";

import {
  cancelIfPending,
  checkout,
  getOrderById,
  listMyOrders,
} from "@/services/order.service";
import { dbError, hasFilter, mockSupabase } from "@/services/test-utils/supabase-mock";

const USER = "buyer-1";
const ORDER = "order-1";

const filaPedido = {
  id: ORDER,
  buyer_id: USER,
  status: "pendiente",
  // numeric(12,2) viaja como string.
  total: "2418.00",
  created_at: "2026-08-30T10:00:00Z",
  order_items: [
    {
      id: "i1",
      order_id: ORDER,
      product_id: "p1",
      seller_id: "s1",
      quantity: 2,
      price_snapshot: "1209.00",
      title_snapshot: "Laptop Lenovo IdeaPad 3",
    },
  ],
};

describe("checkout", () => {
  it("llama al RPC create_order_from_cart con p_buyer_id y devuelve el id", async () => {
    const supabase = mockSupabase({ rpc: { create_order_from_cart: ORDER } });

    await expect(checkout(USER, supabase)).resolves.toBe(ORDER);
    expect(supabase.rpcCalls()).toEqual([
      { name: "create_order_from_cart", params: { p_buyer_id: USER } },
    ]);
  });

  it("propaga el MENSAJE del RPC, que identifica el producto que falló", async () => {
    const supabase = mockSupabase({
      rpc: {
        create_order_from_cart: dbError(
          "Stock insuficiente para Laptop Lenovo IdeaPad 3: disponible 1, solicitado 2",
          "P0001",
        ),
      },
    });

    // Reescribir este mensaje aquí perdería el nombre del producto y las
    // cantidades: la UI lo muestra tal cual.
    await expect(checkout(USER, supabase)).rejects.toThrow(
      "Stock insuficiente para Laptop Lenovo IdeaPad 3: disponible 1, solicitado 2",
    );
  });

  it("no toca ninguna tabla: todo el trabajo está en la transacción del RPC", async () => {
    const supabase = mockSupabase({ rpc: { create_order_from_cart: ORDER } });

    await checkout(USER, supabase);

    expect(supabase.calls()).toEqual([]);
  });
});

describe("listMyOrders", () => {
  it("convierte total y price_snapshot a number", async () => {
    const supabase = mockSupabase({ orders: { select: [filaPedido] } });

    const [order] = await listMyOrders(USER, supabase);

    expect(order.total).toBe(2418);
    expect(typeof order.total).toBe("number");
    expect(order.items[0].price_snapshot).toBe(1209);
    expect(typeof order.items[0].price_snapshot).toBe("number");
  });

  it("filtra por comprador y ordena del más reciente al más antiguo", async () => {
    const supabase = mockSupabase({ orders: { select: [] } });

    await listMyOrders(USER, supabase);

    const [call] = supabase.calls("orders");
    expect(hasFilter(call.filters, "eq", "buyer_id", USER)).toBe(true);
    expect(call.orders).toEqual([{ column: "created_at", ascending: false }]);
  });

  it("un pedido sin ítems embebidos llega con items vacío, no con null", async () => {
    const supabase = mockSupabase({
      orders: { select: [{ ...filaPedido, order_items: null }] },
    });

    const [order] = await listMyOrders(USER, supabase);

    expect(order.items).toEqual([]);
  });

  it("sin pedidos devuelve lista vacía", async () => {
    await expect(listMyOrders(USER, mockSupabase())).resolves.toEqual([]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ orders: { select: dbError("permission denied", "42501") } });

    await expect(listMyOrders(USER, supabase)).rejects.toThrow("permission denied");
  });
});

describe("getOrderById", () => {
  it("devuelve el pedido con sus totales ya parseados", async () => {
    const supabase = mockSupabase({ orders: { maybeSingle: filaPedido } });

    const order = await getOrderById(ORDER, supabase);

    expect(order?.id).toBe(ORDER);
    expect(order?.total).toBe(2418);
    expect(hasFilter(supabase.filters("orders"), "eq", "id", ORDER)).toBe(true);
  });

  it("un pedido ajeno se trata como inexistente: RLS devuelve null, no error", async () => {
    const supabase = mockSupabase({ orders: { maybeSingle: null } });

    await expect(getOrderById(ORDER, supabase)).resolves.toBeNull();
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ orders: { maybeSingle: dbError("conexión perdida") } });

    await expect(getOrderById(ORDER, supabase)).rejects.toThrow("conexión perdida");
  });
});

describe("cancelIfPending", () => {
  it("escribe 'cancelado' filtrando por id Y por status pendiente", async () => {
    const supabase = mockSupabase({ orders: { update: [{ id: ORDER }] } });

    await expect(cancelIfPending(ORDER, supabase)).resolves.toBe(true);

    expect(supabase.updates("orders")).toEqual([{ status: "cancelado" }]);
    const filtros = supabase.filters("orders");
    // El segundo filtro no es decorativo: evita cancelar uno ya pagado si la
    // pantalla estaba desactualizada.
    expect(hasFilter(filtros, "eq", "id", ORDER)).toBe(true);
    expect(hasFilter(filtros, "eq", "status", "pendiente")).toBe(true);
  });

  it("devuelve false cuando el pedido ya no estaba pendiente (0 filas afectadas)", async () => {
    const supabase = mockSupabase({ orders: { update: [] } });

    await expect(cancelIfPending(ORDER, supabase)).resolves.toBe(false);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ orders: { update: dbError("row-level security", "42501") } });

    await expect(cancelIfPending(ORDER, supabase)).rejects.toThrow("row-level security");
  });
});
