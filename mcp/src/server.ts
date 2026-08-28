/**
 * Identidad y capacidades del servidor. Las tools, resources y prompts se
 * registran desde aquí (fases 5.3 y 5.4); en la 5.2 arranca vacío a
 * propósito: conectar sin errores ES el éxito de esta fase.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_NAME, SERVER_VERSION } from "./server-meta";
import { registerResources } from "./resources/index";
import { registerPrompts } from "./prompts/index";
import { registerTools } from "./tools/index";

export { SERVER_NAME, SERVER_VERSION } from "./server-meta";

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
  registerResources(server);
  registerPrompts(server);

  return server;
}
