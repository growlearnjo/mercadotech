// Consulta del catálogo. Sigue el patrón del CLAUDE.md: funciones async
// puras, cliente inyectable como último parámetro, errores propagados tal cual.
//
// Este archivo concentra la traducción entre "lo que devuelve PostgREST" y
// "lo que las pantallas necesitan": price como number, imágenes ordenadas y
// resueltas a URL, y los agregados de reseñas ya calculados.

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Product, ProductImage } from "@/types/product";
import type { ProductCondition } from "@/lib/constants/roles";
import {
  DEFAULT_SORT,
  PRODUCTS_PAGE_SIZE,
  type SortOption,
} from "@/lib/constants/catalog";
import { getPublicUrl, PRODUCT_IMAGES_BUCKET } from "@/services/storage.service";

type Client = SupabaseClient<Database>;

export type ProductFilters = {
  categorySlug?: string;
  search?: string;
  condition?: ProductCondition[];
  minPrice?: number;
  maxPrice?: number;
  sort?: SortOption;
  /** 1-indexada, como se ve en la URL. */
  page?: number;
};

/**
 * Select con las dos relaciones que la card necesita.
 *
 * `categories!inner` es seguro porque `category_id` es NOT NULL: el inner join
 * nunca descarta filas, y a cambio permite filtrar por slug en la MISMA
 * consulta en vez de resolver el slug a id en un viaje aparte.
 */
const PRODUCT_SELECT =
  "*, categories!inner(slug), product_images(image_path, position), reviews(rating)";

/** Forma cruda de una fila con sus relaciones embebidas. */
type ProductRow = Database["public"]["Tables"]["products"]["Row"] & {
  categories: { slug: string } | { slug: string }[] | null;
  product_images: { image_path: string; position: number }[] | null;
  reviews: { rating: number }[] | null;
};

function isCondition(value: string): value is ProductCondition {
  return value === "nuevo" || value === "usado" || value === "reacondicionado";
}

/**
 * Fila cruda → tipo de dominio.
 *
 * Aquí se paga la deuda del `numeric` que llega como string y de las
 * relaciones que PostgREST devuelve anidadas y sin ordenar.
 */
function toProduct(row: ProductRow, supabase: Client): Product {
  const images = [...(row.product_images ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const cover = images[0];

  const ratings = (row.reviews ?? []).map((review) => review.rating);
  const reviewCount = ratings.length;
  const averageRating =
    reviewCount > 0
      ? ratings.reduce((sum, rating) => sum + rating, 0) / reviewCount
      : null;

  // `categories` y las relaciones no forman parte del tipo de dominio: la card
  // recibe solo lo que pinta.
  const {
    categories: _categories,
    product_images: _images,
    reviews: _reviews,
    ...product
  } = row;

  return {
    ...product,
    price: Number(row.price),
    condition: isCondition(row.condition) ? row.condition : "usado",
    image_url: cover
      ? getPublicUrl(PRODUCT_IMAGES_BUCKET, cover.image_path, supabase)
      : null,
    average_rating: averageRating,
    review_count: reviewCount,
  };
}

/**
 * Listado paginado del catálogo público.
 *
 * `is_active = true` se filtra EXPLÍCITAMENTE aunque RLS ya lo imponga para
 * anónimos: un vendedor con sesión sí puede leer sus propios productos
 * inactivos, y sin este filtro los vería mezclados en la home.
 */
export async function listActiveProducts(
  filters: ProductFilters,
  supabase: Client = createClient(),
): Promise<{ items: Product[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PRODUCTS_PAGE_SIZE;
  const to = from + PRODUCTS_PAGE_SIZE - 1;

  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT, { count: "exact" })
    .eq("is_active", true);

  if (filters.categorySlug) {
    query = query.eq("categories.slug", filters.categorySlug);
  }

  if (filters.search?.trim()) {
    // Búsqueda provisional por coincidencia de texto sobre título y marca.
    // La búsqueda semántica (embeddings) llega en la sesión 4 y sustituirá
    // esta rama; hasta entonces `ilike` cubre el caso "busco por modelo".
    const term = filters.search.trim().replace(/[%,]/g, "");
    query = query.or(`title.ilike.%${term}%,brand.ilike.%${term}%`);
  }

  if (filters.condition && filters.condition.length > 0) {
    query = query.in("condition", filters.condition);
  }

  if (typeof filters.minPrice === "number") {
    query = query.gte("price", filters.minPrice);
  }
  if (typeof filters.maxPrice === "number") {
    query = query.lte("price", filters.maxPrice);
  }

  switch (filters.sort ?? DEFAULT_SORT) {
    case "precio_asc":
      query = query.order("price", { ascending: true });
      break;
    case "precio_desc":
      query = query.order("price", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }
  // Desempate estable: sin esto, dos productos con el mismo precio pueden
  // cambiar de orden entre páginas y aparecer duplicados o desaparecer.
  query = query.order("id", { ascending: true });

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    items: (data ?? []).map((row) =>
      toProduct(row as unknown as ProductRow, supabase),
    ),
    total: count ?? 0,
  };
}

/** Un producto por id, con imágenes y agregados de reseñas resueltos. */
export async function getProductById(
  id: string,
  supabase: Client = createClient(),
): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return toProduct(data as unknown as ProductRow, supabase);
}

/**
 * Productos activos por id, en el mismo formato que el resto del catálogo
 * (`price` a number, `image_url` resuelta, agregados de reseñas). Usado por
 * vector-search.service.ts (Fase 4.4) para hidratar los resultados de la
 * búsqueda semántica contra los datos ACTUALES del producto — la ficha
 * vectorial solo guarda una copia del texto en el momento en que se indexó.
 * Descarta silenciosamente los ids que no correspondan a un producto activo
 * (borrado, inactivo, o una ficha huérfana): el caller decide qué hacer con
 * los ids que falten en el resultado.
 */
export async function getProductsByIds(
  ids: string[],
  supabase: Client = createClient(),
): Promise<Product[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in("id", ids)
    .eq("is_active", true);
  if (error) throw error;

  return (data ?? []).map((row) =>
    toProduct(row as unknown as ProductRow, supabase),
  );
}

/** Galería completa de un producto, ordenada por `position`. */
export async function getProductImages(
  productId: string,
  supabase: Client = createClient(),
): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("position", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((image) => ({
    ...image,
    image_url: getPublicUrl(PRODUCT_IMAGES_BUCKET, image.image_path, supabase),
  }));
}

/**
 * Registra que un usuario vio el producto.
 *
 * Solo con sesión (decisión 14): `product_views.user_id` es NOT NULL y la
 * política exige rol `authenticated`. Quien llama debe comprobar que hay
 * usuario antes; aquí no se lanza si falla porque una métrica no debe romper
 * la ficha del producto.
 */
export async function registerView(
  productId: string,
  userId: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("product_views")
    .insert({ product_id: productId, user_id: userId });
  if (error) throw error;
}
