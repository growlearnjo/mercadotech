/**
 * One-shot: indexa TODOS los productos activos y artículos de soporte
 * publicados en knowledge_embeddings. Uso:
 *
 *   npx tsx scripts/index-all.ts
 *
 * También es la vía de reindexación si el ADMIN edita un artículo de
 * soporte directamente por SQL (Studio): esta sesión no tiene UI de edición
 * de FAQ, así que un cambio manual en support_articles solo se refleja en
 * knowledge_embeddings volviendo a correr este script.
 *
 * No importa lib/supabase/admin.ts: ese archivo trae `import "server-only"`,
 * un guard que solo el bundler de Next.js sabe neutralizar (bajo Node/tsx
 * puro, fuera de Next, ese paquete lanza siempre — comprobado). Se construye
 * aquí un cliente equivalente con la misma service role key; el cliente
 * admin sigue confinado a este archivo y a app/api/v1/reindex/route.ts, tal
 * como exige la spec — solo cambia CÓMO se instancia, no quién lo usa.
 * Mismo patrón que scripts/seed-images.mjs (parseo manual de .env.local, sin
 * depender de dotenv).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { indexKnowledgeSource } from "@/services/embedding.service";

const ROOT = path.resolve(__dirname, "..");

function loadEnvLocal(): void {
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

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id")
    .eq("is_active", true);
  if (productsError) throw productsError;

  const { data: articles, error: articlesError } = await admin
    .from("support_articles")
    .select("id")
    .eq("is_published", true);
  if (articlesError) throw articlesError;

  let productsIndexed = 0;
  for (const product of products ?? []) {
    const result = await indexKnowledgeSource("producto", product.id, admin);
    if (result.indexed) productsIndexed++;
  }

  let articlesIndexed = 0;
  for (const article of articles ?? []) {
    const result = await indexKnowledgeSource(
      "articulo_soporte",
      article.id,
      admin,
    );
    if (result.indexed) articlesIndexed++;
  }

  console.log(`Productos indexados: ${productsIndexed}/${products?.length ?? 0}`);
  console.log(`Artículos indexados: ${articlesIndexed}/${articles?.length ?? 0}`);
  console.log(`Total fichas: ${productsIndexed + articlesIndexed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
