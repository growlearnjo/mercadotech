/**
 * Cliente JSON-RPC mínimo por stdio para ejercitar el servidor sin UI.
 * Complementa al MCP Inspector (`npx @modelcontextprotocol/inspector --cli …`):
 * el Inspector es la lupa manual; esto deja la MISMA evidencia reproducible en
 * un comando, que es lo que la spec pide guardar por fase.
 *
 *   node mcp/scripts/rpc.mjs '<metodo>' '<paramsJSON>' ...
 *   node mcp/scripts/rpc.mjs tools/list
 *   node mcp/scripts/rpc.mjs tools/call '{"name":"search_products","arguments":{"search":"laptop"}}'
 */
import { spawn } from "node:child_process";

const calls = [];
for (let i = 2; i < process.argv.length; i += 2) {
  calls.push({ method: process.argv[i], params: JSON.parse(process.argv[i + 1] ?? "{}") });
}

// MCP_TARGET=dist prueba el build de producción; por defecto, el fuente con tsx.
const target =
  process.env.MCP_TARGET === "dist"
    ? { cmd: "node", args: ["mcp/dist/index.js"] }
    : { cmd: "npx", args: ["tsx", "mcp/src/index.ts"] };

const child = spawn(target.cmd, target.args, {
  stdio: ["pipe", "pipe", "inherit"],
  shell: process.platform === "win32",
});

let buffer = "";
const pending = new Map();
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let index;
  while ((index = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      console.error("STDOUT CORRUPTO (no es JSON-RPC):", line);
      process.exitCode = 1;
      continue;
    }
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
      resolve(msg);
    }
  }
});

let nextId = 1;
const send = (method, params) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });

const init = await send("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "rpc-evidence", version: "1.0.0" },
});
child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
console.log("== initialize ==");
console.log(JSON.stringify(init.result ?? init.error, null, 2));

for (const { method, params } of calls) {
  const res = await send(method, params);
  console.log(`\n== ${method} ${JSON.stringify(params)} ==`);
  console.log(JSON.stringify(res.result ?? res.error, null, 2));
}

child.kill();
