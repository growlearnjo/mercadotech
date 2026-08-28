import path from "node:path";
import { defineConfig } from "tsup";

/**
 * Build de producción del servidor MCP. Dos cosas no negociables:
 *
 * 1. `alias`: fuera de Next nadie resuelve `@/*` por nosotros. tsup necesita
 *    que le digamos que apunta a la RAÍZ del repo (un nivel arriba), o los
 *    imports de `@/services/*` y `@/lib/ai/*` fallan en el bundle.
 * 2. `noExternal`: los services y lib/ai son código FUENTE del repo, no
 *    paquetes de node_modules; tienen que entrar al bundle. Las dependencias
 *    reales (SDK, supabase-js, huggingface) quedan externas y se resuelven
 *    desde node_modules en tiempo de ejecución.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  esbuildOptions(options) {
    options.alias = { "@": path.resolve(__dirname, "..") };
  },
});
