/**
 * Registro central de resources. Cada uno captura sus propios errores vía
 * `safeResourceText`: si Supabase está caído, `resources/list` sigue
 * respondiendo y cada folleto explica por qué no pudo llenarse (lección 7).
 */
import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { listActiveProducts } from "@/services/product.service";
import { createContext } from "../context";
import { safeResourceText } from "../lib/safe";
import { listPublishedArticles } from "../shared/faq";
import { getProductDetail } from "../shared/product-detail";
import { categoriesWithCount, storeStats } from "../shared/stats";
import { SERVER_NAME, SERVER_VERSION } from "../server-meta";
import { getSellerProfile, listSellerIds } from "../shared/sellers";

const JSON_MIME = "application/json";

export function registerResources(server: McpServer): number {
  // 1. info — estático a propósito: es el único resource que responde aunque
  //    la base entera esté caída, y da al cliente algo con qué orientarse.
  server.registerResource(
    "info",
    "mercadotech://info",
    {
      title: "Qué es MercadoTech",
      description: "Descripción de la plataforma y de lo que ofrece este servidor.",
      mimeType: JSON_MIME,
    },
    async (uri) =>
      safeResourceText(uri.href, async () => ({
        plataforma: "MercadoTech",
        resumen:
          "Marketplace de productos tecnológicos: compradores navegan un catálogo, " +
          "ven detalle con galería, preguntas y reseñas verificadas, agregan al " +
          "carrito y hacen checkout; los vendedores publican y gestionan pedidos.",
        importante:
          "El checkout es SIMULADO: crea el pedido y descuenta stock, sin cobrar. " +
          "No hay pasarela de pago real en ninguna parte del proyecto.",
        moneda: "PEN (soles peruanos)",
        servidor: { nombre: SERVER_NAME, version: SERVER_VERSION, modo: "solo lectura" },
        queOfrece: {
          tools: "Buscar, comparar y consultar productos, categorías, reseñas, " +
            "estadísticas y estado de pedidos; y preguntar a los asistentes con RAG.",
          resources: "Catálogo, categorías, FAQ, vendedores y estadísticas por URI.",
          prompts: "Plantillas para describir productos, compararlos, responder " +
            "preguntas, resumir reseñas y redactar artículos de FAQ.",
        },
        privacidad:
          "Ninguna tool o resource expone datos personales de compradores: ni " +
          "nombres, ni emails, ni teléfonos, ni carritos, ni tickets.",
      })),
  );

  // 2. products — anon: el catálogo activo es público.
  server.registerResource(
    "products",
    "mercadotech://products",
    {
      title: "Catálogo de productos activos",
      description: "Resumen de todos los productos activos: id, título, precio y categoría.",
      mimeType: JSON_MIME,
    },
    async (uri) =>
      safeResourceText(uri.href, async () => {
        const { anon } = createContext();
        const { items, total } = await listActiveProducts({ page: 1 }, anon);
        return {
          total,
          nota: total > items.length
            ? `Se muestran ${items.length} de ${total}. Usa la tool search_products con 'page' para el resto.`
            : undefined,
          items: items.map((product) => ({
            id: product.id,
            title: product.title,
            price: product.price,
            currency: "PEN",
            condition: product.condition,
            stock: product.stock,
          })),
        };
      }),
  );

  // 3. products/{id} — template. Misma función compartida que la tool
  //    get_product: una sola forma de "detalle" en todo el servidor.
  server.registerResource(
    "product",
    new ResourceTemplate("mercadotech://products/{productId}", {
      list: async () => {
        try {
          const { anon } = createContext();
          const { items } = await listActiveProducts({ page: 1 }, anon);
          return {
            resources: items.map((product) => ({
              uri: `mercadotech://products/${product.id}`,
              name: product.title,
              mimeType: JSON_MIME,
            })),
          };
        } catch {
          // El listado no puede tumbar resources/list entero (lección 7).
          return { resources: [] };
        }
      },
    }),
    {
      title: "Detalle de un producto",
      description: "Ficha completa: descripción, precio, stock, imágenes, rating y preguntas.",
      mimeType: JSON_MIME,
    },
    async (uri, variables) =>
      safeResourceText(uri.href, async () => {
        const { anon } = createContext();
        return getProductDetail(String(variables.productId), anon);
      }),
  );

  // 4. categories — anon, misma derivación que la tool list_categories.
  server.registerResource(
    "categories",
    "mercadotech://categories",
    {
      title: "Categorías con conteo",
      description: "Las categorías del catálogo con su slug y cuántos productos activos tienen.",
      mimeType: JSON_MIME,
    },
    async (uri) =>
      safeResourceText(uri.href, async () => {
        const { anon } = createContext();
        return categoriesWithCount(anon);
      }),
  );

  // 5. sellers/{id} — ADMIN: `profiles_select_own_or_admin` no concede SELECT
  //    público, así que anon no vería ningún vendedor. Expone SOLO
  //    display_name y los productos activos; jamás phone, email ni rol.
  server.registerResource(
    "seller",
    new ResourceTemplate("mercadotech://sellers/{sellerId}", {
      list: async () => {
        try {
          const context = createContext();
          const sellers = await listSellerIds(context.anon, context.admin);
          return {
            resources: sellers.map((seller) => ({
              uri: `mercadotech://sellers/${seller.id}`,
              name: seller.displayName,
              mimeType: JSON_MIME,
            })),
          };
        } catch {
          return { resources: [] };
        }
      },
    }),
    {
      title: "Vendedor",
      description: "Nombre público del vendedor y sus productos activos. Nada más de su perfil.",
      mimeType: JSON_MIME,
    },
    async (uri, variables) =>
      safeResourceText(uri.href, async () => {
        const context = createContext();
        return getSellerProfile(String(variables.sellerId), context.anon, context.admin);
      }),
  );

  // 6. faq — anon: `support_articles_select_published_or_admin` concede SELECT
  //    a anon cuando is_published.
  server.registerResource(
    "faq",
    "mercadotech://faq",
    {
      title: "Preguntas frecuentes",
      description: "Artículos de soporte publicados: envíos, pagos, devoluciones y cuenta.",
      mimeType: JSON_MIME,
    },
    async (uri) =>
      safeResourceText(uri.href, async () => {
        const { anon } = createContext();
        return listPublishedArticles(anon);
      }),
  );

  // 7. stats — misma derivación que la tool get_store_stats.
  server.registerResource(
    "stats",
    "mercadotech://stats",
    {
      title: "Estadísticas de la tienda",
      description: "Agregados del catálogo: conteos, precios, ratings y top de vendidos.",
      mimeType: JSON_MIME,
    },
    async (uri) =>
      safeResourceText(uri.href, async () => {
        const context = createContext();
        return storeStats(context.anon, context.admin);
      }),
  );

  return 7;
}
