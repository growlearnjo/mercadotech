// Tests de lib/utils.ts (Fase 6.2).
//
// El archivo exporta SOLO `cn` y `formatPrice` (decisión 3 de la spec): no
// hay formateo de fechas en el proyecto, así que no se testea.
//
// `formatPrice` acepta string a propósito: las columnas numeric(12,2)
// (price, total, price_snapshot) llegan como string desde PostgREST, y las
// aserciones de dinero de los E2E se hacen contra ESTE formato.

import { describe, expect, it } from "vitest";

import { cn, formatPrice } from "@/lib/utils";

/**
 * Intl separa el símbolo del monto con un ESPACIO DURO (U+00A0), no con un
 * espacio normal — invisible al leer, letal al comparar. Se nombra aquí para
 * que las aserciones digan la verdad sobre el formato real, que es el mismo
 * que los E2E de la Fase 6.5 verán en pantalla.
 */
const NBSP = "\u00A0";

describe("formatPrice", () => {
  it("usa espacio duro entre el símbolo y el monto, no un espacio normal", () => {
    expect(formatPrice(0)).toBe(`S/${NBSP}0.00`);
    expect(formatPrice(0)).not.toBe("S/ 0.00");
  });

  it("formatea 0 sin caer en 'S/ NaN'", () => {
    expect(formatPrice(0)).toBe(`S/${NBSP}0.00`);
  });

  it("siempre muestra 2 decimales, aunque el número no los tenga", () => {
    expect(formatPrice(219)).toBe(`S/${NBSP}219.00`);
    expect(formatPrice(219.5)).toBe(`S/${NBSP}219.50`);
  });

  it("separa los miles con coma", () => {
    expect(formatPrice(1299.9)).toBe(`S/${NBSP}1,299.90`);
    expect(formatPrice(1234567.89)).toBe(`S/${NBSP}1,234,567.89`);
  });

  it("redondea a 2 decimales en vez de truncar", () => {
    expect(formatPrice(1299.905)).toBe(`S/${NBSP}1,299.91`);
    expect(formatPrice(0.994)).toBe(`S/${NBSP}0.99`);
  });

  it("acepta el string que llega de PostgREST igual que el number", () => {
    // numeric(12,2) viaja como "219.00" en el JSON de PostgREST.
    expect(formatPrice("219.00")).toBe(formatPrice(219));
    expect(formatPrice("1299.9")).toBe(`S/${NBSP}1,299.90`);
  });

  it("degrada a S/ 0.00 ante un dato sucio en vez de romper la pantalla", () => {
    expect(formatPrice("no-es-un-precio")).toBe(`S/${NBSP}0.00`);
    expect(formatPrice("")).toBe(`S/${NBSP}0.00`);
    expect(formatPrice(Number.NaN)).toBe(`S/${NBSP}0.00`);
    expect(formatPrice(Number.POSITIVE_INFINITY)).toBe(`S/${NBSP}0.00`);
  });

  it("formatea negativos con el signo delante del símbolo", () => {
    expect(formatPrice(-5)).toBe(`-S/${NBSP}5.00`);
  });
});

describe("cn", () => {
  it("concatena clases sueltas", () => {
    expect(cn("rounded", "border")).toBe("rounded border");
  });

  it("descarta los valores falsy del patrón condicional", () => {
    const activo = false;
    expect(cn("base", activo && "activo", undefined, null)).toBe("base");
  });

  it("aplana arrays y objetos, la parte clsx", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });

  it("resuelve el conflicto de Tailwind quedándose con la última, la parte twMerge", () => {
    // Sin twMerge quedarían las dos y ganaría el orden del CSS, no el del
    // llamador: es el motivo de que `cn` exista en vez de un template string.
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm text-muted-foreground", "text-base")).toBe(
      "text-muted-foreground text-base",
    );
  });
});
