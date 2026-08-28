import { NextResponse } from "next/server";

/** Respuesta de error consistente para los Route Handlers de app/api/v1/. */
export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Mensaje legible de un error desconocido, para el `catch` de un Route Handler.
 *
 * Existe porque `err instanceof Error` NO cubre los errores de Supabase: un
 * PostgrestError es un OBJETO PLANO ({ message, code, details, hint }) y los
 * services lo relanzan tal cual. Sin este caso, cualquier fallo de base de
 * datos terminaba en un "Error desconocido…" genérico que tiraba a la basura
 * el diagnóstico que Postgres sí manda — incluida su sugerencia literal de
 * cómo arreglarlo.
 *
 * Detectado en la sesión 5: el servidor MCP se golpeó con esto primero
 * (mcp/src/lib/errors.ts documenta el mismo caso) y la revisión encontró que
 * los tres Route Handlers lo arrastraban desde la sesión 4.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;

  if (err && typeof err === "object" && "message" in err) {
    const pg = err as { message: unknown; code?: unknown; hint?: unknown };
    const parts = [String(pg.message)];
    if (pg.code) parts.push(`(code ${String(pg.code)})`);
    if (pg.hint) parts.push(`Sugerencia: ${String(pg.hint)}`);
    return parts.join(" ");
  }

  return fallback;
}
