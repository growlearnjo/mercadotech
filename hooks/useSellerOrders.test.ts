// Tests de la regla de transición del kanban (Fase 6.3, decisión 4).
//
// DÓNDE VIVE LA REGLA: en el HOOK, no en `seller.service`. La RLS acepta
// cualquier destino de la lista permitida y NO comprueba la secuencia
// (aceptaría `entregado → pagado`); quien impone el orden es
// `validateTransition`. Por eso el test está aquí y no junto al service.
//
// SIN REACT: la regla es lógica pura, así que se prueba llamándola directo.
// No hace falta `renderHook` ni jsdom (decisión 6: esta sesión no monta
// componentes). El único cambio de producción fue agregarle `export`.

import { describe, expect, it } from "vitest";

import { validateTransition } from "@/hooks/useSellerOrders";
import { ORDER_STATUS_FLOW } from "@/lib/constants/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants/roles";

/** Los 3 pasos válidos del flujo, derivados del array real, no escritos a mano. */
const PASOS_VALIDOS = ORDER_STATUS_FLOW.slice(0, -1).map(
  (from, index) => [from, ORDER_STATUS_FLOW[index + 1]] as const,
);

describe("validateTransition — los pasos del flujo", () => {
  it("hay exactamente 3 pasos: pendiente → pagado → enviado → entregado", () => {
    expect(PASOS_VALIDOS).toEqual([
      ["pendiente", "pagado"],
      ["pagado", "enviado"],
      ["enviado", "entregado"],
    ]);
  });

  it.each(PASOS_VALIDOS)("acepta avanzar de %s a %s", (from, to) => {
    expect(validateTransition(from, to)).toEqual({ ok: true });
  });

  it.each(PASOS_VALIDOS)("rechaza retroceder de %s a %s", (from, to) => {
    const result = validateTransition(to, from);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("avanza de a un paso");
  });

  it("rechaza saltarse un paso, aunque el destino esté 'más adelante'", () => {
    const result = validateTransition("pendiente", "entregado");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // El mensaje nombra el único destino posible, para que el toast sea útil.
      expect(result.message).toContain('de "pendiente" solo puede pasar a "pagado"');
    }
  });

  it("rechaza el salto de pagado a entregado", () => {
    expect(validateTransition("pagado", "entregado").ok).toBe(false);
  });

  it("soltar la tarjeta en su misma columna no es un error", () => {
    for (const status of ORDER_STATUSES) {
      expect(validateTransition(status, status)).toEqual({ ok: true });
    }
  });
});

describe("validateTransition — cancelado", () => {
  it("un pedido cancelado no se reactiva hacia ningún estado", () => {
    for (const to of ORDER_STATUS_FLOW) {
      const result = validateTransition("cancelado", to);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe("Un pedido cancelado no se puede reactivar.");
      }
    }
  });

  it("el vendedor no puede cancelar: cancelado no es destino suyo", () => {
    for (const from of ORDER_STATUS_FLOW) {
      const result = validateTransition(from, "cancelado");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe("Solo el comprador puede cancelar un pedido.");
      }
    }
  });

  it("cancelado no forma parte de ORDER_STATUS_FLOW: es una salida lateral", () => {
    expect(ORDER_STATUS_FLOW as readonly string[]).not.toContain("cancelado");
  });

  it("comportamiento actual, revisar: cancelado → cancelado se considera válido", () => {
    // La rama `from === to` devuelve ok ANTES de comprobar `cancelado`. Es
    // inalcanzable desde la UI (soltar una tarjeta en su propia columna no
    // dispara ningún cambio), así que el test ancla el código real en vez de
    // "corregirlo" — la decisión de tocarlo es aparte.
    expect(validateTransition("cancelado", "cancelado")).toEqual({ ok: true });
  });
});

describe("validateTransition — estados desconocidos", () => {
  it.each([["pendiente", "en_camino"], ["devuelto", "entregado"]])(
    "rechaza la transición %s → %s con 'Estado no válido.'",
    (from, to) => {
      const result = validateTransition(from as OrderStatus, to as OrderStatus);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe("Estado no válido.");
    },
  );
});
