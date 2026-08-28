/**
 * Node NO carga `.env.local` solo — eso lo hace Next. Este servidor corre
 * como proceso Node independiente, así que parsea a mano la MISMA
 * `.env.local` de la raíz del repo: una sola fuente de credenciales, sin
 * duplicar secretos en `mcp/`.
 *
 * Mismo patrón (deliberadamente idéntico) que `loadEnvLocal` de
 * `scripts/index-all.ts`, que ya se golpeó con esto en la sesión 4.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Raíz del repositorio: dos niveles arriba de `mcp/src/`. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Sin estas dos, ninguna tool puede responder: se falla al arrancar. */
const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

/**
 * Opcionales con degradación conocida: sin service role no funcionan las
 * tools que necesitan bypasear RLS; sin token de Hugging Face no funcionan
 * las semánticas. El servidor arranca igual y esas tools devuelven un error
 * accionable — nunca se cae el proceso entero.
 */
const OPTIONAL = ["SUPABASE_SERVICE_ROLE_KEY", "HUGGINGFACEHUB_API_TOKEN"] as const;

export function loadEnvLocal(): void {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(index + 1).trim();
  }
}

/**
 * Falla ruidosamente (por stderr, y matando el proceso) si falta lo
 * imprescindible: es preferible a un servidor que arranca y contesta errores
 * incomprensibles a cada llamada.
 */
export function assertEnv(): void {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno: ${missing.join(", ")}.\n` +
        `Se leen de .env.local en la raíz del repo (${ROOT}).\n` +
        `Lanza el servidor DESDE LA RAÍZ: npx tsx mcp/src/index.ts`,
    );
  }
}

/** Para diagnóstico por stderr al arrancar; nunca imprime valores. */
export function envReport(): string {
  const optional = OPTIONAL.map(
    (key) => `${key}=${process.env[key] ? "presente" : "AUSENTE (degradación)"}`,
  );
  return optional.join(" · ");
}
