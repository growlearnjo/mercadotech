/**
 * Formateo único de resultados. Cada tool devuelve DOS representaciones de lo
 * mismo: un texto que un modelo puede leer sin parsear nada, y el JSON
 * estructurado para quien sí quiera procesarlo. Que viva en un solo archivo
 * evita que cada tool invente su propio formato.
 */
import { describeError } from "./errors";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

export function toolResult(data: unknown, summary?: string): ToolResult {
  const json = JSON.stringify(data, null, 2);
  return {
    content: [{ type: "text", text: summary ? `${summary}\n\n${json}` : json }],
  };
}

/**
 * Un error es un RESULTADO de la tool (`isError: true`), no una excepción que
 * escapa: el protocolo espera que el servidor siga vivo y el modelo pueda
 * leer qué pasó y reintentar con otros parámetros.
 */
export function toolError(error: unknown): ToolResult {
  const { kind, message } = describeError(error);
  return {
    content: [{ type: "text", text: `[${kind}] ${message}` }],
    isError: true,
  };
}
