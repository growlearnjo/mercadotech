# Arquitectura de MercadoTech

Este documento describe **lo que existe hoy** en el repositorio, al cierre de
la sesión 7: base de datos y RLS, el frontend completo, el RAG de los dos
asistentes, el servidor MCP, la red de tests con su CI, y el despliegue.

Está escrito para alguien que se une al proyecto ahora y no participó en
ninguna sesión anterior — no asume ese contexto. Y documenta **lo construido**,
no lo planeado: donde el código difiere de alguna especificación, gana el
código y queda anotado. El plan original vive aparte, en
[`PLAN_CURSO.md`](PLAN_CURSO.md).

Las secciones 1 a 8 son la base de datos y la estructura, estables desde la
sesión 2. Las secciones 9 a 13 cuentan lo que se construyó encima.

## Tabla de contenidos

1. [Arquitectura general y capas](#1-arquitectura-general-y-capas)
2. [Organización de carpetas](#2-organización-de-carpetas)
3. [Modelo relacional](#3-modelo-relacional)
4. [Decisiones de diseño](#4-decisiones-de-diseño)
5. [Integración Next.js ↔ Supabase](#5-integración-nextjs--supabase)
6. [Flujo de autenticación](#6-flujo-de-autenticación)
7. [Estrategia de escalabilidad](#7-estrategia-de-escalabilidad)
8. [Políticas RLS](#8-políticas-rls)
9. [Frontend: pantallas, hooks y services](#9-frontend-pantallas-hooks-y-services)
10. [RAG: búsqueda semántica y asistentes](#10-rag-búsqueda-semántica-y-asistentes)
11. [Gobernanza y servidor MCP](#11-gobernanza-y-servidor-mcp)
12. [Testing e integración continua](#12-testing-e-integración-continua)
13. [Despliegue y performance](#13-despliegue-y-performance)
14. [Qué sigue](#14-qué-sigue)

---

## 1. Arquitectura general y capas

MercadoTech es una aplicación Next.js 15 (App Router) sobre Supabase
(Postgres + Auth + Storage). La regla que gobierna todo el proyecto —
declarada en [`CLAUDE.md`](../CLAUDE.md) — es que cada capa tiene una única
responsabilidad y los datos fluyen en un solo sentido:

```
components/  →  hooks/  →  services/  →  lib/supabase/  →  Postgres (RLS)
   (UI pura)    (estado)   (negocio)      (3 clientes)
```

* **`components/`** — presentación pura. Reciben props, no hacen fetching,
  no conocen Supabase. Organizada en `ui/` (generados por shadcn), `shared/`,
  `layout/` y una carpeta por dominio de pantalla.
* **`hooks/`** — estado de cliente (React). Llaman a `services/`, no tienen
  lógica de negocio propia. 17 hoy (ver §9).
* **`services/`** — lógica de negocio. Cada función acepta un
  `SupabaseClient` inyectable, para que hooks y Route Handlers compartan la
  misma lógica y los tests la puedan mockear sin red. **Vacía hoy** — el
  único código de negocio que existe en la sesión 2 vive directamente en
  Postgres (la función `create_order_from_cart`, ver [§4](#4-decisiones-de-diseño)),
  porque el checkout necesita ser transaccional y no puede depender de que
  el cliente complete todos los pasos.
* **`lib/supabase/`** — los 3 (+1) clientes que hablan con Supabase. Es la
  única capa con código real en esta sesión; ver [§5](#5-integración-nextjs--supabase).
* **`lib/ai/`** y **`lib/voice/`** — vacías, reservadas para las sesiones 4
  y 8. La UI nunca las importa directamente ni al cliente admin.
* **`app/api/v1/`** — Route Handlers delgados, solo para lo que no puede
  correr en el navegador. **Vacía hoy** — no hay endpoints, todo el acceso a
  datos de las sesiones futuras pasa por Supabase con RLS, no por una API
  REST paralela.

No hay pasarela de pago real: el checkout es simulado (crea el pedido y
descuenta stock).

## 2. Organización de carpetas

```
mercadotech/
├── app/
│   ├── (auth)/, (shop)/, (seller)/   route groups con todas las pantallas (§9)
│   └── api/v1/                       chat · search/semantic · reindex (§10.3)
├── components/       ui/ shared/ layout/ + una carpeta por dominio
├── hooks/            17 hooks de estado de cliente
├── services/         16 services con el cliente Supabase inyectable
├── lib/
│   ├── supabase/     client.ts · server.ts · middleware.ts · admin.ts
│   ├── constants/    roles.ts (roles y estados del dominio)
│   ├── validators/   validación compartida entre UI y servidor
│   ├── ai/           embeddings · completion · prompts · context-builder
│   └── voice/        vacío — sesión 8
├── types/            database.ts generado por Supabase + tipos de dominio
├── supabase/
│   ├── migrations/   26 archivos, fuente de verdad del esquema (ver §3)
│   ├── schema.sql     copia de referencia (tablas + función), NO editable a mano
│   ├── policies.sql   copia de referencia (RLS + Storage), NO editable a mano
│   ├── seed.sql       datos de laboratorio (6 usuarios, 16 productos, 6 pedidos...)
│   ├── seed.prod.sql  seed de producción: 8 categorías + 10 FAQ, sin usuarios
│   └── tests/
│       └── rls-validation.sql   76 escenarios de RLS (Fase 2.6)
├── e2e/              specs de Playwright, page objects y fixtures
├── mcp/              servidor MCP de solo lectura (proceso Node aparte, §11.2)
├── scripts/          utilidades fuera del build (seed de imágenes, indexado)
├── .github/workflows/ci.yml   pipeline de CI (§12.2)
└── docs/             este archivo, más DEPLOY, PERFORMANCE, RAG, BITACORA…
```

Las carpetas vacías existen ya (con `.gitkeep`) porque la Fase 2.1 fijó la
estructura completa del proyecto de antemano — evita que cada sesión futura
tenga que decidir dónde va cada cosa.

## 3. Modelo relacional

14 tablas en el schema `public`, más `auth.users` (gestionada por Supabase
Auth, fuera de este repo). El diagrama sigue exactamente
`supabase/migrations/*.sql` — no la spec ni un diseño idealizado.

```mermaid
erDiagram
    PROFILES ||--o{ PRODUCTS : "vende (seller_id)"
    PROFILES ||--o{ CART_ITEMS : "tiene"
    PROFILES ||--o{ ORDERS : "compra (buyer_id)"
    PROFILES ||--o{ ORDER_ITEMS : "vende (seller_id, denormalizado)"
    PROFILES ||--o{ QUESTIONS : "pregunta"
    PROFILES ||--o{ REVIEWS : "reseña (buyer_id)"
    PROFILES ||--o{ FAVORITES : "guarda"
    PROFILES ||--o{ PRODUCT_VIEWS : "genera evento"
    PROFILES ||--o{ SUPPORT_TICKETS : "abre"

    CATEGORIES ||--o{ CATEGORIES : "parent_id"
    CATEGORIES ||--o{ PRODUCTS : "clasifica"

    PRODUCTS ||--o{ PRODUCT_IMAGES : "galería"
    PRODUCTS ||--o{ CART_ITEMS : "está en"
    PRODUCTS ||--o{ ORDER_ITEMS : "vendido en"
    PRODUCTS ||--o{ QUESTIONS : "recibe"
    PRODUCTS ||--o{ REVIEWS : "recibe"
    PRODUCTS ||--o{ FAVORITES : "es favorito de"
    PRODUCTS ||--o{ PRODUCT_VIEWS : "es visto en"

    ORDERS ||--o{ ORDER_ITEMS : "contiene"
    ORDERS ||--o{ REVIEWS : "verifica compra"

    SUPPORT_TICKETS ||--o{ TICKET_MESSAGES : "tiene"

    PROFILES {
        uuid id PK "= auth.users.id"
        text display_name
        text phone
        text role "buyer/seller/admin"
        text avatar_path
    }
    CATEGORIES {
        uuid id PK
        text name UK
        text slug UK
        uuid parent_id FK
    }
    PRODUCTS {
        uuid id PK
        uuid seller_id FK
        uuid category_id FK
        text title
        text condition "nuevo/usado/reacondicionado"
        numeric price "> 0"
        int stock ">= 0"
        bool is_active
    }
    PRODUCT_IMAGES {
        uuid id PK
        uuid product_id FK
        text image_path
        int position
    }
    CART_ITEMS {
        uuid id PK
        uuid user_id FK
        uuid product_id FK
        int quantity "> 0, UK(user_id,product_id)"
    }
    ORDERS {
        uuid id PK
        uuid buyer_id FK
        text status "pendiente/pagado/enviado/entregado/cancelado"
        numeric total
    }
    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        uuid seller_id FK "denormalizado"
        text title_snapshot
        numeric price_snapshot
        int quantity
    }
    QUESTIONS {
        uuid id PK
        uuid product_id FK
        uuid user_id FK
        text question
        text answer "null hasta responder"
    }
    REVIEWS {
        uuid id PK
        uuid product_id FK
        uuid buyer_id FK
        uuid order_id FK "pedido que verifica la compra"
        int rating "1-5, UK(product_id,buyer_id)"
    }
    FAVORITES {
        uuid id PK
        uuid user_id FK
        uuid product_id FK "UK(user_id,product_id)"
    }
    PRODUCT_VIEWS {
        uuid id PK
        uuid product_id FK
        uuid user_id FK
        timestamptz viewed_at
    }
    SUPPORT_ARTICLES {
        uuid id PK
        text title
        text content
        text category
        bool is_published
    }
    SUPPORT_TICKETS {
        uuid id PK
        uuid user_id FK
        text subject
        text status "abierto/en_proceso/resuelto/cerrado"
        text channel "chat/voz"
    }
    TICKET_MESSAGES {
        uuid id PK
        uuid ticket_id FK
        text sender_role "usuario/agente/humano"
        text content
    }
```

`support_articles` no tiene relaciones entrantes: es una tabla standalone,
base de conocimiento para el RAG de soporte de la sesión 4.

La referencia SQL completa (tipos exactos, todos los `check`, todos los
índices) está en [`supabase/schema.sql`](../supabase/schema.sql) — no se
duplica aquí.

## 4. Decisiones de diseño

**Snapshots en `order_items` (`title_snapshot`, `price_snapshot`).** Un
pedido es un recibo histórico: si el vendedor cambia el precio o el título
del producto después, el pedido ya facturado no debe cambiar. Por eso
`order_items` copia esos dos valores en el momento de la compra en vez de
hacer `join` contra `products` cada vez que se muestra un pedido antiguo.

**`create_order_from_cart` como función transaccional (no lógica en el
cliente).** El checkout necesita leer el carrito, verificar stock, crear el
pedido, descontar stock y vaciar el carrito como una sola operación atómica
— si esos 5 pasos vivieran en el cliente (JS), una desconexión a mitad de
camino dejaría stock descontado sin pedido, o un pedido sin descuento de
stock. La función corre en Postgres, es `SECURITY DEFINER` (así puede
escribir en `orders`/`order_items` aunque el rol `authenticated` no tenga
`INSERT` directo ahí — ver [§8](#8-políticas-rls)) y usa
`for update of p` sobre las filas de `products` involucradas para que dos
checkouts concurrentes sobre el mismo producto no puedan sobrevender stock.

**`seller_id` denormalizado en `order_items`.** En teoría es derivable con
un `join` a `products.seller_id`. Se guarda una copia por dos razones: (1)
un pedido histórico no debería cambiar de "dueño visible" si el producto
cambiara de vendedor en el futuro, y (2) evita que la política RLS del
vendedor tenga que resolver la propiedad en caliente contra `products` en
cada fila. Este segundo punto no era solo una optimización teórica: al
implementar RLS (Fase 2.3) surgió una recursión real entre `orders` y
`order_items` (cada tabla necesitaba consultar a la otra dentro de su propia
política), que se resolvió con funciones `SECURITY DEFINER` dedicadas — la
denormalización de `seller_id` fue lo que hizo posible que esa consulta
existiera en primer lugar sin depender de `products`.

**`product_views` como eventos, no como contador.** Cada apertura de un
producto inserta una fila (`product_id`, `user_id`, `viewed_at`) en vez de
incrementar un `views_count` en `products`. Un contador agregado pierde
quién vio qué y cuándo — información que la sesión 3 (analítica del
vendedor) y una futura recomendación personalizada necesitan. El costo es
más filas; el índice en `product_views(product_id)` mantiene barato el
`count(*)` cuando sí hace falta agregar.

**RLS habilitado desde la creación de cada tabla, políticas en una
migración aparte.** Cada `create table` de la Fase 2.2 incluye
`enable row level security` en el mismo archivo — así ninguna tabla queda
ni un segundo sin RLS, aunque sus políticas lleguen en un commit posterior
(Fase 2.3). El costo transitorio: entre esas dos fases, las tablas eran
inaccesibles vía la Data API (comportamiento esperado, no un bug).

**Protección de columnas parciales vía trigger, no solo política.** Varias
reglas de negocio son "solo se puede editar X campo de esta fila"
(`profiles.role` no editable por el dueño, `orders.status` es lo único que
edita un vendedor, `questions.answer` es lo único que edita el vendedor,
`support_tickets.status` es lo único que cierra el dueño). Una política RLS
por sí sola no puede comparar el valor anterior de una columna contra el
nuevo (el `with check` solo ve la fila resultante) — así que cada uno de
estos casos tiene un trigger `before update` dedicado que compara
explícitamente `old` contra `new` y rechaza cualquier cambio fuera de lo
permitido. Ver la migración de RLS para el detalle de cada uno.

## 5. Integración Next.js ↔ Supabase

Cuatro clientes en `lib/supabase/`, cada uno para un contexto de ejecución
distinto — mezclarlos es la fuente más común de bugs de sesión en apps
Supabase+Next.js:

| Cliente | Dónde se usa | Clave | Respeta RLS |
|---|---|---|---|
| `client.ts` | Client Components (`"use client"`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí |
| `server.ts` | Server Components, Server Actions | `NEXT_PUBLIC_SUPABASE_ANON_KEY` + cookies de sesión | Sí |
| `middleware.ts` | el `middleware.ts` raíz | `NEXT_PUBLIC_SUPABASE_ANON_KEY` + cookies | Sí (solo refresca el token) |
| `admin.ts` | ⚠️ solo Route Handlers/Server Actions de confianza | `SUPABASE_SERVICE_ROLE_KEY` | **No — bypasea RLS por completo** |

`admin.ts` importa `"server-only"`: intentar importarlo desde un Client
Component es un **error de build**, no solo una advertencia en el código.
Hoy lo importan únicamente `app/api/v1/reindex` y los scripts de
`scripts/`, que es exactamente donde debe estar. El grep que lo verifica
vive en [`CLAUDE.md`](../CLAUDE.md).

## 6. Flujo de autenticación

El middleware raíz (`middleware.ts`) corre en casi todas las rutas
(excluye assets estáticos vía `config.matcher`) y delega en
`lib/supabase/middleware.ts#updateSession`:

1. Construye un cliente Supabase de servidor atado a las cookies de la
   request entrante.
2. Llama a `supabase.auth.getUser()`, que refresca el access token si está
   por expirar.
3. Propaga las cookies actualizadas tanto a la request (para que el
   render de esa misma respuesta ya vea la sesión fresca) como a la
   response (para que el navegador las reciba).

Si `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` no están
configuradas, el middleware no hace nada (deja pasar la request) — esto es
intencional: permite que `npm run dev` levante antes de tener un proyecto
Supabase conectado, un caso real durante esta misma sesión.

Las pantallas de login y registro viven en `app/(auth)/` desde la sesión 3, y
el seed (`supabase/seed.sql`) crea 6 usuarios con contraseñas reales
(`MercadoTech123!`, hasheadas con `pgcrypto`) para probarlas.

En **producción** hay una diferencia que conviene conocer: Supabase hosted trae
la confirmación por correo **activada**, mientras que en local está apagada. En
este despliegue se desactivó a propósito, como decisión de laboratorio
documentada en [`DEPLOY.md`](DEPLOY.md) §2.5.

## 7. Estrategia de escalabilidad

* **Autorización en la base de datos, no en la app.** Con RLS, cualquier
  instancia de Next.js (o una nueva, escalada horizontalmente) hereda las
  mismas reglas de seguridad sin lógica adicional — no hay estado de
  autorización que sincronizar entre instancias.
* **Índices en toda columna FK que se filtra en una política o en una
  pantalla previsible** (`products.seller_id`, `products.category_id`,
  `products.is_active`, `order_items.order_id`, `order_items.seller_id`,
  etc. — la lista completa está en `schema.sql`). Sin esto, cada política
  RLS con un `exists (...)` se convertiría en un seq scan a medida que
  crecen las tablas.
* **Bloqueo de filas, no de tabla, en el checkout.** `for update of p`
  bloquea únicamente las filas de `products` que están en el carrito del
  comprador — dos compradores llevando productos distintos hacen checkout
  en paralelo sin bloquearse entre sí; solo se serializan cuando compiten
  por el *mismo* producto.
* **Storage con lectura pública.** Los buckets `product-images` y
  `avatars` están marcados `public`, así que las imágenes se sirven
  directo desde el CDN de Supabase Storage sin pasar por Next.js ni por
  Postgres en cada request.
* **Un solo camino de datos.** No hay una capa REST que duplique lo que ya
  expone la Data API de Supabase: mantener (y escalar) dos superficies sobre
  los mismos datos se paga dos veces. `app/api/v1/` acabó teniendo exactamente
  tres rutas, y solo porque no pueden correr en el navegador (§10.3).

## 8. Políticas RLS

Tabla × operación × regla de negocio (en una frase). El detalle técnico
completo — con el SQL exacto de cada política — está en
[`supabase/policies.sql`](../supabase/policies.sql).

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | El dueño ve su perfil; admin ve todos. | — (lo crea automáticamente el registro en Auth). | El dueño edita su perfil, pero no puede cambiarse el `role` a sí mismo. | No se puede borrar un perfil desde la API. |
| `categories` | Público. | Solo admin. | Solo admin. | Solo admin. |
| `products` | Público si está activo; el vendedor ve además los suyos inactivos. | El vendedor publica a su propio nombre (`seller_id` = él mismo, y debe tener rol `seller`). | Solo el vendedor dueño. | Solo el vendedor dueño. |
| `product_images` | Misma visibilidad que su producto. | Solo el vendedor dueño del producto. | Solo el vendedor dueño del producto. | Solo el vendedor dueño del producto. |
| `cart_items` | Solo el dueño del carrito. | Solo a nombre propio. | Solo el dueño. | Solo el dueño. |
| `orders` | El comprador ve los suyos; el vendedor ve los que tienen algún ítem suyo; admin ve todos. | — (únicamente vía `create_order_from_cart`). | El vendedor solo avanza el estado (pagado/enviado/entregado) de pedidos con ítems suyos; el comprador solo cancela un pedido propio que siga `pendiente`. | No se puede borrar un pedido. |
| `order_items` | El comprador del pedido, el vendedor de sus propios ítems, o admin. | — (únicamente vía `create_order_from_cart`). | No editable. | No se puede borrar. |
| `questions` | Público. | Cualquier usuario autenticado, a nombre propio. | Solo el vendedor dueño del producto puede escribir la respuesta. | El autor de la pregunta, o admin. |
| `reviews` | Público. | El comprador, solo si tiene un pedido `entregado` que contenga ese producto. | Solo el autor (y sigue exigiéndose la compra verificada tras el cambio). | El autor, o admin. |
| `favorites` | Solo el dueño. | Solo a nombre propio. | No aplica (se crea o se borra, no se edita). | Solo el dueño. |
| `product_views` | El vendedor del producto (analítica propia), o admin. | Cualquier autenticado, a nombre propio. | No editable — es un evento. | No se puede borrar. |
| `support_articles` | Público si está publicado; admin ve también los borradores. | Solo admin. | Solo admin. | Solo admin. |
| `support_tickets` | El dueño del ticket, o admin. | Solo a nombre propio. | El dueño solo puede cerrarlo; admin edita libremente. | No se puede borrar. |
| `ticket_messages` | El dueño del ticket, o admin. | El dueño del ticket, o admin. | No editable — un mensaje es inmutable. | No se puede borrar. |

Además: los buckets de Storage (`product-images`, `avatars`) son de
lectura pública, con escritura/borrado restringidos a la propia carpeta del
usuario (`{uid}/...`) — el detalle está en la sección de Storage de
`policies.sql`.


---

## 9. Frontend: pantallas, hooks y services

Construido en la sesión 3. La regla que lo gobierna es la del §1, aplicada sin
excepciones: **componentes que no hacen fetching, hooks que no tienen lógica de
negocio, services que reciben el cliente Supabase por parámetro.**

### 9.1 El cliente inyectable

Todas las funciones de `services/` tienen la misma forma:

```ts
export async function getProduct(id: string, supabase: Client = createClient()) { … }
```

El cliente va **al final y con valor por defecto**. Eso resuelve tres problemas
de una vez:

* los **hooks** la llaman sin pasar nada y usan el cliente de navegador;
* los **Route Handlers** le pasan el cliente de servidor (con cookies) o el de
  service role, sin duplicar la lógica;
* los **tests** le pasan un doble y ejercitan la función real sin red.

Los errores de Supabase se lanzan tal cual: traducirlos a estado de interfaz es
trabajo del hook, no del service.

### 9.2 Qué hay

* **17 hooks** (`useProducts`, `useCart`, `useSellerOrders`, `useChat`…), uno
  por dominio de pantalla.
* **16 services** (`product`, `cart`, `order`, `review`, `question`,
  `favorite`, `seller`, `storage`, `ticket`, `embedding`, `vector-search`,
  `chat`…).
* **Un solo camino de datos.** No hay una API REST paralela: `app/api/v1/` tiene
  exactamente tres rutas, y solo porque no pueden correr en el navegador (§10).

### 9.3 Decisiones que el código dejó fijadas

| Decisión | Por qué |
|---|---|
| `numeric` se convierte con `Number()` **en el service** | PostgREST devuelve los numéricos como `string`; los componentes siempre reciben `number` y nunca tienen que saberlo |
| Los componentes reciben `image_url` **ya resuelta** | Traducir un `image_path` de Storage a URL pública es trabajo del service; el componente solo pinta |
| El catálogo filtra `is_active = true` **explícitamente** | La RLS solo lo impone a los anónimos: sin el filtro, un vendedor con sesión vería sus propios productos inactivos mezclados en el catálogo público |
| Los filtros del catálogo viven **en la URL**, y se escriben en una sola llamada | Dos `router.push` seguidos parten del mismo snapshot y el segundo pisa al primero |
| Las reglas de transición del kanban viven **en el hook** | La RLS valida el estado de destino, no la *secuencia*: que no se pueda retroceder de "enviado" a "pagado" es una regla de negocio, y su mensaje al usuario también |
| Colores solo por tokens de `app/globals.css` | Un `Badge` con color fijo se queda anclado al tema anterior al alternar claro/oscuro (necesita `transition-none`) |

### 9.4 Rutas

* Tienda: `/`, `/buscar`, `/categoria/[slug]`, `/producto/[id]`, `/favoritos`,
  `/carrito`, `/pedidos`, `/pedidos/[id]`, `/asistente`, `/soporte`.
* Vendedor, **siempre** bajo `/vendedor/`: `/vendedor/productos`,
  `/vendedor/publicar`, `/vendedor/productos/[id]/editar`, `/vendedor/pedidos`.
  El prefijo no es estético: evita que `/pedidos` del comprador y los del
  vendedor colisionen.
* Auth: `/login`, `/register`.

`lib/supabase/middleware.ts` exige sesión en `/carrito`, `/pedidos`,
`/favoritos`, `/vendedor`, `/asistente` y `/soporte`. **El detalle de producto
es público** a propósito, y la pestaña de resultados con IA de `/buscar` pide
sesión por dentro de la página: la búsqueda exacta sigue siendo pública.

---

## 10. RAG: búsqueda semántica y asistentes

Construido en la sesión 4, sobre Hugging Face Inference (nivel gratuito).

### 10.1 La regla de aislamiento

**`lib/ai/` son los únicos archivos del proyecto que conocen la API del
proveedor de IA.** El navegador llega a ella por una sola cadena, sin atajos:

```
hook  ──fetch──>  app/api/v1/*  ──>  service  ──>  lib/ai/
```

Existe por dos razones concretas: el token de Hugging Face es un secreto que no
puede viajar al navegador, y cambiar de proveedor debe ser editar una carpeta,
no perseguir imports por todo el repositorio. Los greps que lo verifican están
en [`CLAUDE.md`](../CLAUDE.md).

### 10.2 El flujo

```
pregunta ──> embedding (384 dimensiones) ──> match_embeddings() en Postgres
                                              (pgvector, distancia coseno)
                                                        │
                                          los K fragmentos más cercanos
                                                        │
                                    prompt con ese contexto ──> respuesta + citas
```

* `knowledge_embeddings` guarda los vectores de **productos activos y FAQ
  publicada**; `scripts/index-all.ts` los reconstruye.
* El asistente **solo responde con lo que encuentra**. Si la búsqueda no trae
  nada relevante, lo dice en vez de inventar — es la diferencia entre un
  asistente citable y uno que alucina.
* La dimensión del vector (384) es parte del esquema: cambiar de modelo de
  embeddings exige una migración (`ALTER COLUMN … TYPE vector(N)`) y reindexar
  todo. Por eso el modelo es una constante documentada y no una decisión
  suelta.

Casos de prueba, umbrales y calibración: [`RAG.md`](RAG.md).

### 10.3 Las tres rutas de `app/api/v1/`

Route Handlers **delgados**, y solo para lo que el navegador no puede hacer:

| Ruta | Por qué no puede vivir en el cliente |
|---|---|
| `chat` | Usa el token de Hugging Face |
| `search/semantic` | Necesita generar el embedding de la consulta |
| `reindex` | Usa el cliente de service role |

Los tres asistentes exigen sesión, y no solo por privacidad: también protege la
cuota gratuita del proveedor.

---

## 11. Gobernanza y servidor MCP

Sesión 5. Dos piezas independientes, ambas de solo lectura.

### 11.1 Las cuatro Skills (`.claude/skills/`)

Manuales de puesto que Claude Code carga según lo que se le pida:
`architecture-enforcer` (antes de crear o mover un archivo),
`code-reviewer` (revisión de lo ya escrito), `automatic-validator` (el sí/no que
cierra una fase) y `tech-lead` (decisiones de diseño con trade-offs).

**Las cuatro reportan; ninguna edita código.** Corregir es siempre un paso
aparte y supervisado. Su fuente de verdad es `CLAUDE.md`: ante contradicción,
gana `CLAUDE.md`.

### 11.2 El servidor MCP (`mcp/`)

Un proceso Node **aparte de Next** que expone el marketplace a un cliente MCP:
10 tools, 7 resources y 5 prompts, **todo de solo lectura**, sin datos
personales de compradores.

Es un consumidor más de `services/`: no reimplementa lógica de negocio y solo
puede importar de `services/`, `lib/ai/`, `lib/constants/` y `types/`. Tres
restricciones que parecen detalles y no lo son:

* **No importa `lib/supabase/admin.ts`.** Ese archivo lleva `import
  "server-only"`, que lanza bajo Node/tsx puro. Sus clientes se construyen en
  `mcp/src/context.ts`.
* **Nada escribe en stdout**, porque stdout transporta el JSON-RPC del
  protocolo. Un `console.log` de depuración corrompe la sesión entera; hay un
  `stdout-guard.ts` para que no ocurra por descuido.
* **Se lanza siempre desde la raíz**: el alias `@/*` resuelve a `./*`, y desde
  otra carpeta los imports de `services/` fallan.

Detalle: [`mcp/README.md`](../mcp/README.md).

---

## 12. Testing e integración continua

Sesión 6: **293 tests unitarios** (~3 s) y **13 specs E2E**.

### 12.1 Cómo están escritos

* El test unitario vive **junto** al archivo que prueba; los E2E, en `e2e/`.
* Los unitarios **inyectan el cliente Supabase por parámetro** — nunca
  `vi.mock` de `lib/supabase/*`. La única excepción es `lib/ai/*`, que se simula
  por módulo porque por diseño no es inyectable, y va comentada donde ocurre.
* **La suite unitaria no toca la red**: pasa con Docker apagado. Un test que
  solo pasa con el stack levantado está mal escrito.
* **El test documenta el contrato REAL, no el deseado.** Si algo parece un bug,
  se ancla con `// comportamiento actual, revisar:` y va a la bitácora; no se
  cambia producción para que un test luzca mejor.
* Los valores frontera salen de las constantes reales importadas, y las
  aserciones de dinero de `formatPrice`: `Intl` separa "S/" del monto con un
  espacio duro (U+00A0), invisible al leer y letal al comparar.

### 12.2 El pipeline

`.github/workflows/ci.yml`, en cada push a `main` y cada PR, con **cero
secretos**:

| Job | Qué hace |
|---|---|
| `checks` | type-check, lint, `test:coverage`, type-check del MCP; sube la cobertura como artefacto |
| `e2e` | `needs: checks`. Levanta un Supabase efímero, lo siembra, lee sus credenciales en caliente y corre Playwright en Chromium contra `build && start` |

Dos detalles que no se tocan a la ligera:

* `package.json` fija `"packageManager": "npm@11.6.2"` y el workflow **pinea esa
  misma versión** antes de `npm ci`. El lockfile se generó con ella en Windows,
  y un npm más nuevo en Linux resuelve distinto las dependencias opcionales y
  rompe `npm ci`. Si se regenera el lockfile, hay que cambiar los dos sitios a
  la vez.
* `mcp/` está **excluido** del `tsconfig.json` de la raíz: tiene su propio
  type-check, que el CI ejecuta en su carpeta.

---

## 13. Despliegue y performance

Sesión 7.

### 13.1 Despliegue

```
Pull Request ──> CI (checks + e2e) ──verde──> merge a main ──> Vercel: PRODUCCIÓN
     │                   │
     │                 rojo ──> 🔒 merge bloqueado (branch protection)
     └──> Vercel: PREVIEW (URL propia)
```

Vercel se conecta a GitHub **por su propia interfaz**: sin CLI, sin tokens de
deploy y sin jobs de despliegue en el workflow. Los secretos se cargan a mano en
el dashboard de Vercel, y **GitHub Actions no recibe ninguno** — el CI levanta
su propio Supabase efímero, así que no los necesita.

En producción, el esquema se aplica con `supabase db push` desde las migraciones
del repositorio: **el remoto nunca se edita a mano**. El catálogo nace vacío a
propósito (`seed.prod.sql` trae solo categorías y FAQ, sin usuarios ni
productos).

Variables, pasos, smoke test y rollback: [`DEPLOY.md`](DEPLOY.md).

### 13.2 Performance: lo que la medición dejó al descubierto

La regla de la fase fue **medir → cambiar → medir**, siempre contra build de
producción. Lo conseguido: el CLS de la home pasó de 0.118 a **0**, y las dos
rutas más pesadas bajaron 21 kB cada una cargando la galería bajo demanda.

Lo que **no** se consiguió, y su causa, importa más: el objetivo de Lighthouse
≥ 90 no se alcanza porque **el catálogo se pide desde el cliente**. El HTML
inicial no trae ni una tarjeta; hay que descargar ~300 kB de JavaScript,
hidratar y recién entonces pedir los datos y las imágenes. Eso son ~3.9 s de
"Load Delay" en el LCP que ninguna optimización de imagen puede tocar.

Arreglarlo significa servir el catálogo desde **Server Components**, lo que
cambia la regla `hooks → services` del §1. Es la deuda técnica principal del
proyecto, está medida, y no se pagó en la sesión 7 porque cambiar el contrato de
capas a mitad de un go-live es exactamente el riesgo que esa sesión existía para
evitar.

Números, metodología y los tres errores de medición cometidos por el camino:
[`PERFORMANCE.md`](PERFORMANCE.md).

---

## 14. Qué sigue

* **Sesión 8** — el asistente de soporte se convierte en agente de voz sobre
  `support_tickets` / `ticket_messages`, reutilizando el mismo RAG y la tool
  `get_order_status` del servidor MCP.
* **Deuda técnica registrada** — servir el catálogo desde el servidor (§13.2);
  el CLS de `/categoria/[slug]` y `/producto/[id]`, que sigue en 0.118; y un
  proyecto Supabase de staging separado del de producción, hoy compartido con
  los previews.
