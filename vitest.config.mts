// Configuración de Vitest (Fase 6.1). El taller de pruebas unitarias:
// abre en milisegundos, sin red y sin base de datos.
//
// Extensión .mts y no .ts (desviación menor de la tabla de la spec): la raíz
// no declara `"type": "module"`, así que Vite cargaría un `.ts` como
// CommonJS y avisa de que la sintaxis ESM de aquí será un error en una
// versión futura. `.mts` es ESM sin ambigüedad y Vitest lo descubre solo.
//
// Los E2E NO viven aquí: Playwright tiene su propio runner y su propio
// config (Fase 6.4). Por eso `e2e/` está excluido explícitamente — si no,
// Vitest intentaría ejecutar los specs de Playwright y fallaría al importar
// `@playwright/test`.

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    // Mismo alias que tsconfig.json ("@/*" → "./*"): un test importa
    // `@/services/cart.service`, igual que lo hace la app. Sin esto, los
    // tests tendrían rutas relativas largas que se rompen al mover archivos.
    alias: {
      "@": projectRoot,
    },
  },
  test: {
    // Environment `node`, no jsdom (decisión 6 de la spec): esta sesión no
    // testea componentes React, así que un DOM simulado sería peso muerto.
    environment: "node",
    // Convención de la sesión: el test vive JUNTO al archivo que prueba
    // (`cart.service.test.ts` al lado de `cart.service.ts`).
    include: ["**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      // El servidor MCP tiene su propio type-check y no se testea en esta
      // sesión (restricción de la spec).
      "mcp/**",
      // Specs de Playwright: los corre `npm run test:e2e`.
      "e2e/**",
      ".next/**",
      // Worktrees efímeros de Claude Code: copias completas del repo.
      ".claude/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // La cobertura se mide donde hay metas (spec: validators y
      // context-builder al 100 % de ramas, services ≥ 80 % de líneas).
      // Incluir `app/` o `components/` diluiría el número con código que
      // esta sesión decidió no testear.
      include: ["lib/**/*.ts", "services/**/*.ts"],
      exclude: ["**/*.test.ts", "services/test-utils/**"],
    },
  },
});
