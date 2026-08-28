/** Errores tipados del servidor. El mensaje lo lee un modelo: debe ser accionable. */

export type McpErrorKind = "no_encontrado" | "input_invalido" | "proveedor" | "interno";

export class McpError extends Error {
  constructor(
    readonly kind: McpErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "McpError";
  }
}

export const notFound = (what: string, id: string): McpError =>
  new McpError("no_encontrado", `No existe ${what} con id ${id}.`);

export const invalidInput = (detail: string): McpError =>
  new McpError("input_invalido", `Input inválido: ${detail}`);

/**
 * Errores del proveedor de IA. `lib/ai/` ya emite mensajes accionables
 * (401 / modelo dormido / cuota agotada): se propagan tal cual en vez de
 * envolverlos en un texto genérico que perdería el diagnóstico.
 */
export const providerFailure = (cause: unknown): McpError =>
  new McpError(
    "proveedor",
    cause instanceof Error ? cause.message : `Fallo del proveedor de IA: ${String(cause)}`,
  );

/**
 * Nadie fuera de aquí decide cómo se ve un error al cliente MCP.
 *
 * OJO con los errores de Supabase: PostgrestError es un OBJETO PLANO
 * ({ message, code, details, hint }), no una instancia de Error. Los services
 * los relanzan tal cual, así que sin este caso `String(error)` produciría
 * "[object Object]" y el diagnóstico se perdería entero.
 */
export function describeError(error: unknown): { kind: McpErrorKind; message: string } {
  if (error instanceof McpError) return { kind: error.kind, message: error.message };
  if (error instanceof Error) return { kind: "interno", message: error.message };

  if (error && typeof error === "object" && "message" in error) {
    const pg = error as { message: unknown; code?: unknown; hint?: unknown; details?: unknown };
    const parts = [String(pg.message)];
    if (pg.code) parts.push(`(code ${String(pg.code)})`);
    if (pg.details) parts.push(String(pg.details));
    if (pg.hint) parts.push(`Sugerencia: ${String(pg.hint)}`);
    return { kind: "interno", message: parts.join(" ") };
  }

  return { kind: "interno", message: String(error) };
}
