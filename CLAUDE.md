# CLAUDE.md — MercadoTech

Este documento es el contrato entre el equipo y Claude Code. Léelo antes de
generar código en este repositorio.

## Qué es MercadoTech (y qué NO es)

MercadoTech es un marketplace de productos tecnológicos: compradores navegan
un catálogo, ven detalle con galería de imágenes, preguntas y respuestas y
reseñas verificadas, agregan al carrito y hacen checkout; vendedores publican
productos y gestionan pedidos; un asistente de soporte (RAG desde la sesión 4,
agente de voz desde la sesión 8) responde con base en la FAQ de la plataforma;
un admin modera y mantiene la base de conocimiento.

**NO hay pasarela de pago real en ningún momento del proyecto.** El checkout
es simulado: crea el pedido y descuenta stock, sin cobrar.

## Comandos

Convención objetivo (se completa a medida que cada sesión los habilita):

```bash
npm run dev         # servidor de desarrollo (Next.js, Turbopack)
npm run build       # build de producción
npm run lint        # ESLint
npm run type-check  # tsc --noEmit
npm run test        # Vitest (unit) — desde la sesión 6
npm run test:e2e    # Playwright (E2E) — desde la sesión 6
npm run db:types    # regenera types/database.ts desde el esquema local
npm run db:images   # descarga imágenes de muestra y las sube a Storage
```

`db:images` existe porque el seed crea las filas de `product_images` pero no
los archivos. Requiere el manifiesto que documenta `scripts/seed-images.mjs`.

Base de datos (Supabase CLI, requiere Docker corriendo):

```bash
supabase start                    # levanta el stack local (Postgres + servicios)
supabase stop                     # lo detiene
supabase db reset                 # reconstruye desde cero: migrations/ + seed.sql
supabase migration new <nombre>   # crea el siguiente archivo de migración con timestamp
```

## Arquitectura por capas

```
components/        Presentación PURA. Reciben props, no hacen fetching, no conocen Supabase.
  ui/              generados por shadcn (estilo base-nova, sobre Base UI)
  shared/          Price, RatingStars, ConditionBadge, ProductImage, Empty/Error/LoadingState, Container
  layout/          Navbar, SearchBar, CategoriesMenu, CartIndicator, UserMenu, MobileNav, SellerSidebar, NavLink, Brand
  auth/ catalog/ product/ cart/ orders/ seller/   una carpeta por dominio de pantalla
hooks/             Estado de cliente. Llaman a services. Cero lógica de negocio propia.
services/          Lógica de negocio. Cada función acepta un SupabaseClient INYECTABLE
                   (default: cliente de navegador) — así hooks y Route Handlers comparten
                   la misma lógica, y los tests la mockean sin red.
lib/supabase/      Clientes: browser (anon), server (cookies+RLS), admin (service role).
lib/ai/            ÚNICOS archivos que conocen la API del proveedor de IA.
lib/voice/         ÚNICOS archivos que conocen la API de voz del navegador/proveedor.
lib/validators/    Validación framework-agnóstica, compartida entre UI y servidor.
lib/constants/     Todos los tunables centralizados y documentados:
                   roles.ts, catalog.ts (page size, orden), orders.ts (flujo de
                   estados, colores), product.ts (límites de título e imágenes).
types/             Tipos de dominio + database.ts generado por Supabase.
app/api/v1/        Route Handlers DELGADOS, solo para lo que no puede correr en el
                   navegador (secretos de IA, service role, cookies de sesión).
                   Vacío a propósito hasta la sesión 4.
scripts/           Utilidades de apoyo fuera del build (seed-images.mjs).
```

Reglas de independencia (aplican en todas las sesiones):

1. **Un archivo, una responsabilidad.** `product.service.ts` no sabe de pedidos;
   `order.service.ts` no sabe de embeddings.
2. **Sin barrels.** Se importa el archivo específico, nunca "todo el módulo".
3. **La UI nunca importa `lib/ai/`, `lib/voice/` ni el cliente admin**
   (`lib/supabase/admin.ts`).
4. **Un solo camino de datos:** hooks → services → Supabase (RLS). NO se
   construye una capa REST paralela "por si acaso" (lección de ReadHub: quedó
   una API v1 completa que el frontend nunca llamó).
