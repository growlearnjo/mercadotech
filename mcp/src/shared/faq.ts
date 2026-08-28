/**
 * DERIVACIÓN documentada (lección 6 de la spec).
 *
 * No existe un service que LISTE la FAQ: `support_articles` solo lo toca
 * `embedding.service.ts`, en una función privada y de un artículo a la vez
 * (`indexSupportArticle`). Las restricciones de la sesión 5 prohíben agregar
 * services nuevos al proyecto web para el MCP, así que la lectura vive aquí,
 * declarada como derivación y confinada a este archivo.
 *
 * Es una lectura idéntica en forma a la que ya hace el indexador (mismas
 * columnas, mismo filtro `is_published`), y corre con el cliente anon: la
 * política `support_articles_select_published_or_admin` concede SELECT
 * `to anon, authenticated` cuando `is_published`. Si algún día nace un
 * `support-article.service.ts` en la web, este archivo debe pasar a llamarlo.
 */
import type { Client } from "../context";

export async function listPublishedArticles(supabase: Client) {
  const { data, error } = await supabase
    .from("support_articles")
    .select("id, title, category, content, updated_at")
    .eq("is_published", true)
    .order("category", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((article) => ({
    id: article.id,
    title: article.title,
    category: article.category,
    content: article.content,
    updatedAt: article.updated_at,
  }));
}
