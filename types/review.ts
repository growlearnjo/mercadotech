// Tipos de dominio de reseñas.
import type { Database } from "@/types/database";

/**
 * Reseña verificada. `order_id` es obligatorio en el esquema: solo puede
 * reseñar quien compró, y por eso toda reseña es verificable por construcción.
 *
 * `author_label` no es una columna: RLS impide leer el perfil de otros
 * usuarios (decisión 8), así que el service entrega una etiqueta genérica
 * ("Comprador verificado") en lugar del nombre real.
 */
export type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  author_label: string;
};
