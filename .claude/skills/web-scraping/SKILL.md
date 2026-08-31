---
name: web-scraping
description: >
  Método para extraer datos de páginas web de forma ordenada, robusta y respetuosa con el sitio:
  primero descarta que exista una API oficial, después elige la herramienta según cómo sirve el
  HTML el sitio (fetch + parser, endpoint JSON interno o navegador automatizado), extrae un único
  item antes de generalizar, y guarda los datos con límite de velocidad y reintentos. Úsalo cuando
  haya que scrapear o extraer datos de un sitio, armar un dataset a partir de páginas web, o
  cuando aparezcan cheerio, BeautifulSoup, Scrapy, Playwright o Puppeteer.
---

# Web scraping

## Para qué sirve

Scraping es **convertir una página pensada para ojos humanos en una tabla de datos**. Todo el
método se resume en no pelear con el HTML más de lo necesario y en no hacerle daño al sitio.

---

## Regla 0 — Tres preguntas antes de escribir una línea de código

| Pregunta | Si la respuesta es sí |
|---|---|
| **¿Existe una API oficial, un feed RSS o un CSV público?** | Usarlo. Es más estable, más rápido y no se rompe cuando cambian el diseño. Scrapear es siempre el plan B |
| **¿El sitio lo permite?** | Revisar `https://<sitio>/robots.txt` y los términos de uso. Lo que `robots.txt` marca como `Disallow` no se toca |
| **¿Qué datos exactamente y para qué?** | Escribir la lista de campos ANTES de programar. Bajar "todo por si acaso" multiplica el trabajo y el riesgo |

**Límites que no se cruzan:**

* Datos **personales** de terceros (emails, teléfonos, perfiles): no se recolectan.
* Contenido detrás de **login**, de un **muro de pago** o de un **CAPTCHA**: no se saltea.
* Material con **derechos de autor**: no se copia ni se republica.
* Volumen: nunca a un ritmo que pueda degradar el sitio. Si hay dudas, más lento.

---

## Paso 1 — Mirar cómo sirve los datos el sitio (esto define todo lo demás)

Abrir la página en el navegador, F12 → pestaña **Red (Network)**, recargar y filtrar por `Fetch/XHR`.

* **Si aparece una petición que devuelve JSON con los datos** → ganaste. Llamar ese endpoint
  directamente: sin HTML, sin selectores, mucho más estable. **Este es el mejor caso y casi nadie
  lo busca.**
* Si no aparece, mirar el HTML: click derecho → *Ver código fuente de la página*. Si los datos
  están ahí, es HTML estático. Si el código fuente viene casi vacío y todo aparece recién en el
  inspector, la página se arma con JavaScript.

### Elegir herramienta según lo que viste

| Lo que viste | Herramienta | Notas |
|---|---|---|
| Endpoint JSON interno | `fetch` a secas | Copiar los headers mínimos que pide. Lo más rápido y estable |
| HTML estático | `fetch` + **cheerio** (JS) · `requests` + **BeautifulSoup** (Python) | Sin navegador: rápido y barato |
| La página se arma con JavaScript | **Playwright** (o Puppeteer) | Abre un navegador real: pesado y lento, sólo si no hubo alternativa |
| Muchas páginas, muchas reglas, proyecto grande | **Scrapy** (Python) | Trae de fábrica cola, reintentos y límite de velocidad |
| Una sola página, una sola vez | copiar a mano o `WebFetch` | No escribir un scraper para un dato |

---

## Paso 2 — Definir el modelo de datos

Antes de extraer, escribir la forma de UNA fila:

```ts
type Producto = {
  id: string;          // clave estable para no duplicar
  titulo: string;
  precio: number | null;   // número, no "US$ 1.299,00"
  moneda: string | null;
  url: string;
  extraido_en: string;     // ISO — cuándo se bajó
};
```

Reglas: los números se guardan como **números** (limpiar símbolos y separadores), las fechas en
**ISO**, y todo campo que pueda faltar es `null` — nunca `""`.

---

## Paso 3 — Extraer UN item, no la lista

Bajar **una** página, guardarla en disco y trabajar sobre ese archivo hasta que los campos salgan
bien. Recién ahí generalizar.

Esto evita el error más caro del scraping: pegarle 500 veces al sitio mientras se depuran los
selectores.

### Selectores que aguantan

| Preferir | Evitar |
|---|---|
| `[data-testid="price"]`, `#main`, `[itemprop="name"]` | clases autogeneradas (`.css-1a2b3c`, `.text-sm.font-bold`) |
| Buscar por texto de una etiqueta cercana | cadenas largas de `div > div:nth-child(3) > span` |
| El JSON embebido en `<script type="application/ld+json">` | reconstruir a mano lo que ese JSON ya trae servido |

