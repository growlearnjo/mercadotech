// Tests de lib/ai/context-builder.ts (Fase 6.2).
//
// El "criterio del bibliotecario" es pura lógica sobre datos en memoria: sin
// fetch, sin Supabase, sin React. Meta de la spec: 100 % de ramas.
//
// Los umbrales salen de lib/constants/ai.ts, nunca copiados a mano: si la
// calibración de la Fase 4.8 cambia, estos tests siguen probando "justo en el
// umbral / justo debajo".

import { describe, expect, it } from "vitest";

import {
  buildContext,
  type ContextBuilderSource,
} from "@/lib/ai/context-builder";
import {
  CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS,
  CONTEXT_BUILDER_DEFAULT_MAX_SOURCES,
  CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY,
  CONTEXT_BUILDER_MIN_CONTENT_LENGTH,
  CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS,
} from "@/lib/constants/ai";

const QUERY = "audífonos para el gimnasio";

/** Contenido de largo exacto, para razonar sobre el presupuesto en caracteres. */
function content(length: number, fill = "x"): string {
  return fill.repeat(length);
}

function source(
  overrides: Partial<ContextBuilderSource> & { similarity: number },
): ContextBuilderSource {
  return {
    sourceType: "producto",
    sourceId: "p1",
    content: content(CONTEXT_BUILDER_MIN_CONTENT_LENGTH),
    metadata: { title: "Producto" },
    ...overrides,
  };
}

