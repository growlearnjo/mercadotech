/**
 * Descarga imágenes de muestra y las sube a Supabase Storage.
 *
 * El seed (Fase 2.5) crea las filas de `product_images` con sus `image_path`,
 * pero NO los archivos: sin esto el catálogo se ve entero con placeholders.
 * Este script cierra ese hueco para poder probar el flujo con imágenes reales.
 *
 * Fuente: Lorem Picsum (picsum.photos), que sirve fotos de Unsplash bajo una
 * licencia que permite este uso. Son fotos genéricas, no del producto real:
 * las fotos de producto de una tienda están protegidas por copyright y no se
 * pueden reutilizar aquí.
 *
 * Uso:
 *   npm run db:images            # descarga las que falten y sube todo
 *   npm run db:images -- --force # vuelve a descargar aunque existan
 *
 * Las rutas se leen de un manifiesto que genera `npm run db:images` con psql,
 * y no por la API REST: el rol `service_role` no tiene GRANT de SELECT sobre
 * `public.product_images` (los GRANTs de la Fase 2.3 son para anon/authenticated)
 * y no se tocan migraciones existentes solo para este script de apoyo.
 *
 * Requiere el stack local levantado (`supabase start`) y las variables de
 * .env.local. Es idempotente: se puede reejecutar tras un `supabase db reset`.
 */

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "supabase", "seed-images");
const BUCKET = "product-images";

/** Tamaño de descarga: cuadrado, suficiente para la card y el detalle. */
const SIZE = 800;
/** Peticiones simultáneas: picsum limita, y 6 es cortés y rápido a la vez. */
const CONCURRENCY = 6;

const force = process.argv.includes("--force");

/** Lee .env.local sin depender de dotenv. */
async function loadEnv() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return env;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Ejecuta `worker` sobre `items` con un tope de tareas en paralelo. */
async function pool(items, limit, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }

  // Service role: subir a Storage salta las políticas RLS, que solo permiten
  // al vendedor dueño subir en su carpeta. Este script es de administración.
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  await mkdir(OUT_DIR, { recursive: true });

  const manifestPath = join(OUT_DIR, "manifest.json");
  let rows;
  try {
    rows = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    throw new Error(
      `No existe ${manifestPath}. Genéralo con:
` +
        `  docker exec -i supabase_db_mercadotech psql -U postgres -d postgres -At ` +
        `-c "select json_agg(json_build_object('image_path', image_path)) from public.product_images" ` +
        `> supabase/seed-images/manifest.json`,
    );
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log("Manifiesto vacío. ¿Corriste `supabase db reset`?");
    return;
  }
  console.log(`${rows.length} imágenes a procesar → ${OUT_DIR}`);

  let descargadas = 0;
  let reutilizadas = 0;
  let subidas = 0;
  const fallos = [];

  await pool(rows, CONCURRENCY, async (row) => {
    const localPath = join(OUT_DIR, row.image_path.replaceAll("/", "__"));
    try {
      let bytes;
      if (!force && (await exists(localPath))) {
        bytes = await readFile(localPath);
        reutilizadas++;
      } else {
        // `seed` fija la foto por ruta: reejecutar da SIEMPRE la misma imagen,
        // así el catálogo no cambia de aspecto entre ejecuciones. Se usa un
        // hash y no la ruta: picsum devuelve 404 si el seed lleva barras,
        // incluso codificadas como %2F.
        const seed = createHash("sha1")
          .update(row.image_path)
          .digest("hex")
          .slice(0, 12);
        const src = `https://picsum.photos/seed/${seed}/${SIZE}/${SIZE}.jpg`;
        const response = await fetch(src, { redirect: "follow" });
        if (!response.ok) throw new Error(`descarga ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
        await writeFile(localPath, bytes);
        descargadas++;
      }

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(row.image_path, bytes, {
          contentType: "image/jpeg",
          upsert: true, // idempotente: reejecutar no falla ni duplica
        });
      if (upErr) throw upErr;
      subidas++;
    } catch (err) {
      fallos.push(`${row.image_path}: ${err.message ?? err}`);
    }
  });

  console.log(
    `\nDescargadas: ${descargadas}  ·  reutilizadas de disco: ${reutilizadas}  ·  subidas a Storage: ${subidas}`,
  );
  if (fallos.length) {
    console.log(`\nFallos (${fallos.length}):`);
    for (const f of fallos) console.log("  -", f);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
