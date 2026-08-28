/**
 * DERIVACIONES de agregados (lección 6 de la spec).
 *
 * El proyecto web no tiene services de estadísticas porque ninguna pantalla
 * los necesita, y la sesión 5 prohíbe agregarlos "para el MCP". Todo lo de
 * aquí se COMPONE de services existentes; la única consulta propia es la de
 * `topSellingProducts`, que agrega sobre `order_items` y está declarada como
 * derivación explícita más abajo.
 */
import { listCategories } from "@/services/category.service";
import { listActiveProducts, getProductsByIds } from "@/services/product.service";
import { PRODUCTS_PAGE_SIZE } from "@/lib/constants/catalog";
import type { Client } from "../context";
import { describeError } from "../lib/errors";

/**
 * Todos los productos activos. `listActiveProducts` pagina de a
 * PRODUCTS_PAGE_SIZE; aquí se recorren las páginas en vez de duplicar la
 * consulta sin paginar. El catálogo del curso son 16 productos, así que el
 * costo es trivial; el tope evita un bucle infinito si algo va mal.
 */
async function listAllActiveProducts(supabase: Client) {
  const MAX_PAGES = 50;
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { items, total } = await listActiveProducts({ page }, supabase);
    all.push(...items);
    if (all.length >= total || items.length < PRODUCTS_PAGE_SIZE) break;
  }
  return all;
}

/** Categorías + cuántos productos ACTIVOS tiene cada una. */
export async function categoriesWithCount(supabase: Client) {
  const [categories, products] = await Promise.all([
    listCategories(supabase),
    listAllActiveProducts(supabase),
  ]);

  const countById = new Map<string, number>();
  for (const product of products) {
    countById.set(product.category_id, (countById.get(product.category_id) ?? 0) + 1);
  }

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    activeProducts: countById.get(category.id) ?? 0,
  }));
}

/**
 * Top de productos por unidades vendidas.
 *
 * Requiere el cliente ADMIN: `order_items_select_*` concede SELECT solo al
 * comprador del pedido, al vendedor de sus ítems o al admin — un anónimo no
 * lee ninguna fila y el top saldría siempre vacío.
 *
 * LIMITACIÓN CONOCIDA (sesión 5): service_role bypasea RLS pero no tiene
 * GRANT sobre order_items en este esquema, así que hoy esto falla con
 * `permission denied (42501)`. `storeStats` lo captura y sigue devolviendo el
 * resto de agregados; el arreglo es una migración, fuera del alcance de esta
 * sesión.
 *
 * Es una derivación, no lógica de negocio nueva: agrega cantidades por
 * `product_id` y luego hidrata con `getProductsByIds` (el mismo service que
 * usa la búsqueda semántica). NUNCA toca `orders` ni expone comprador alguno.
 */
export async function topSellingProducts(admin: Client, anon: Client, limit = 5) {
  const { data, error } = await admin.from("order_items").select("product_id, quantity");
  if (error) throw error;

  const unitsByProduct = new Map<string, number>();
  for (const item of data ?? []) {
    if (!item.product_id) continue;
    unitsByProduct.set(
      item.product_id,
      (unitsByProduct.get(item.product_id) ?? 0) + item.quantity,
    );
  }

  const top = [...unitsByProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // Hidratación con anon: solo interesa lo que hoy es público y está activo.
  const products = await getProductsByIds(
    top.map(([productId]) => productId),
    anon,
  );
  const productById = new Map(products.map((product) => [product.id, product]));

  return top
    .filter(([productId]) => productById.has(productId))
    .map(([productId, units]) => ({
      id: productId,
      title: productById.get(productId)!.title,
      price: productById.get(productId)!.price,
      unitsSold: units,
    }));
}

/** Agregados de la tienda. Cero datos personales: solo conteos y promedios. */
export async function storeStats(anon: Client, admin: Client) {
  const [categories, products] = await Promise.all([
    categoriesWithCount(anon),
    listAllActiveProducts(anon),
  ]);

  const prices = products.map((product) => product.price);
  const rated = products.filter((product) => product.average_rating !== null);

  // El top vive detrás de admin; si falta la service role key, el resto de
  // las estadísticas sigue siendo útil y se dice por qué falta el top.
  let topSelling;
  try {
    topSelling = await topSellingProducts(admin, anon);
  } catch (error) {
    // describeError y no un String(): los errores de Supabase son objetos
    // planos y se perdería el diagnóstico entero.
    topSelling = { error: describeError(error).message };
  }

  return {
    categories: categories.length,
    activeProducts: products.length,
    outOfStock: products.filter((product) => product.stock === 0).length,
    price: {
      currency: "PEN",
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
      average: prices.length
        ? Number((prices.reduce((sum, p) => sum + p, 0) / prices.length).toFixed(2))
        : null,
    },
    reviews: {
      productsWithReviews: rated.length,
      averageRating: rated.length
        ? Number(
            (
              rated.reduce((sum, p) => sum + (p.average_rating ?? 0), 0) / rated.length
            ).toFixed(2),
          )
        : null,
    },
    byCategory: categories,
    topSelling,
  };
}
