import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api-response";
import {
  indexKnowledgeSource,
  type KnowledgeSourceType,
} from "@/services/embedding.service";

function isSourceType(value: unknown): value is KnowledgeSourceType {
  return value === "producto" || value === "articulo_soporte";
}

/**
 * Reindexa una fuente (producto o artículo de soporte). Primer Route
 * Handler del proyecto: existe porque el cliente admin (service role) y el
 * token de Hugging Face no pueden viajar al navegador — exactamente el caso
 * "server-only" que la sesión 2 reservó app/api/v1/ para atender.
 *
 * Requiere sesión (decisión 1: la IA exige sesión) pero usa el cliente
 * ADMIN para escribir en knowledge_embeddings — la sesión solo autoriza la
 * llamada, no gobierna el INSERT/UPDATE/DELETE (sin política ni GRANT para
 * authenticated ahí, Fase 4.1).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError(401, "unauthorized", "Debes iniciar sesión para reindexar.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_body", "El cuerpo debe ser JSON válido.");
  }

  const { sourceType, sourceId } = (body ?? {}) as {
    sourceType?: unknown;
    sourceId?: unknown;
  };

  if (!isSourceType(sourceType)) {
    return apiError(
      400,
      "invalid_source_type",
      "sourceType debe ser 'producto' o 'articulo_soporte'.",
    );
  }
  if (typeof sourceId !== "string" || sourceId.trim() === "") {
    return apiError(400, "invalid_source_id", "sourceId es requerido.");
  }

  try {
    const admin = createAdminClient();
    const result = await indexKnowledgeSource(sourceType, sourceId, admin);
    return NextResponse.json(result);
  } catch (err) {
    return apiError(
      500,
      "reindex_failed",
      err instanceof Error ? err.message : "Error desconocido al reindexar.",
    );
  }
}
