import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Convención del proyecto: un identificador con prefijo `_` se descarta
      // a propósito. `ignoreRestSiblings` cubre el patrón de omitir campos de
      // un objeto con rest (`const { a: _a, ...resto } = fila`), que usan los
      // services al mapear filas de PostgREST a tipos de dominio.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Los E2E de Playwright no son React. La fixture recibe una funcion
    // llamada `use()` y la regla react-hooks la confunde con un hook llamado
    // fuera de un componente: es un falso positivo estructural, no un
    // descuido, asi que la regla se apaga SOLO aqui.
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Artefactos generados por el CLI de Supabase (`supabase start`):
      // bundles minificados del edge runtime, no son codigo del proyecto.
      "supabase/.temp/**",
      // Reporte HTML de cobertura que genera Vitest (`npm run test:coverage`):
      // artefacto regenerable, ya ignorado por git.
      "coverage/**",
      // Worktrees efimeros que crea Claude Code: son copias completas del
      // repo (con su propio node_modules) y no son codigo del proyecto.
      ".claude/worktrees/**",
      // Bundle del servidor MCP producido por tsup (`npm run build` en mcp/):
      // codigo generado, ya cubierto por el lint de su fuente en mcp/src/.
      "mcp/dist/**",
    ],
  },
];

export default eslintConfig;
