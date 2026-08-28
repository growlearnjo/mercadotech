import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, errorMessage } from "@/lib/api-response";
import { CHAT_QUERY_MAX_CHARS } from "@/lib/constants/ai";
import { ask } from "@/services/chat.service";
import type { ChatMode } from "@/types/chat";

function isChatMode(value: unknown): value is ChatMode {
  return value === "compras" || value === "soporte";
}

/**
 * Endpoint de los dos asistentes (Fase 4.7 los consume). Requiere sesión
 * (decisión 1) y usa el cliente de SESIÓN: la RLS de knowledge_embeddings
 * aplica tal cual, igual que en /api/v1/search/semantic.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError(401, "unauthorized", "Debes iniciar sesión para usar el asistente.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_body", "El cuerpo debe ser JSON válido.");
  }

  const { query, mode } = (body ?? {}) as { query?: unknown; mode?: unknown };

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
  if (!isChatMode(mode)) {
    return apiError(422, "invalid_mode", "mode debe ser 'compras' o 'soporte'.");
  }

  try {
    const result = await ask(query, mode, {}, supabase);

    // Log estructurado por consulta: insumo de la calibración (Fase 4.8).
    console.log(
      JSON.stringify({
        endpoint: "chat",
        mode,
        retrievedCount: result.metadata.retrievedCount,
        usedSourceCount: result.metadata.usedSourceCount,
        hasRelevantContext: result.hasRelevantContext,
        model: result.metadata.model,
      }),
    );

    return NextResponse.json(result);
  } catch (err) {
    return apiError(
      500,
      "chat_failed",
      errorMessage(err, "Error desconocido al conversar."),
    );
  }
}