---

## Paso 4 — Generalizar: lista y paginación

* **Lista:** recorrer los items de la página con el mismo extractor del paso 3.
* **Paginación:** identificar el patrón (`?page=2`, un botón "siguiente", scroll infinito que
  dispara un XHR). Cortar por **dos condiciones**: cantidad máxima de páginas **y** página sin
  resultados nuevos. Un `while (true)` sin tope es cómo se hace un bucle infinito contra un sitio
  ajeno.
* **Ser buen ciudadano:**

| Práctica | Valor razonable |
|---|---|
| Pausa entre peticiones | 1–2 s, con variación aleatoria |
| Peticiones en paralelo | 1 al principio; 2–3 como máximo |
| Reintentos ante error de red o 5xx | 3, con espera creciente (1 s, 2 s, 4 s) |
| Ante un 429 o un 403 | **frenar**, no reintentar más rápido |
| `User-Agent` | uno propio y honesto, con forma de contacto si es posible |
| Timeout por petición | 10–20 s |

---

## Paso 5 — Guardar y poder repetir

* Guardar el **HTML/JSON crudo** en una carpeta (`.cache/`) además del resultado procesado: si el
  parser tenía un error, se corrige sin volver a bajar nada.
* Salida en **JSON o CSV**; si va a una base de datos, insertar por la clave estable (`id`) para
  que correr el script dos veces no duplique filas.
* **Contar y avisar:** "esperaba 120 items, obtuve 118" es la señal temprana de que el sitio
  cambió. Un scraper que falla en silencio es peor que uno que se rompe.
* Registrar la fecha de extracción en cada fila.

---

## Ejemplo mínimo (HTML estático, Node + TypeScript)

```ts
import * as cheerio from "cheerio";

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function bajar(url: string): Promise<string> {
  for (let intento = 1; intento <= 3; intento++) {
    const res = await fetch(url, {
      headers: { "User-Agent": "mi-scraper/1.0 (contacto@ejemplo.com)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return res.text();
    if (res.status === 429 || res.status === 403) throw new Error(`Bloqueado: ${res.status}`);
    await pausa(1000 * 2 ** (intento - 1)); // 1s, 2s, 4s
  }
  throw new Error(`Falló tras 3 intentos: ${url}`);
}

function extraer(html: string, url: string) {
  const $ = cheerio.load(html);
  return $("[data-testid='product-card']").map((_, el) => ({
    id: $(el).attr("data-id") ?? "",
    titulo: $(el).find("[data-testid='title']").text().trim(),
    precio: Number($(el).find("[data-testid='price']").text().replace(/[^\d.]/g, "")) || null,
    url,
    extraido_en: new Date().toISOString(),
  })).get();
}
```

Con página que se arma por JavaScript, cambia sólo la bajada:

```ts
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='product-card']"); // esperar el dato, no un tiempo fijo
const html = await page.content();
await browser.close();
```

> **En este repositorio:** los scripts de apoyo viven en `scripts/` y se corren con
> `npx tsx scripts/<nombre>.ts`. Node no carga `.env.local` solo: si el script necesita secretos,
> hay que parsearlo a mano (mismo patrón que `scripts/index-all.ts`).

---

## Checklist antes de la corrida completa

- [ ] Revisado `robots.txt` y los términos del sitio.
- [ ] Descartado que exista una API oficial.
- [ ] Probado con 1 item y con 1 página antes de soltar el bucle.
- [ ] Hay pausa entre peticiones y tope máximo de páginas.
- [ ] Los reintentos frenan ante 429/403 en vez de insistir.
- [ ] Se guarda el crudo en `.cache/` y el resultado tiene clave estable.
- [ ] El script avisa si la cantidad de items no es la esperada.
- [ ] No se está recolectando ningún dato personal.

---

## Errores frecuentes

| Error | Qué pasa | Arreglo |
|---|---|---|
| Parsear HTML cuando había un endpoint JSON | scraper frágil y diez veces más código | mirar la pestaña Red primero |
| Usar Playwright "por las dudas" | lento, pesado, difícil de mantener | sólo si el HTML crudo no trae los datos |
| Selectores por clases de Tailwind o autogeneradas | se rompe al siguiente deploy del sitio | atributos `data-*`, `id`, `itemprop` |
| Sin pausa y en paralelo | bloqueo por IP, y daño real al sitio | 1–2 s de pausa, 1 petición por vez |
| `while (true)` sobre la paginación | bucle infinito | tope de páginas + corte por página vacía |
| Depurar bajando la página cada vez | cientos de peticiones inútiles | guardar el crudo y depurar sobre el archivo |
| Fallar en silencio y guardar filas vacías | dataset corrupto que se descubre tarde | validar campos obligatorios y contar items |