5. **Todo tunable vive en `lib/constants/`** con un comentario que justifica
   su valor.
6. **Las páginas (`app/**/page.tsx` y los layouts) son el ÚNICO punto donde un
   hook se encuentra con un componente.** Si un componente necesita el tipo de
   un hook o de un service, ese tipo se mueve a `types/` o `lib/constants/`.

Estos dos greps deben devolver SIEMPRE vacío:

```bash
grep -rl "@/lib/supabase" components hooks   # solo services/ y app/ usan clientes
grep -rl "from \"@/services" components      # los componentes no llaman services
```

## Convenciones de código

* TypeScript estricto (`strict: true`), sin `any` implícito.
* Español para comentarios y documentación; inglés para identificadores
  (variables, funciones, tipos, archivos).
* Servicios: `<dominio>.service.ts` (ej. `product.service.ts`).
* Hooks: `use<Dominio>.ts` (ej. `useProducts.ts`).

### Reglas de datos (aprendidas en la sesión 3)

* Firma de service: `fn(args, supabase: Client = createClient())` — el cliente
  va SIEMPRE al final y con default. Los errores de Supabase se lanzan tal
  cual; el hook los traduce a estado.
* `numeric` llega como `string` desde PostgREST: el service lo convierte con
  `Number()`; los componentes siempre reciben `number`.
* Los componentes reciben `image_url` ya resuelta, nunca un `image_path` de
  Storage.
* Filtrar `is_active = true` explícitamente en el catálogo: RLS solo lo impone
  a los anónimos, y un vendedor vería los suyos inactivos.
* Los filtros del catálogo viven en la URL; se escriben en UNA sola llamada
  (`setFilters(parcial)`), porque dos `router.push` seguidos parten del mismo
  snapshot y el segundo pisa al primero.
* Las reglas de transición de estado (kanban) viven en el HOOK: la RLS valida
  el destino, no la secuencia.
* Colores solo por tokens de `app/globals.css`; nada hardcodeado. Un `Badge`
  con color de token necesita `transition-none` o se queda anclado al tema
  anterior al alternar claro/oscuro.

## Fuente de verdad de la base de datos

Desde la sesión 2, `supabase/migrations/` es la ÚNICA fuente de verdad del
esquema. `supabase/schema.sql` y `supabase/policies.sql` son copias de
referencia legibles, generadas a partir de las migraciones — nunca al revés.
La arquitectura completa (capas, modelo relacional, decisiones de diseño,
políticas RLS en lenguaje de negocio) está documentada en
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Mapa de rutas

Tienda `(shop)`: `/`, `/buscar`, `/categoria/[slug]`, `/producto/[id]`,
`/favoritos`, `/carrito`, `/pedidos`, `/pedidos/[id]`.
Vendedor `(seller)`, SIEMPRE bajo el prefijo `/vendedor/` para no colisionar
con `/pedidos` del comprador: `/vendedor/productos`, `/vendedor/publicar`,
`/vendedor/productos/[id]/editar`, `/vendedor/pedidos`.
Auth `(auth)`: `/login`, `/register`.

Requieren sesión (lo impone `lib/supabase/middleware.ts`): `/carrito`,
`/pedidos`, `/favoritos`, `/vendedor`. El detalle de producto es PÚBLICO.

## Estado del proyecto

* Sesión 1: no ejecutada (sin `docs/COSTOS.md` ni `docs/PROMPTS.md`).
* Sesión 2: completa, incluidas 2.6 y 2.7.
* Sesión 3: completa (Fases 3.1–3.8). MVP funcional.
* Siguiente: sesión 4 (RAG, `/soporte`, Route Handlers de `app/api/v1/`).

Detalle de decisiones y problemas: [`docs/BITACORA.md`](docs/BITACORA.md).
Checklist de calidad: [`docs/SESION3_CHECKLIST.md`](docs/SESION3_CHECKLIST.md).

## Regla de sesiones

Cada sesión tiene su especificación completa en `MercadoTech_sesionN.md`. No
se adelanta trabajo de fases o sesiones futuras, incluso si parece trivial
hacerlo ahora.
