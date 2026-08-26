// Orquesta la conversación SIN reimplementar nada: búsqueda, contexto y
// redacción viven cada una en su propia capa (vector-search.service,
// context-builder, lib/ai/completion). Si algo nuevo hiciera falta, se
// agrega en la capa dueña, nunca aquí.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { generateCompletion } from "@/lib/ai/completion";
import {
  SHOPPING_SYSTEM_INSTRUCTIONS,
  SUPPORT_SYSTEM_INSTRUCTIONS,
} from "@/lib/ai/prompts";
import { buildContext, type ContextBuilderSource } from "@/lib/ai/context-builder";
import {
  searchByEmbedding,
  type KnowledgeSourceType,
} from "@/services/vector-search.service";
import { getProductsByIds } from "@/services/product.service";
import type { ChatMode, ChatResult, ChatSource } from "@/types/chat";
import type { RagContextSource } from "@/lib/ai/prompts";

type Client = SupabaseClient<Database>;

/** compras solo busca en el catálogo; soporte solo en la FAQ — nunca se mezclan. */
const MODE_SOURCE_TYPE: Record<ChatMode, KnowledgeSourceType> = {
  compras: "producto",
  soporte: "articulo_soporte",
};

const MODE_INSTRUCTIONS: Record<ChatMode, string> = {
  compras: SHOPPING_SYSTEM_INSTRUCTIONS,
  soporte: SUPPORT_SYSTEM_INSTRUCTIONS,
};

export interface AskOptions {
  topK?: number;
  similarityThreshold?: number;
}

/**
 * Adjunta precio/imagen ACTUALES a las fuentes de tipo 'producto' (Fase 4.7:
 * SourcesList pinta una mini-card, no solo el título). Reusa
 * getProductsByIds (la misma hidratación que vector-search.service.ts) en
 * vez de duplicarla; los productos que ya no existen o están inactivos
 * simplemente quedan sin price/imageUrl.
 */
async function enrichSources(
  sources: RagContextSource[],
  supabase: Client,
): Promise<ChatSource[]> {
  const productIds = sources
    .filter((source) => source.sourceType === "producto")
    .map((source) => source.sourceId);
  const products =
    productIds.length > 0 ? await getProductsByIds(productIds, supabase) : [];
  const productById = new Map(products.map((product) => [product.id, product]));

  return sources.map((source) => {
    const product =
      source.sourceType === "producto" ? productById.get(source.sourceId) : undefined;
    return {
      position: source.position,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      title: source.title,
      similarity: source.similarity,
      price: product?.price,
      imageUrl: product?.image_url,
    };
  });
}

/**
 * embedding de la consulta → match_knowledge (filtrado por modo) →
 * context-builder → completion con las instrucciones del modo → ChatResult.
 *
 * Si no hay contexto relevante, `hasRelevantContext` queda en false pero la
 * completion se llama IGUAL, con contexto vacío: las instrucciones del modo
 * ya cubren qué responder en ese caso ("no encontré…" / sugerir ticket). No
 * hay atajo que evite la llamada al LLM.
 */
export async function ask(
  query: string,
  mode: ChatMode,
  opts: AskOptions,
  supabase: Client,
): Promise<ChatResult> {
  const { embedding } = await generateEmbedding(query);

  const matches = await searchByEmbedding(
    embedding,
    {
      topK: opts.topK,
      similarityThreshold: opts.similarityThreshold,
      sourceType: MODE_SOURCE_TYPE[mode],
    },
    supabase,
  );

  const contextSources: ContextBuilderSource[] = matches.map((match) => ({
    sourceType: match.sourceType,
    sourceId: match.sourceId,
    content: match.content,
    metadata: match.metadata,
    similarity: match.similarity,
  }));

  const context = buildContext(query, contextSources);

  const completion = await generateCompletion(
    MODE_INSTRUCTIONS[mode],
    context.userMessage,
  );

  return {
    query,
    answer: completion.text,
    hasRelevantContext: context.sources.length > 0,
    sources: await enrichSources(context.sources, supabase),
    metadata: {
      model: completion.model,
      retrievedCount: matches.length,
      usedSourceCount: context.sources.length,
      contextTruncated: context.stats.contextTruncated,
    },
  };
}
