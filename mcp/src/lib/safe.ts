/**
 * Envoltorio try/catch uniforme: TODA tool y TODO resource pasa por aquí.
 * Ninguna excepción puede escapar hasta el transporte — si escapa, se cae el
 * proceso y con él la sesión del cliente (lección 7 de la spec: un elemento
 * caído no puede tumbar al resto).
 */
import { describeError } from "./errors";
import { toolError, type ToolResult } from "./tool-result";

/** Para handlers de tools: el error vuelve como resultado con `isError`. */
export function safeTool<Args extends unknown[]>(
  handler: (...args: Args) => Promise<ToolResult>,
): (...args: Args) => Promise<ToolResult> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return toolError(error);
    }
  };
}

/**
 * Para lecturas de resources: devuelve el error como CONTENIDO del resource.
 * Así `resources/list` y una lectura individual siguen respondiendo aunque
 * Supabase esté caído — el cliente ve el problema, no un silencio.
 */
export async function safeResourceText(
  uri: string,
  read: () => Promise<unknown>,
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  try {
    const data = await read();
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }],
    };
  } catch (error) {
    const { kind, message } = describeError(error);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({ error: { kind, message } }, null, 2),
        },
      ],
    };
  }
}
