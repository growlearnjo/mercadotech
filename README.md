# MercadoTech

Marketplace de productos tecnológicos: los compradores navegan un catálogo,
preguntan, reseñan y compran; los vendedores publican y gestionan sus pedidos;
y dos asistentes con RAG —uno de compras sobre el catálogo, otro de soporte
sobre la FAQ— responden **citando sus fuentes**.

> **No hay pasarela de pago.** El checkout es simulado a propósito: crea el
> pedido y descuenta stock, sin cobrar nada. Es una decisión de diseño del
> proyecto, no una funcionalidad pendiente.

**Producción:** https://mercadotech.vercel.app

---

## Qué se puede hacer

| Como comprador | Como vendedor |
|---|---|
| Navegar el catálogo con filtros por condición, precio y orden | Publicar productos con galería de imágenes reordenable |
| Buscar por texto exacto **o por significado** (búsqueda semántica) | Editar y activar/desactivar sus publicaciones |
| Ver detalle con galería, preguntas y reseñas verificadas | Mover pedidos por un tablero kanban (con teclado, accesible) |
| Guardar favoritos, carrito y checkout simulado | Ver solo sus propios pedidos e ítems |
| Seguir sus pedidos por estado | |
| Preguntar al asesor de compras y al soporte, con citas | |

---

## Stack

| Capa | Elección |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack), React 19, TypeScript estricto |
| Estilos | Tailwind CSS 4 + shadcn/ui (estilo *base-nova*, sobre Base UI) |
| Datos, auth y archivos | Supabase (Postgres + RLS + Auth + Storage + pgvector) |
| IA | Hugging Face Inference — embeddings y chat, nivel gratuito |
| Arrastrar y soltar | dnd-kit |
| Tests | Vitest (unitarios) + Playwright (E2E) |
| CI/CD | GitHub Actions → Vercel |

---

## Puesta en marcha local

