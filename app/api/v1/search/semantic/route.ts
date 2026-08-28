import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, errorMessage } from "@/lib/api-response";
import { CHAT_QUERY_MAX_CHARS } from "@/lib/constants/ai";
import { searchProducts } from "@/services/vector-search.service";

/**
 * Búsqueda semántica del catálogo (pestaña "Resultados con IA" de /buscar).
 * Requiere sesión (decisión 1) y usa el cliente de SESIÓN, no el admin: el
 * embedding de la consulta se genera aquí, server-side — el token de
 * Hugging Face nunca viaja al navegador.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError(
      401,
      "unauthorized",
      "Debes iniciar sesión para usar la búsqueda inteligente.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_body", "El cuerpo debe ser JSON válido.");
  }

  const { query } = (body ?? {}) as { query?: unknown };
  if (typeof query !== "string" || query.trim() === "") {
    return apiError(400, "invalid_query", "query es requerido.");
  }
  if (query.length > CHAT_QUERY_MAX_CHARS) {
    return apiError(
      422,
      "query_too_long",
      `query no puede superar ${CHAT_QUERY_MAX_CHARS} caracteres.`,
    );
  }

  try {
    const results = await searchProducts(query, {}, supabase);
    return NextResponse.json({ results });
  } catch (err) {
    return apiError(
      500,
      "search_failed",
      errorMessage(err, "Error desconocido al buscar."),
    );
  }
}
