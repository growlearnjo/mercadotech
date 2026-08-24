// Tipos de dominio de preguntas y respuestas del producto.
import type { Database } from "@/types/database";

/**
 * Pregunta sobre un producto. `answer` y `answered_at` son null mientras el
 * vendedor no responda; la UI usa eso para separar respondidas de pendientes.
 */
export type Question = Database["public"]["Tables"]["questions"]["Row"];