**Requisitos:** Node.js 24, Docker Desktop **corriendo** (Supabase local lo
necesita) y la [CLI de Supabase](https://supabase.com/docs/guides/cli).

```bash
git clone https://github.com/growlearnjo/mercadotech.git
cd mercadotech
npm ci
```

```bash
supabase start        # levanta Postgres + Auth + Storage + Studio en Docker
```

> Si falla la primera vez, vuelve a intentarlo: Docker Desktop suele tardar en
> terminar de arrancar.

```bash
cp .env.example .env.local
supabase status -o env     # copia estos valores a .env.local
```

Solo falta una variable que no sale de ahí: `HUGGINGFACEHUB_API_TOKEN`, que se
crea en Hugging Face → Settings → Access Tokens (tipo *Read*). **Sin ella todo
funciona menos la IA**: la búsqueda semántica y los dos asistentes fallan con un
error controlado.

```bash
supabase db reset     # aplica migrations/ y siembra datos de prueba
npm run db:images     # descarga las imágenes de muestra y las sube a Storage
npm run dev           # http://localhost:3000
```

`db:images` es un paso aparte porque el seed crea las **filas** de
`product_images` pero no los **archivos**; sin él el catálogo se ve con
placeholders.

### Usuarios de prueba

Los crea `supabase db reset`, todos con la contraseña `MercadoTech123!`:

| Correo | Rol |
|---|---|
| `buyer1@mercadotech.test`, `buyer2@mercadotech.test` | comprador |
| `seller1@mercadotech.test` (TecnoStore Perú), `seller2@mercadotech.test` (GamerZone Lima) | vendedor |

---

## Comandos

```bash
npm run dev            # servidor de desarrollo
npm run build          # build de producción
npm run start          # sirve el build de producción
npm run lint           # ESLint
npm run type-check     # tsc --noEmit
npm run test           # Vitest: 293 tests, ~3 s, SIN red ni Docker
npm run test:coverage  # lo mismo + reporte en coverage/
npm run test:e2e       # Playwright — exige `supabase db reset` antes
npm run test:e2e:ui    # el mismo runner, en modo interactivo
npm run db:types       # regenera types/database.ts desde el esquema local
npm run db:images      # sube las imágenes de muestra a Storage
npx tsx scripts/index-all.ts   # reindexa catálogo + FAQ para el RAG
```

Base de datos:

```bash
supabase start                   # levanta el stack local
supabase stop                    # lo detiene
supabase db reset                # reconstruye: migrations/ + seed.sql
supabase migration new <nombre>  # nueva migración con timestamp
```

Servidor MCP (solo lectura), **siempre desde la raíz** — el alias `@/*` resuelve
a `./*` y desde otra carpeta los imports fallan:

```bash
npx tsx mcp/src/index.ts                                      # por stdio
npx @modelcontextprotocol/inspector npx tsx mcp/src/index.ts   # Inspector
node mcp/scripts/rpc.mjs tools/list                            # cliente del repo
```

---

## Arquitectura en una pantalla

Un solo camino de datos, sin API REST paralela:

```
components/   Presentación PURA: reciben props. No hacen fetching ni conocen Supabase.
     ▲
hooks/        Estado de cliente. Llaman a services; sin lógica de negocio propia.
     ▲
services/     Lógica de negocio. Cada función recibe el cliente Supabase INYECTABLE,
     ▲        así los tests la ejercitan sin red.
lib/supabase/ browser (anon) · server (cookies + RLS) · admin (service role, server-only)
     ▲
Postgres      La RLS es la que autoriza. La UI no es la que protege.
```

Las **páginas** (`app/**/page.tsx`) son el único punto donde un hook se
encuentra con un componente.

Al lado, dos módulos que solo consumen esas capas:

* `lib/ai/` — los **únicos** archivos que conocen la API del proveedor de IA. El
  navegador llega a ella por una sola cadena: hook → `fetch` a `app/api/v1/*` →
  service → `lib/ai/`.
* `mcp/` — servidor MCP de **solo lectura** (10 tools, 7 resources, 5 prompts),
  un proceso Node aparte que reutiliza `services/` sin reimplementar nada.

Detalle completo, modelo relacional y políticas RLS en
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

### Cómo responden los asistentes (RAG)

```
pregunta ──> embedding (Hugging Face) ──> búsqueda vectorial en
             knowledge_embeddings (pgvector, cosine)
                     │
                     ▼
          los K fragmentos más cercanos ──> prompt con contexto ──> respuesta
                     │                                                  │
                     └──────────────> citas de las fuentes usadas <──────┘
```

El asistente **solo responde con lo que encuentra**: si la búsqueda no trae nada
relevante, lo dice en vez de inventar. Casos de prueba y calibración en
[`docs/RAG.md`](docs/RAG.md).

---

## Testing

```bash
npm run test        # 293 unitarios, ~3 s
```

Los unitarios **no tocan la red**: pasan con Docker apagado. Reciben el cliente
Supabase por parámetro en vez de simular el módulo, así que prueban la lógica
real y no un doble.

```bash
supabase db reset   # PRERREQUISITO, no opcional
npm run test:e2e    # 13 specs de Playwright
```

Los E2E corren contra el Supabase local y **crean pedidos y productos de
verdad**: sin el `db reset` previo, la segunda corrida arranca sobre los restos
de la primera. En local corren en Chromium, Firefox y WebKit; el CI usa
Chromium.

---

## Despliegue

```
Pull Request ──> CI (checks + e2e) ──verde──> merge a main ──> PRODUCCIÓN
     │                   │
     │                 rojo ──> 🔒 merge bloqueado
     └──> preview con URL propia
```

Cada push y cada PR dispara el workflow de GitHub Actions, que corre **sin un
solo secreto**: levanta su propio Supabase efímero. Los checks son obligatorios
para entrar a `main`, y Vercel publica producción con cada merge.

Guía completa —variables por entorno, migración de la base hosted, smoke test y
**rollback**— en [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Estructura del proyecto

```
app/                 Rutas (App Router)
  (shop)/            tienda: catálogo, producto, carrito, pedidos, asistentes
  (seller)/          panel del vendedor, siempre bajo /vendedor/
  (auth)/            login y registro
  api/v1/            Route Handlers delgados: solo lo que no puede ir en el navegador
components/          Presentación pura (ui/ shared/ layout/ + una carpeta por dominio)
hooks/               Estado de cliente
services/            Lógica de negocio, con el cliente Supabase inyectable
lib/
  supabase/          los tres clientes: browser, server, admin
  ai/                embeddings, chat, prompts y armado del contexto
  validators/        validación compartida entre UI y servidor
  constants/         todos los tunables, cada uno con su porqué
types/               tipos de dominio + database.ts generado por Supabase
supabase/
  migrations/        ÚNICA fuente de verdad del esquema
  seed.sql           datos de laboratorio (nunca tocan producción)
  seed.prod.sql      seed mínimo de producción: 8 categorías + 10 artículos de FAQ
e2e/                 specs de Playwright, page objects y fixtures
mcp/                 servidor MCP de solo lectura (proceso Node aparte)
scripts/             utilidades fuera del build (seed de imágenes, indexado)
docs/                arquitectura, bitácora, RAG, debugging, performance, deploy
```

---

## Documentación

| Documento | Qué responde |
|---|---|
| [`ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Cómo está construido y por qué |
| [`DEPLOY.md`](docs/DEPLOY.md) | Dónde vive cada clave, cómo desplegar, cómo volver atrás |
| [`PERFORMANCE.md`](docs/PERFORMANCE.md) | Qué se midió, qué se optimizó y qué no valió la pena |
| [`RAG.md`](docs/RAG.md) | Flujo del RAG, casos de prueba y calibración |
| [`DEBUGGING.md`](docs/DEBUGGING.md) | Metodología de depuración y errores típicos |
| [`BITACORA.md`](docs/BITACORA.md) | Qué se decidió en cada sesión, y por qué |
| [`ESTRUCTURA.md`](docs/ESTRUCTURA.md) | Mapa de carpetas |
| [`mcp/README.md`](mcp/README.md) | El servidor MCP por dentro |
| [`PLAN_CURSO.md`](docs/PLAN_CURSO.md) | El plan original del curso que originó el proyecto |

`CLAUDE.md` en la raíz es el contrato con Claude Code: reglas de arquitectura y
convenciones que cualquier cambio debe respetar.

---

## Qué sigue

La sesión 8 añade un agente de **voz** al soporte, sobre el mismo RAG.
