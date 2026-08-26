// El "criterio del bibliotecario": de todas las fichas recuperadas, cuáles
// entran al escritorio del redactor y en qué orden. Función PURA a
// propósito (Fase 4.5): cero fetch, cero Supabase, cero React — se testea
// en aislamiento con datos en memoria (sesión 6).
import { buildRagUserMessage, type RagContextSource } from "@/lib/ai/prompts";
import {
  CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS,
  CONTEXT_BUILDER_DEFAULT_MAX_SOURCES,
  CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY,
  CONTEXT_BUILDER_MIN_CONTENT_LENGTH,
  CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS,
} from "@/lib/constants/ai";

/** Forma exacta de un resultado de vector-search.service.ts (Fase 4.4). */
export interface ContextBuilderSource {
  sourceType: "producto" | "articulo_soporte";
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface ContextBuilderOptions {
  minSimilarity?: number;
  maxSources?: number;
  maxContextChars?: number;
  minTruncatedSourceChars?: number;
}

export interface ContextBuilderStats {
  /** true si alguna fuente se recortó o se descartó por presupuesto. */
  contextTruncated: boolean;
  /** Suma de caracteres de contenido que entraron al contexto final. */
  totalChars: number;
}

export interface ContextBuilderResult {
  userMessage: string;
  sources: RagContextSource[];
  stats: ContextBuilderStats;
}

function sourceTitle(metadata: Record<string, unknown>): string {
  return typeof metadata.title === "string" ? metadata.title : "Sin título";
}

/**
 * (1) Selección: filtra por minSimilarity y MIN_CONTENT_LENGTH, ordena por
 * similitud descendente, corta a maxSources.
 * (2) Presupuesto: acumula contenido en ese orden hasta maxContextChars. La
 * primera fuente que no cabe entera se trunca SI al presupuesto restante le
 * caben al menos minTruncatedSourceChars; si no, se descarta entera (media
 * frase confunde más de lo que aporta) — y ninguna fuente posterior entra,
 * porque ya no queda presupuesto real.
 * (3) Salida: {userMessage, sources[], stats}, con sources numeradas en el
 * orden final (lo que buildRagUserMessage cita como "[Fuente N]").
 */
export function buildContext(
  query: string,
  results: ContextBuilderSource[],
  options: ContextBuilderOptions = {},
): ContextBuilderResult {
  const minSimilarity = options.minSimilarity ?? CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY;
  const maxSources = options.maxSources ?? CONTEXT_BUILDER_DEFAULT_MAX_SOURCES;
  const maxContextChars =
    options.maxContextChars ?? CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS;
  const minTruncatedSourceChars =
    options.minTruncatedSourceChars ?? CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS;

  const selected = results
    .filter(
      (source) =>
        source.similarity >= minSimilarity &&
        source.content.length >= CONTEXT_BUILDER_MIN_CONTENT_LENGTH,
    )
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxSources);

  let totalChars = 0;
  let contextTruncated = false;
  const budgeted: ContextBuilderSource[] = [];

  for (const source of selected) {
    const remaining = maxContextChars - totalChars;
    if (remaining <= 0) {
      contextTruncated = true;
      break;
    }

    if (source.content.length <= remaining) {
      budgeted.push(source);
      totalChars += source.content.length;
      continue;
    }

    // No cabe entera: se trunca si sobrevive algo útil, si no se descarta.
    contextTruncated = true;
    if (remaining >= minTruncatedSourceChars) {
      const truncatedContent = source.content.slice(0, remaining);
      budgeted.push({ ...source, content: truncatedContent });
      totalChars += truncatedContent.length;
    }
    break;
  }

  const sources: RagContextSource[] = budgeted.map((source, index) => ({
    position: index + 1,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    title: sourceTitle(source.metadata),
    similarity: source.similarity,
    content: source.content,
  }));

  return {
    userMessage: buildRagUserMessage(query, sources),
    sources,
    stats: { contextTruncated, totalChars },
  };
}
