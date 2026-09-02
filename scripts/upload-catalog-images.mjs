/**
 * Sube a Storage las imágenes del catálogo de demostración (producción).
 *
 * POR QUÉ EXISTE, SI YA HAY `scripts/seed-images.mjs`: aquel resuelve el mismo
 * hueco —filas de `product_images` sin archivos detrás— pero SOLO en local:
 * lee el manifiesto con `psql` contra el contenedor de Docker y usa las
 * variables de `.env.local`. Contra el proyecto hosted no hay psql ni
 * `.env.local` que valgan, así que este lee las rutas por la API REST (puede,
 * porque `service_role` tiene GRANT de SELECT sobre `product_images` desde la
 * migración 20260828200750) y recibe las credenciales por línea de comandos.
 *
 * DE DÓNDE SALEN LOS ARCHIVOS: de `supabase/seed-images/`, que ya descargó
 * `npm run db:images` en su momento. Están nombrados con la convención
 * `{sellerViejo}__{productId}__{n}.jpg`, y como en producción el vendedor es
 * otro, el archivo se localiza IGNORANDO el vendedor: manda el par
 * (producto, número de foto).
 *
 * Uso (PowerShell, una sola línea):
 *   $env:SUPABASE_URL="https://<ref>.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="<clave>"; node scripts/upload-catalog-images.mjs
 *
 * Uso (bash):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-catalog-images.mjs
 *
 * Es idempotente: sube con `upsert`, así que repetirlo reemplaza y no duplica.
 */

import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMAGES_DIR = join(ROOT, "supabase", "seed-images");
const BUCKET = "product-images";

/**
 * Los cuatro productos añadidos en `demo-catalog.sql` (…17 a …20) no tienen
 * foto propia: `supabase/seed-images/` solo trae las de los 16 del seed. Cada
 * uno toma prestada la de un producto afín. Son fotos genéricas de Picsum, no
 * retratos del producto real, así que el préstamo no engaña a nadie: sirve
 * para que el catálogo de la demo no se vea con placeholders.
 */
const FOTO_PRESTADA = {
  // Hub USB-C  ← Mochila Targus (accesorios)
  "b0000000-0000-0000-0000-000000000017": "b0000000-0000-0000-0000-000000000015__1",
  // Base refrigerante ← Mochila Targus, segunda foto
  "b0000000-0000-0000-0000-000000000018": "b0000000-0000-0000-0000-000000000015__2",
  // Repetidor WiFi ← Router TP-Link (redes)
  "b0000000-0000-0000-0000-000000000019": "b0000000-0000-0000-0000-000000000007__2",
  // Fuente de poder ← SSD Western Digital (componentes)
  "b0000000-0000-0000-0000-000000000020": "b0000000-0000-0000-0000-000000000004__2",
};

function requireEnv(nombre) {
  const valor = process.env[nombre];
  if (!valor) {
    console.error(`Falta la variable ${nombre}. Ver el encabezado de este archivo.`);
    process.exit(1);
  }
  return valor;
}

/**
 * Indexa los archivos locales por "{productId}__{n}", descartando el uuid del
 * vendedor viejo: en producción el vendedor es otro y esa parte ya no aplica.
 */
async function indexarArchivosLocales() {
  const archivos = await readdir(IMAGES_DIR);
  const indice = new Map();
  for (const nombre of archivos) {
    const partes = nombre.replace(/\.jpg$/i, "").split("__");
    if (partes.length !== 3) continue;
    const [, productId, n] = partes;
    indice.set(`${productId}__${n}`, join(IMAGES_DIR, nombre));
  }
  return indice;
}

async function main() {
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const indice = await indexarArchivosLocales();
  console.log(`${indice.size} archivos disponibles en supabase/seed-images/`);

  const { data: filas, error } = await supabase
    .from("product_images")
    .select("image_path")
    .order("image_path");

  if (error) {
    console.error(`No se pudieron leer las rutas: ${error.message}`);
    process.exit(1);
  }
  if (!filas?.length) {
    console.error("No hay filas en product_images. ¿Ejecutaste demo-catalog.sql?");
    process.exit(1);
  }

  console.log(`${filas.length} imágenes referenciadas en la base.\n`);

  let subidas = 0;
  const faltantes = [];

  for (const { image_path } of filas) {
    // {sellerId}/{productId}/{n}.jpg
    const [, productId, archivo] = image_path.split("/");
    const n = archivo.replace(/\.jpg$/i, "");

    const clave = FOTO_PRESTADA[productId] ?? `${productId}__${n}`;
    const local = indice.get(clave);

    if (!local) {
      faltantes.push(image_path);
      continue;
    }

    const bytes = await readFile(local);
    const { error: errSubida } = await supabase.storage
      .from(BUCKET)
      .upload(image_path, bytes, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (errSubida) {
      faltantes.push(`${image_path}: ${errSubida.message}`);
      continue;
    }

    subidas += 1;
    process.stdout.write(`\rSubidas ${subidas}/${filas.length}`);
  }

  console.log(`\n\nSubidas: ${subidas}  ·  sin archivo o con error: ${faltantes.length}`);
  if (faltantes.length) {
    console.log("\nPendientes:");
    for (const f of faltantes) console.log(`  ${f}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
