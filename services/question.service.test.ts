// Tests de services/question.service.ts (Fase 6.3). Cliente inyectado.
//
// Caso feliz + error propagado por cada función pública, más lo único que
// este service decide por su cuenta: la marca de tiempo de la respuesta.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { answer, create, listByProduct } from "@/services/question.service";
import { dbError, hasFilter, mockSupabase } from "@/services/test-utils/supabase-mock";

const PRODUCT = "p1";
const USER = "u1";

describe("listByProduct", () => {
  it("devuelve las preguntas del producto, las más recientes primero", async () => {
    const supabase = mockSupabase({
      questions: { select: [{ id: "q1", product_id: PRODUCT, question: "¿Tiene garantía?" }] },
    });

    const questions = await listByProduct(PRODUCT, supabase);

    expect(questions).toHaveLength(1);
    const [call] = supabase.calls("questions");
    expect(hasFilter(call.filters, "eq", "product_id", PRODUCT)).toBe(true);
    expect(call.orders).toEqual([{ column: "created_at", ascending: false }]);
  });

  it("sin preguntas devuelve lista vacía, no null", async () => {
    await expect(listByProduct(PRODUCT, mockSupabase())).resolves.toEqual([]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ questions: { select: dbError("boom") } });

    await expect(listByProduct(PRODUCT, supabase)).rejects.toThrow("boom");
  });
});

describe("create", () => {
  it("inserta producto, autor y texto, y devuelve la fila creada", async () => {
    const fila = { id: "q-nueva", product_id: PRODUCT, user_id: USER, question: "¿Es original?" };
    const supabase = mockSupabase({ questions: { single: fila } });

    await expect(create(PRODUCT, USER, "¿Es original?", supabase)).resolves.toEqual(fila);
    expect(supabase.inserts("questions")).toEqual([
      { product_id: PRODUCT, user_id: USER, question: "¿Es original?" },
    ]);
  });

  it("propaga el error de la RLS cuando el user_id no es el autenticado", async () => {
    const supabase = mockSupabase({
      questions: { single: dbError("new row violates row-level security policy", "42501") },
    });

    await expect(create(PRODUCT, USER, "¿Hola?", supabase)).rejects.toThrow(
      "new row violates row-level security policy",
    );
  });
});

describe("answer", () => {
  beforeEach(() => {
    // La marca de tiempo la pone este service, así que se congela el reloj
    // para poder afirmarla. Es el único uso de temporizadores de la suite.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("escribe la respuesta y sella answered_at con la hora actual", async () => {
    const supabase = mockSupabase({ questions: { single: { id: "q1", answer: "Sí, 12 meses." } } });

    await answer("q1", "Sí, 12 meses.", supabase);

    expect(supabase.updates("questions")).toEqual([
      { answer: "Sí, 12 meses.", answered_at: "2026-08-31T12:00:00.000Z" },
    ]);
    expect(hasFilter(supabase.filters("questions"), "eq", "id", "q1")).toBe(true);
  });

  it("no toca el texto de la pregunta: el trigger lo bloquearía", async () => {
    const supabase = mockSupabase({ questions: { single: { id: "q1" } } });

    await answer("q1", "Sí.", supabase);

    expect(supabase.updates("questions")[0]).not.toHaveProperty("question");
  });

  it("propaga el error cuando quien responde no es el vendedor del producto", async () => {
    const supabase = mockSupabase({
      questions: { single: dbError("new row violates row-level security policy", "42501") },
    });

    await expect(answer("q1", "Sí.", supabase)).rejects.toThrow(
      "new row violates row-level security policy",
    );
  });
});
