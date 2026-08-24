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
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Artefactos generados por el CLI de Supabase (`supabase start`):
      // bundles minificados del edge runtime, no son codigo del proyecto.
      "supabase/.temp/**",
    ],
  },
];

export default eslintConfig;
