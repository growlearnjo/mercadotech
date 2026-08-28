/**
 * Identidad y capacidades del servidor. Las tools, resources y prompts se
 * registran desde aquí (fases 5.3 y 5.4); en la 5.2 arranca vacío a
 * propósito: conectar sin errores ES el éxito de esta fase.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index";

export const SERVER_NAME = "mercadotech";
export const SERVER_VERSION = "0.1.0";

export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Mostrador de solo lectura del marketplace MercadoTech: catálogo de " +
        "productos tecnológicos, preguntas y reseñas, FAQ de soporte y dos " +
        "asistentes con RAG (compras y soporte). Ninguna operación modifica " +
        "datos y ninguna expone información personal de compradores.",
      capabilities: { tools: {}, resources: {}, prompts: {} },
    },
  );

  registerTools(server);

  return server;
}
