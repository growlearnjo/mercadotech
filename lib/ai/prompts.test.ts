// Tests de lib/ai/prompts.ts (Fase 6.2).
//
// Estas cadenas son el contrato entre el RAG y el modelo: si el mensaje deja
// de numerar las fuentes, las citas "[1]" que la UI resalta dejan de tener a
// qué apuntar. Se prueban como lo que son — texto puro, sin red.

import { describe, expect, it } from "vitest";

import {
  SHOPPING_SYSTEM_INSTRUCTIONS,
  SUPPORT_SYSTEM_INSTRUCTIONS,
  buildRagUserMessage,
  type RagContextSource,
} from "@/lib/ai/prompts";

const QUERY = "¿tienen audífonos con cancelación de ruido?";

function ragSource(overrides: Partial<RagContextSource> = {}): RagContextSource {
  return {
    position: 1,
    sourceType: "producto",
    sourceId: "p1",
    title: "Audífonos Sony WH-1000XM4",
    similarity: 0.4213,
    content: "Cancelación activa de ruido, 30 horas de batería.",
    ...overrides,
  };
}

describe("buildRagUserMessage — con fuentes", () => {
  it("abre y cierra el bloque de contexto y deja la consulta al final", () => {
    // Lo más cercano al punto donde el modelo empieza a generar pesa más:
    // por eso la consulta va última, no primera.
    const message = buildRagUserMessage(QUERY, [ragSource()]);

    expect(message).toContain("=== CONTEXTO RECUPERADO ===");
    expect(message).toContain("=== FIN DEL CONTEXTO ===");
    expect(message.trimEnd().endsWith(`Consulta del usuario: ${QUERY}`)).toBe(true);
  });

  it("numera cada fuente por su position, no por el índice del array", () => {
    const message = buildRagUserMessage(QUERY, [
      ragSource({ position: 3, sourceId: "a" }),
      ragSource({ position: 7, sourceId: "b" }),
    ]);

    expect(message).toContain("[Fuente 3]");
    expect(message).toContain("[Fuente 7]");
  });

  it("incluye tipo, título, similitud a 3 decimales y contenido de cada fuente", () => {
    const message = buildRagUserMessage(QUERY, [
      ragSource({ sourceType: "articulo_soporte", title: "Política de devoluciones" }),
    ]);

    expect(message).toContain("Tipo: articulo_soporte");
    expect(message).toContain("Título: Política de devoluciones");
    expect(message).toContain("Similitud: 0.421");
    expect(message).toContain("Cancelación activa de ruido, 30 horas de batería.");
  });

  it("separa las fuentes entre sí para que no se lean como una sola", () => {
    const message = buildRagUserMessage(QUERY, [
      ragSource({ position: 1, content: "Contenido de la primera." }),
      ragSource({ position: 2, content: "Contenido de la segunda." }),
    ]);

    expect(message).toContain("\n\n===\n\n");
    expect(message.indexOf("[Fuente 1]")).toBeLessThan(message.indexOf("[Fuente 2]"));
  });
});

describe("buildRagUserMessage — sin fuentes", () => {
  it("sustituye el contexto por el aviso explícito de que no hubo nada relevante", () => {
    const message = buildRagUserMessage(QUERY, []);

    expect(message).toContain("No se encontraron fuentes suficientemente relevantes");
    expect(message).not.toContain("=== CONTEXTO RECUPERADO ===");
    expect(message).toContain(QUERY);
  });
});

describe("instrucciones de sistema", () => {
  it("el modo soporte pide sugerir un ticket cuando el contexto no alcanza", () => {
    expect(SUPPORT_SYSTEM_INSTRUCTIONS).toContain("ticket de soporte");
    expect(SUPPORT_SYSTEM_INSTRUCTIONS).toContain("ÚNICAMENTE");
  });

  it("el modo compras pide citar por número y no inventar productos", () => {
    expect(SHOPPING_SYSTEM_INSTRUCTIONS).toContain("ÚNICAMENTE");
    expect(SHOPPING_SYSTEM_INSTRUCTIONS).toContain("no encontré productos que coincidan");
  });

  it("los dos modos son distintos: no se comparte una sola instrucción", () => {
    expect(SUPPORT_SYSTEM_INSTRUCTIONS).not.toBe(SHOPPING_SYSTEM_INSTRUCTIONS);
  });
});
