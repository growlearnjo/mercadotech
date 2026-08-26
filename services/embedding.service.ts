// Orquesta "cargar la fuente → armar el texto → generar la ficha →
// guardarla". El cliente ADMIN lo inyecta el caller (Route Handler o
// script) — este archivo no importa lib/supabase/admin.ts, para poder
// probarse con cualquier cliente y para que la regla "admin solo en
// Route Handlers/scripts" quede impuesta por quien llama, no por este
// service.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  buildProductEmbeddingText,
  buildSupportArticleEmbeddingText,
  generateEmbedding,
  toPgVectorLiteral,
} from "@/lib/ai/embeddings";

type Client = SupabaseClient<Database>;

export type KnowledgeSourceType = "producto" | "articulo_soporte";

export interface IndexResult {
  indexed: boolean;
  /** Presente solo cuando indexed = false: por qué no se (re)generó la ficha. */
  reason?: "fuente_no_existe" | "fuente_no_publicable";
}

/**
 * (Re)indexa una fuente (producto o artículo de soporte): genera su ficha y
 * la upsertea en knowledge_embeddings. Si la fuente ya no existe, o existe
 * pero no es publicable (producto inactivo / artículo no publicado — ambos
 * casos quedan fuera de lo que scripts/index-all.ts y la búsqueda indexan),
 * borra la ficha existente en su lugar (decisión 6 de la spec: fichas
 * huérfanas se limpian, no se dejan stale).
 */
export async function indexKnowledgeSource(
  sourceType: KnowledgeSourceType,
  sourceId: string,
  supabase: Client,
): Promise<IndexResult> {
  return sourceType === "producto"
    ? indexProduct(sourceId, supabase)
    : indexSupportArticle(sourceId, supabase);
}

async function indexProduct(productId: string, supabase: Client): Promise<IndexResult> {
  const { data: product, error } = await supabase
    .from("products")
    .select("id, title, brand, condition, description, is_active, categories(name)")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw error;

  if (!product) {
    await deleteEmbedding("producto", productId, supabase);
    return { indexed: false, reason: "fuente_no_existe" };
  }

  if (!product.is_active) {
    await deleteEmbedding("producto", productId, supabase);
    return { indexed: false, reason: "fuente_no_publicable" };
  }

  const categoryRelation = product.categories as { name: string } | { name: string }[] | null;
  const categoryName = Array.isArray(categoryRelation)
    ? (categoryRelation[0]?.name ?? null)
    : (categoryRelation?.name ?? null);

  const content = buildProductEmbeddingText({
    title: product.title,
    brand: product.brand,
    categoryName,
    condition: product.condition,
    description: product.description,
  });

  const { embedding } = await generateEmbedding(content);

  const { error: upsertError } = await supabase.from("knowledge_embeddings").upsert(
    {
      source_type: "producto",
      source_id: productId,
      chunk_index: 0,
      content,
      embedding: toPgVectorLiteral(embedding),
      metadata: { title: product.title },
    },
    { onConflict: "source_type,source_id,chunk_index" },
  );
  if (upsertError) throw upsertError;

  return { indexed: true };
}

async function indexSupportArticle(
  articleId: string,
  supabase: Client,
): Promise<IndexResult> {
  const { data: article, error } = await supabase
    .from("support_articles")
    .select("id, title, category, content, is_published")
    .eq("id", articleId)
    .maybeSingle();
  if (error) throw error;

  if (!article) {
    await deleteEmbedding("articulo_soporte", articleId, supabase);
    return { indexed: false, reason: "fuente_no_existe" };
  }

  if (!article.is_published) {
    await deleteEmbedding("articulo_soporte", articleId, supabase);
    return { indexed: false, reason: "fuente_no_publicable" };
  }

  const content = buildSupportArticleEmbeddingText({
    title: article.title,
    category: article.category,
    content: article.content,
  });

  const { embedding } = await generateEmbedding(content);

  const { error: upsertError } = await supabase.from("knowledge_embeddings").upsert(
    {
      source_type: "articulo_soporte",
      source_id: articleId,
      chunk_index: 0,
      content,
      embedding: toPgVectorLiteral(embedding),
      metadata: { title: article.title, category: article.category },
    },
    { onConflict: "source_type,source_id,chunk_index" },
  );
  if (upsertError) throw upsertError;

  return { indexed: true };
}

async function deleteEmbedding(
  sourceType: KnowledgeSourceType,
  sourceId: string,
  supabase: Client,
): Promise<void> {
  const { error } = await supabase
    .from("knowledge_embeddings")
    .delete()
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);
  if (error) throw error;
}