describe("buildContext — selección", () => {
  it("sin resultados devuelve 0 fuentes y el aviso de 'sin fuentes'", () => {
    const result = buildContext(QUERY, []);

    expect(result.sources).toEqual([]);
    expect(result.stats).toEqual({ contextTruncated: false, totalChars: 0 });
    expect(result.userMessage).toContain("No se encontraron fuentes");
    expect(result.userMessage).toContain(QUERY);
  });

  it("descarta todo lo que quede bajo el umbral de similitud", () => {
    const result = buildContext(QUERY, [
      source({ sourceId: "bajo-1", similarity: CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY - 0.01 }),
      source({ sourceId: "bajo-2", similarity: 0 }),
    ]);

    expect(result.sources).toEqual([]);
    // Nada se recortó: simplemente nada calificó.
    expect(result.stats.contextTruncated).toBe(false);
  });

  it("el umbral es inclusivo: la similitud EXACTA entra", () => {
    const result = buildContext(QUERY, [
      source({ sourceId: "justo", similarity: CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY }),
    ]);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].sourceId).toBe("justo");
  });

  it(`descarta contenido de menos de ${CONTEXT_BUILDER_MIN_CONTENT_LENGTH} caracteres`, () => {
    const result = buildContext(QUERY, [
      source({
        sourceId: "corta",
        similarity: 0.9,
        content: content(CONTEXT_BUILDER_MIN_CONTENT_LENGTH - 1),
      }),
      source({
        sourceId: "justa",
        similarity: 0.8,
        content: content(CONTEXT_BUILDER_MIN_CONTENT_LENGTH),
      }),
    ]);

    // La de similitud MÁS alta se cae por corta: el filtro de longitud no es
    // un desempate, es una condición previa.
    expect(result.sources.map((s) => s.sourceId)).toEqual(["justa"]);
  });

  it("ordena por similitud descendente y numera en ese orden", () => {
    const result = buildContext(QUERY, [
      source({ sourceId: "media", similarity: 0.6 }),
      source({ sourceId: "alta", similarity: 0.95 }),
      source({ sourceId: "baja", similarity: 0.4 }),
    ]);

    expect(result.sources.map((s) => s.sourceId)).toEqual(["alta", "media", "baja"]);
    expect(result.sources.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it(`corta a maxSources (${CONTEXT_BUILDER_DEFAULT_MAX_SOURCES} por defecto), quedándose con las mejores`, () => {
    const results = Array.from({ length: CONTEXT_BUILDER_DEFAULT_MAX_SOURCES + 3 }, (_, i) =>
      source({ sourceId: `s${i}`, similarity: 0.9 - i * 0.01 }),
    );

    const porDefecto = buildContext(QUERY, results);
    expect(porDefecto.sources).toHaveLength(CONTEXT_BUILDER_DEFAULT_MAX_SOURCES);
    expect(porDefecto.sources[0].sourceId).toBe("s0");

    const conOpcion = buildContext(QUERY, results, { maxSources: 2 });
    expect(conOpcion.sources.map((s) => s.sourceId)).toEqual(["s0", "s1"]);
  });

  it("respeta un minSimilarity pasado por opciones, por encima del default", () => {
    const results = [
      source({ sourceId: "alta", similarity: 0.9 }),
      source({ sourceId: "media", similarity: 0.5 }),
    ];

    expect(buildContext(QUERY, results, { minSimilarity: 0.8 }).sources).toHaveLength(1);
  });
});

describe("buildContext — presupuesto de caracteres", () => {
  it("no marca truncado cuando todo cabe holgado", () => {
    const result = buildContext(QUERY, [
      source({ sourceId: "a", similarity: 0.9, content: content(100) }),
      source({ sourceId: "b", similarity: 0.8, content: content(50) }),
    ]);

    expect(result.stats).toEqual({ contextTruncated: false, totalChars: 150 });
    expect(result.sources).toHaveLength(2);
  });

  it("trunca la fuente que no cabe si al presupuesto le queda lo mínimo útil", () => {
    const restante = CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS;
    const maxContextChars = 100 + restante;

    const result = buildContext(
      QUERY,
      [
        source({ sourceId: "entera", similarity: 0.9, content: content(100) }),
        source({ sourceId: "recortada", similarity: 0.8, content: content(1000) }),
      ],
      { maxContextChars },
    );

    expect(result.sources.map((s) => s.sourceId)).toEqual(["entera", "recortada"]);
    expect(result.sources[1].content).toHaveLength(restante);
    expect(result.stats).toEqual({ contextTruncated: true, totalChars: maxContextChars });
  });

  it("descarta ENTERA la fuente si lo que resta es menos que el mínimo truncado", () => {
    // Media frase confunde más de lo que aporta (comentario del propio código).
    const maxContextChars = 100 + CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS - 1;

    const result = buildContext(
      QUERY,
      [
        source({ sourceId: "entera", similarity: 0.9, content: content(100) }),
        source({ sourceId: "descartada", similarity: 0.8, content: content(1000) }),
      ],
      { maxContextChars },
    );

    expect(result.sources.map((s) => s.sourceId)).toEqual(["entera"]);
    expect(result.stats).toEqual({ contextTruncated: true, totalChars: 100 });
  });

  it("honra un minTruncatedSourceChars propio por opciones", () => {
    const result = buildContext(
      QUERY,
      [
        source({ sourceId: "entera", similarity: 0.9, content: content(100) }),
        source({ sourceId: "recortada", similarity: 0.8, content: content(1000) }),
      ],
      { maxContextChars: 110, minTruncatedSourceChars: 10 },
    );

    // Con el default (200) esta fuente se habría descartado; con 10, entra
    // recortada a los 10 caracteres que quedaban.
    expect(result.sources.map((s) => s.sourceId)).toEqual(["entera", "recortada"]);
    expect(result.sources[1].content).toHaveLength(10);
  });

  it("corta el bucle cuando el presupuesto se agota EXACTAMENTE y quedaban fuentes", () => {
    const result = buildContext(
      QUERY,
      [
        source({ sourceId: "llena", similarity: 0.9, content: content(100) }),
        source({ sourceId: "sobrante", similarity: 0.8, content: content(50) }),
      ],
      { maxContextChars: 100 },
    );

    expect(result.sources.map((s) => s.sourceId)).toEqual(["llena"]);
    // La segunda no se recortó: ni siquiera había presupuesto para intentarlo.
    expect(result.stats).toEqual({ contextTruncated: true, totalChars: 100 });
  });

  it("una única fuente que no cabe y no alcanza el mínimo deja el contexto vacío", () => {
    const result = buildContext(
      QUERY,
      [source({ sourceId: "gigante", similarity: 0.9, content: content(1000) })],
      { maxContextChars: CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS - 1 },
    );

    expect(result.sources).toEqual([]);
    expect(result.stats).toEqual({ contextTruncated: true, totalChars: 0 });
    expect(result.userMessage).toContain("No se encontraron fuentes");
  });

  it(`el presupuesto por defecto (${CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS}) no estorba a un contexto normal`, () => {
    const result = buildContext(QUERY, [
      source({ sourceId: "a", similarity: 0.9, content: content(500) }),
    ]);

    expect(result.stats.contextTruncated).toBe(false);
    expect(result.stats.totalChars).toBe(500);
    expect(result.stats.totalChars).toBeLessThan(CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS);
  });
});

describe("buildContext — salida", () => {
  it("toma el título de la metadata y cae a 'Sin título' si no es un string", () => {
    const result = buildContext(QUERY, [
      source({ sourceId: "con", similarity: 0.9, metadata: { title: "Audífonos Sony" } }),
      source({ sourceId: "sin", similarity: 0.8, metadata: {} }),
      source({ sourceId: "raro", similarity: 0.7, metadata: { title: 42 } }),
    ]);

    expect(result.sources.map((s) => s.title)).toEqual([
      "Audífonos Sony",
      "Sin título",
      "Sin título",
    ]);
  });

  it("arrastra tipo, id y similitud de cada fuente al resultado", () => {
    const result = buildContext(QUERY, [
      source({
        sourceId: "faq-1",
        sourceType: "articulo_soporte",
        similarity: 0.77,
        metadata: { title: "Devoluciones" },
      }),
    ]);

    expect(result.sources[0]).toMatchObject({
      position: 1,
      sourceType: "articulo_soporte",
      sourceId: "faq-1",
      title: "Devoluciones",
      similarity: 0.77,
    });
  });

  it("el userMessage cita las fuentes numeradas y termina con la consulta", () => {
    const result = buildContext(QUERY, [
      source({ sourceId: "a", similarity: 0.9, metadata: { title: "Primera" } }),
      source({ sourceId: "b", similarity: 0.8, metadata: { title: "Segunda" } }),
    ]);

    expect(result.userMessage).toContain("=== CONTEXTO RECUPERADO ===");
    expect(result.userMessage).toContain("[Fuente 1]");
    expect(result.userMessage).toContain("[Fuente 2]");
    expect(result.userMessage.indexOf("[Fuente 1]")).toBeLessThan(
      result.userMessage.indexOf("[Fuente 2]"),
    );
    expect(result.userMessage.trimEnd().endsWith(`Consulta del usuario: ${QUERY}`)).toBe(true);
  });

  it("el userMessage lleva el contenido YA truncado, no el original", () => {
    const result = buildContext(
      QUERY,
      [source({ sourceId: "larga", similarity: 0.9, content: content(1000, "z") })],
      { maxContextChars: CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS },
    );

    expect(result.sources[0].content).toHaveLength(
      CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS,
    );
    expect(result.userMessage).not.toContain(content(1000, "z"));
  });
});
