/** #6 — anon: productos y agregados de reseñas son públicos. */
import { z } from "zod";
import { getProductsByIds } from "@/services/product.service";
import { getAverage } from "@/services/review.service";
import { createContext } from "../context";
import { invalidInput } from "../lib/errors";
import { safeTool } from "../lib/safe";
import { toolResult } from "../lib/tool-result";

export const compareProductsTool = {
  name: "compare_products",
  config: {
    title: "Comparar productos",
    description:
      "¿En qué se diferencian estos productos? Recibe entre 2 y 4 ids y devuelve una " +
      "comparación estructurada: precio, condición, stock, marca, modelo, " +
      "especificaciones y rating de cada uno, más el rango de precios. No opina: " +
      "entrega los datos alineados para que la decisión la tome quien pregunta.",
    inputSchema: {
      productIds: z
        .array(z.string().uuid())
        .min(2)
        .max(4)
        .describe("Entre 2 y 4 ids de productos activos"),
    },
  },
  handler: safeTool(async ({ productIds }: { productIds: string[] }) => {
    const { anon } = createContext();
    const products = await getProductsByIds(productIds, anon);

    const missing = productIds.filter((id) => !products.some((p) => p.id === id));
    if (products.length < 2) {
      throw invalidInput(
        `se necesitan al menos 2 productos activos; no se encontraron: ${missing.join(", ")}`,
      );
    }

    const ratings = await Promise.all(
      products.map((product) => getAverage(product.id, anon)),
    );
    const prices = products.map((product) => product.price);

    return toolResult({
      // Se informan los ids que no resolvieron en vez de callarlos: quien
      // pregunta debe saber que comparó menos de lo que pidió.
      notFound: missing,
      priceRange: { min: Math.min(...prices), max: Math.max(...prices), currency: "PEN" },
      products: products.map((product, index) => ({
        id: product.id,
        title: product.title,
        price: product.price,
        condition: product.condition,
        stock: product.stock,
        brand: product.brand,
        // `products` no tiene `model` ni `specs` en el esquema real: lo más
        // cercano a una ficha técnica es la descripción del vendedor.
        description: product.description,
        rating: ratings[index].average,
        reviewCount: ratings[index].count,
      })),
    });
  }),
};
