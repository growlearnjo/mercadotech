import type { KnowledgeSourceType } from "@/services/embedding.service";

/**
 * Dispara la reindexación de una fuente sin esperar el resultado.
 * Best-effort a propósito: publicar/editar un producto debe funcionar
 * EXACTAMENTE igual que en la sesión 3, incluso si Hugging Face está caído
 * o el token falta — nunca bloquea, nunca lanza, nunca muestra un error al
 * vendedor. Si falla, solo queda un `console.warn` (el plan B es
 * `npx tsx scripts/index-all.ts`).
 */
export function triggerReindex(
  sourceType: KnowledgeSourceType,
  sourceId: string,
): void {
  void fetch("/api/v1/reindex", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceType, sourceId }),
  })
    .then((res) => {
      if (!res.ok) {
        console.warn(
          `[indexing-trigger] reindexar ${sourceType}:${sourceId} devolvió ${res.status}`,
        );
      }
    })
    .catch((err) => {
      console.warn(
        `[indexing-trigger] no se pudo reindexar ${sourceType}:${sourceId}`,
        err,
      );
    });
}
