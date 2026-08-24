// Catálogo de categorías. Solo lectura: las categorías las siembra el seed y
// no hay pantalla de administración en esta sesión.

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Category } from "@/types/product";

type Client = SupabaseClient<Database>;

/** Todas las categorías, ordenadas alfabéticamente para el menú y los filtros. */
export async function listCategories(
  supabase: Client = createClient(),
): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Una categoría por slug, o null si no existe (URL inventada). */
export async function getCategoryBySlug(
  slug: string,
  supabase: Client = createClient(),
): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}
