// Tipos de dominio del catálogo. Derivan de `types/database.ts` (generado); si
// el esquema cambia, se regenera con `npm run db:types` y el compilador señala
// aquí lo que quedó desalineado.
import type { Database } from "@/types/database";
import type { ProductCondition } from "@/lib/constants/roles";

/**
 * Producto tal como lo consumen las pantallas.
 *
 * Sobre la fila cruda se añaden campos que NO existen como columna:
 * - `price`: la columna es `numeric(12,2)` y PostgREST la envía como string
 *   pese a que los tipos generados digan `number`. El service la convierte con
 *   `Number()`; declararlo aquí documenta que ya viene parseado.
 * - `condition`: en la BD es `text` con un CHECK; se estrecha a la unión que
 *   ya define `lib/constants/roles.ts` para que el compilador cubra los casos.
 * - `image_url`: URL pública ya resuelta por `storage.service` (3.4). Los
 *   componentes nunca reciben el `image_path` crudo.
 * - `average_rating` / `review_count`: agregados de `reviews`, calculados por
 *   el service. `average_rating` es null cuando el producto no tiene reseñas.
 */
export type Product = Database["public"]["Tables"]["products"]["Row"] & {
  price: number;
  condition: ProductCondition;
  image_url: string | null;
  average_rating: number | null;
  review_count: number;
};

/** Imagen de la galería, con la URL pública ya resuelta y ordenada por `position`. */
export type ProductImage =
  Database["public"]["Tables"]["product_images"]["Row"] & {
    image_url: string;
  };

/** Categoría del catálogo, para los filtros de la 3.4. */
export type Category = Database["public"]["Tables"]["categories"]["Row"];
