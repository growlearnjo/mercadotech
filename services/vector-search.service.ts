// Búsqueda semántica sobre knowledge_embeddings. Este service NO importa
// lib/supabase/admin.ts: el endpoint de búsqueda (Fase 4.4) le inyecta el
// cliente de SESIÓN, para que la RLS de knowledge_embeddings (solo
// authenticated, decisión 1) aplique tal cual.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { generateEmbedding, toPgVectorLiteral } from "@/lib/ai/embeddings";
import {
  VECTOR_SEARCH_DEFAULT_TOP_K,
  VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD,
  VECTOR_SEARCH_MAX_TOP_K,
} from "@/lib/constants/ai";
import { getProductsByIds } from "@/services/product.service";
import type { Product } from "@/types/product";

type Client = SupabaseClient<Database>;

export type KnowledgeSourceType = "producto" | "articulo_soporte";

export interface VectorSearchOptions {
  /** Cuántos resultados pedir (se recorta a VECTOR_SEARCH_MAX_TOP_K). */
  topK?: number;
  similarityThreshold?: number;
  /** null (default del RPC) busca en ambas fuentes. */
  sourceType?: KnowledgeSourceType | null;
}

export interface VectorMatch {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

/** Busca por un embedding ya calculado (match_knowledge, Fase 4.1) — sin hidratar contra ninguna tabla origen. */
export async function searchByEmbedding(
  embedding: number[],
  opts: VectorSearchOptions,
  supabase: Client,
): Promise<VectorMatch[]> {
  const topK = Math.min(opts.topK ?? VECTOR_SEARCH_DEFAULT_TOP_K, VECTOR_SEARCH_MAX_TOP_K);
  const threshold = opts.similarityThreshold ?? VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD;

  const { data, error } = await supabase.rpc("match_knowledge", {
    query_embedding: toPgVectorLiteral(embedding),
    p_source_type: opts.sourceType ?? undefined,
    match_count: topK,
    similarity_threshold: threshold,
  });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    sourceType: row.source_type as KnowledgeSourceType,
    sourceId: row.source_id,
    content: row.content,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    similarity: row.similarity,
  }));
}

export interface ProductSearchResult {
  product: Product;
  similarity: number;
}

/**
 * Embedding de la consulta + matching sobre 'producto' + hidratación contra
 * `products` activos (precio/imagen ACTUALES, no la copia congelada en la
 * ficha). Los ids que no resuelven a un producto activo (huérfano, borrado,
 * ocultado) se descartan en silencio — es el mecanismo de limpieza de la
 * decisión 6 en el camino de lectura.
 */
export async function searchProducts(
  query: string,
  opts: VectorSearchOptions,
  supabase: Client,
): Promise<ProductSearchResult[]> {
  const { embedding } = await generateEmbedding(query);
  const matches = await searchByEmbedding(
    embedding,
    { ...opts, sourceType: "producto" },
    supabase,
  );
  if (matches.length === 0) return [];

  const products = await getProductsByIds(
    matches.map((match) => match.sourceId),
    supabase,
  );
  const productById = new Map(products.map((product) => [product.id, product]));

  const results: ProductSearchResult[] = [];
  for (const match of matches) {
    const product = productById.get(match.sourceId);
    if (!product) continue;
    results.push({ product, similarity: match.similarity });
  }
  return results;
}
