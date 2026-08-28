// PRIMERA línea: neutraliza console.log/info/warn ANTES de que se evalúe
// cualquier otro import. stdout transporta JSON-RPC y un solo log lo corrompe.
import "./lib/stdout-guard";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { assertEnv, envReport, loadEnvLocal } from "./env";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server";

async function main(): Promise<void> {
  loadEnvLocal();
  assertEnv();

  const server = createServer();
  await server.connect(new StdioServerTransport());

  // Diagnóstico por stderr: es el único canal que no rompe el protocolo.
  console.error(`[${SERVER_NAME}] v${SERVER_VERSION} listo por stdio — ${envReport()}`);
}

main().catch((error: unknown) => {
  console.error(`[${SERVER_NAME}] fallo al arrancar:`, error);
  process.exit(1);
});
