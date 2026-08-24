# MercadoTech — Prompts específicos de la Sesión 3 (UI y Frontend)

Cada prompt está construido con los ítems de la rúbrica de prompt engineering
(Rol, Contexto, Objetivo, Público/tono, Restricciones, Formato, Ejemplos,
Razonamiento), incluyendo **solo los pertinentes para cada fase**. Para código
de frontend los que más rinden son Contexto, Objetivo, Restricciones y Formato;
Razonamiento se agrega donde conviene planificar antes de tocar archivos
(rutas, auth, checkout, drag & drop); Ejemplos donde hay una convención que
imitar; Público/tono solo donde se escriben textos que verá el usuario final.

Todos asumen que existe `mercadotech/MercadoTech_sesion3.md` (la spec, versión
validada del 2026-08-21). El prompt la referencia SIEMPRE — la spec es la
fuente de verdad; el prompt es el disparador autocontenido.

| Fase | Rol | Contexto | Objetivo | Público/tono | Restricciones | Formato | Ejemplos | Razonamiento | Modelo sugerido |
|---|---|---|---|---|---|---|---|---|---|
| 3.0 Entorno y herramientas | ✔ | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| Lectura de la spec | — | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| 3.1 Tipos + sistema visual | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | — | Sonnet |
| 3.2 Layouts y rutas | ✔ | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| 3.3 Autenticación | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | Opus |
| 3.4 Catálogo | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | — | Sonnet |
| 3.5 Detalle, Q&A, reseñas | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | Sonnet |
| 3.6 Carrito y checkout | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Opus |
| 3.7 Panel vendedor + DnD | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | Opus |
| 3.8 Responsive y estados | ✔ | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| Cierre: bitácora + CLAUDE.md | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sonnet |

La columna "Modelo sugerido" sigue la tabla tarea → modelo de la sesión 1
(`docs/COSTOS.md`, que NO se generó — la sesión 1 no se ejecutó): Sonnet para
features estándar; Opus donde un error cuesta más que el modelo (migración de
auth, checkout transaccional, actualización optimista con rollback).

---

## Cómo usar estos prompts

1. **Un prompt por turno, en orden.** Empezar cada fase en una conversación
   nueva (o tras `/clear`): el prompt lleva todo el contexto necesario.
2. **Contextualización obligatoria.** Como cada fase arranca sin memoria de la
   anterior, TODOS los prompts incluyen un bloque `[CONTEXTO]` que describe el
   estado real del repositorio y ordena leer archivos concretos ANTES de
   generar código. No recortarlo: es lo que evita que el agente reinvente lo
   que ya existe o ignore una restricción de RLS.
3. **Prerrequisito de datos.** Desde la Fase 3.3 en adelante el stack local de
   Supabase debe estar corriendo (`supabase status` sin error). El Prompt 0 lo
   deja listo; si se reinició la máquina, `supabase start` antes de seguir.
4. **Commit por fase.** Cada prompt termina pidiendo el mensaje de commit; la
   convención heredada de la sesión 2 es `feat: <qué> for Fase 3.x`
   (`chore:` para tooling, `docs:` para documentación).
5. **Cierre.** Tras la Fase 3.8 se ejecuta el Prompt de cierre: deja la
   bitácora de la sesión en `docs/BITACORA.md` y actualiza `CLAUDE.md` con lo
   que la sesión cambió. Es lo que permite que la sesión 4 arranque con
   contexto sin releer ocho conversaciones.

### Estado del repositorio al iniciar la sesión (verificado el 2026-08-21)

Esto es lo que el `[CONTEXTO]` de cada prompt da por cierto:

* Sesión 1 **no ejecutada**: no existen `docs/COSTOS.md` ni `docs/PROMPTS.md`.
  Sí existe `CLAUDE.md` (creado en la sesión 2) y es el contrato vigente.
* Sesión 2 ejecutada hasta la Fase 2.5 (commits `948d740`…`cb96ae4`): proyecto
  Next.js 15.5 + React 19 + Tailwind v4 + shadcn inicializado (`components.json`,
  estilo `base-nova`, `@base-ui`); clientes Supabase en `lib/supabase/`; 14
  tablas con RLS, RPC `create_order_from_cart`, buckets y `seed.sql`.
  Fases 2.6 (tests RLS) y 2.7 (`docs/ARQUITECTURA.md`) **pendientes**.
* Entorno: Node 24, npm 11, Git, Supabase CLI 2.111, Docker 29 instalados.
  **Stack local NO levantado** y `.env.local` con las 4 variables **vacías**.
* Dependencias que FALTAN para esta sesión: `lucide-react`, `@dnd-kit/core`,
  `@dnd-kit/sortable`, `@dnd-kit/utilities`, y los 16 componentes shadcn de
  la spec (incluido `sonner`).
* Carpetas `components/`, `hooks/`, `services/`, `types/`, `lib/validators/`
  y los grupos de rutas `(auth)`, `(shop)`, `(seller)`: vacíos (`.gitkeep`).
* Hay un MCP de Supabase configurado contra un proyecto hosted, pendiente de
  aprobación. **No se usa en esta sesión**: todo corre contra el stack local.

---

## Prompt 0 — Provisión del entorno y herramientas de la sesión

```text
[ROL] Actúa como ingeniero DevOps de un equipo frontend: tu trabajo es dejar
el entorno listo para que los siguientes ocho prompts solo escriban código.

[CONTEXTO] Proyecto MercadoTech (marketplace de productos tecnológicos),
carpeta mercadotech/. Lee primero CLAUDE.md y la sección "Estado de partida"
de mercadotech/MercadoTech_sesion3.md. Estado real verificado:
- La sesión 1 del curso NO se ejecutó: no hay docs/COSTOS.md ni
  docs/PROMPTS.md. No los crees — no son necesarios para construir.
- La sesión 2 dejó el proyecto Next.js 15 + Supabase (migraciones, RLS, seed)
  pero el stack local NO está corriendo y .env.local tiene las variables
  vacías (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL).
- Herramientas presentes: Node 24, npm 11, Git, Supabase CLI 2.111, Docker 29.
- Faltan dependencias: lucide-react, @dnd-kit/core, @dnd-kit/sortable,
  @dnd-kit/utilities y los componentes shadcn/ui.
- Existe un MCP de Supabase apuntando a un proyecto hosted; NO lo uses — esta
  sesión trabaja 100 % en local.

[OBJETIVO] Deja el entorno operativo, en este orden:
1. Verifica versiones (node >= 20, npm, git, supabase, docker) y que Docker
   Desktop esté corriendo (`docker info`). Si Docker no responde, detente y
   dime cómo arrancarlo — no continúes sin él.
2. `supabase start`; luego `supabase status -o env` y escribe los valores en
   .env.local (URL, anon key, service role key; NEXT_PUBLIC_SITE_URL =
   http://localhost:3000). Confirma que .gitignore excluye .env*.local.
3. `supabase db reset` para aplicar migraciones + seed. Verifica con SQL
   (psql o `supabase db query`): 6 filas en auth.users, 16 en products,
   6 en orders, 14 tablas con rowsecurity = true.
4. Instala: `npm i lucide-react @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.
5. Instala los componentes shadcn de la spec (Fase 3.1):
   `npx shadcn@latest add button card input label textarea select badge dialog
   dropdown-menu avatar separator skeleton tabs sheet sonner table`.
   Acepta sobrescribir nada (no existe nada en components/ui todavía).
6. Agrega a package.json el script "db:types":
   "supabase gen types typescript --local > types/database.ts" (NO lo ejecutes
   todavía: generar los tipos es el paso 1 de la Fase 3.1).
7. `npm run dev`, `npm run lint` y `npm run type-check` deben pasar con todo
   lo anterior instalado.

[RESTRICCIONES]
- NO modifiques migraciones, seed.sql ni políticas RLS.
- NO generes componentes propios, hooks, services ni páginas: eso empieza en
  la Fase 3.1. Solo instalación, configuración y verificación.
- NO imprimas la service role key en el chat: escríbela directo en .env.local.
- NO apruebes ni uses el MCP de Supabase hosted.
- Si `shadcn add` pide elegir opciones interactivas, dime cuáles y por qué
  antes de elegir.

[RAZONAMIENTO] Antes de ejecutar nada, muestra el plan de comandos en orden y
qué esperas de cada uno; ejecuta uno a uno y, si alguno falla, diagnostica
antes de pasar al siguiente (un `supabase start` a medias deja contenedores
zombis — límpialos con `supabase stop` y reintenta).

[FORMATO DE SALIDA] (1) Tabla herramienta × versión × estado; (2) salida
resumida de `supabase status` (sin claves); (3) conteos de la verificación
del seed; (4) lista de paquetes y componentes instalados (ls components/ui);
(5) evidencia de dev/lint/type-check; (6) mensaje de commit propuesto:
"chore: provision tooling and local stack for Sesión 3".
```

## Prompt 1 — Lectura de la spec (sin código)

```text
[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. El entorno quedó
provisto por el Prompt 0 (stack Supabase local corriendo, dependencias y
componentes shadcn instalados). Vas a ejecutar la sesión 3 en 8 fases, una
por prompt, y cada fase empieza sin memoria de la anterior.

[OBJETIVO] Lee COMPLETOS, en este orden: CLAUDE.md,
mercadotech/MercadoTech_sesion3.md, supabase/migrations/20260821130000_create_rls_policies.sql
y supabase/seed.sql (solo las secciones 1, 3 y 5: usuarios, productos, pedidos).
Después confírmame que entiendes el alcance.

[RESTRICCIONES] No generes código ni archivos. No propongas cambios a la spec:
si ves algo contradictorio, señálalo como pregunta.

[RAZONAMIENTO] Contrasta la tabla "Decisiones tomadas al validar la spec" de
la spec con las políticas RLS reales que acabas de leer y dime si alguna
decisión no se sostiene con el SQL actual.

[FORMATO DE SALIDA] (1) Resumen de 8 líneas, una por fase: qué se construye y
de qué depende; (2) las 3 restricciones del esquema que más condicionan la UI,
citando la política o trigger que las impone; (3) dudas o contradicciones
encontradas (o "ninguna"); (4) confirmación explícita de que no adelantarás
trabajo de fases futuras.
```

## Prompt Fase 3.1 — Tipos generados, sistema visual y componentes base

```text
[ROL] Actúa como frontend engineer senior en Next.js 15 + Tailwind v4 +
shadcn/ui, riguroso con los design tokens y con componentes 100 % de
presentación.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir, lee:
CLAUDE.md; mercadotech/MercadoTech_sesion3.md (secciones "Convenciones
transversales" y "Fase 3.1"); app/globals.css (tokens neutros por defecto de
shadcn, hay que reemplazarlos); components.json (estilo base-nova, iconos
lucide); lib/utils.ts (solo tiene `cn`); lib/constants/roles.ts (de ahí sale
ProductCondition); next.config.ts. Estado: el Prompt 0 instaló los 16
componentes shadcn en components/ui/ y el script "db:types"; el stack
Supabase local está corriendo. types/, components/shared/ y app/dev/ no
existen todavía.

[OBJETIVO] Ejecuta la Fase 3.1 completa según la tabla "Archivos" de la spec:
(1) `npm run db:types` → types/database.ts, y los tipos de dominio en types/
derivados de Database['public']['Tables']; (2) tokens de tema claro/oscuro en
globals.css con primario azul eléctrico; (3) images.remotePatterns en
next.config.ts para Supabase local (127.0.0.1:54321) y hosted (*.supabase.co);
(4) `formatPrice` en lib/utils.ts; (5) los componentes de components/shared/:
Price, RatingStars, ConditionBadge, ProductImage (con placeholder ante error),
EmptyState, ErrorState, LoadingState, Container; (6) la página de muestra
app/dev/ui/page.tsx con todos ellos en sus variantes.

[RESTRICCIONES]
- Ningún archivo de components/ importa @/lib/supabase, services ni hooks.
- No crees pantallas, layouts, hooks ni services: eso es 3.2 en adelante.
- `Price` y `formatPrice` aceptan number | string (numeric llega como string
  desde PostgREST). No uses `any`.
- No edites types/database.ts a mano; los tipos de dominio van en archivos
  aparte (product.ts, order.ts, user.ts, question.ts, review.ts).
- Colores solo vía variables CSS de globals.css; nada hardcodeado.

[EJEMPLOS] Firma esperada de la util y su uso:
  export function formatPrice(value: number | string): string
  formatPrice(1299.9)   // "S/ 1,299.90"
  formatPrice("219.00") // "S/ 219.00"
Tipo de dominio esperado (campos calculados además de la fila):
  export type Product = Database["public"]["Tables"]["products"]["Row"] & {
    price: number; image_url: string | null;
    average_rating: number | null; review_count: number;
  };

[FORMATO DE SALIDA] (1) Árbol de archivos creados/modificados; (2) captura o
descripción de /dev/ui en tema claro y oscuro; (3) evidencia de `npm run lint`
y `npm run type-check`; (4) mensaje de commit: "feat: add generated types,
theme tokens and base components for Fase 3.1".
```

## Prompt Fase 3.2 — Layouts, navegación y mapa de rutas

```text
[ROL] Actúa como arquitecto frontend especialista en App Router de Next.js
15 (route groups, layouts anidados, colisiones de rutas).

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir, lee:
CLAUDE.md; mercadotech/MercadoTech_sesion3.md (sección "Fase 3.2" COMPLETA,
incluido el mapa de rutas y la tabla "Cómo se conectan los componentes del
navbar"); app/layout.tsx (aún dice "Create Next App", lang="en");
app/page.tsx (página por defecto — se elimina en esta fase); y el contenido
actual de components/shared/ y components/ui/ (creados en 3.1 y Prompt 0) —
lístalo con ls antes de empezar y reutilízalo, no lo dupliques.

[OBJETIVO] Ejecuta la Fase 3.2: layout raíz real (fuentes, Toaster de sonner,
metadata "MercadoTech", lang="es"); layouts (shop), (seller) y (auth);
componentes PUROS de components/layout/: Navbar, SearchBar, CategoriesMenu,
CartIndicator, UserMenu, MobileNav, SellerSidebar, NavLink; y TODAS las 14
rutas del mapa como páginas placeholder con EmptyState "Próximamente
(Fase 3.x)".

[RESTRICCIONES]
- El panel del vendedor va bajo app/(seller)/vendedor/... (prefijo /vendedor)
  para no colisionar con /pedidos del comprador. Elimina app/page.tsx.
- Los componentes del navbar reciben TODO por props; el layout les pasa
  valores estáticos (categories=[], count=0, user=null). Los hooks que los
  alimentan NO existen todavía y no debes crearlos.
- "Soporte" no aparece en el menú (la ruta llega en la sesión 4).
- Ningún componente importa Supabase, services ni hooks.
- La protección por rol del layout (seller) se conecta en 3.3: deja el punto
  de extensión comentado, no lo implementes.

[RAZONAMIENTO] Antes de crear archivos: lista las 14 URLs del mapa con el
archivo que las servirá y confirma que ninguna colisiona (dos page.tsx no
pueden resolver a la misma URL aunque estén en grupos distintos). Después
construye.

[FORMATO DE SALIDA] (1) Tabla URL × archivo × grupo; (2) evidencia de
`npm run build` sin errores de rutas duplicadas; (3) descripción del navbar
en móvil (sheet) y desktop; (4) lint y type-check; (5) commit: "feat: add
layouts, navigation and route map for Fase 3.2".
```

## Prompt Fase 3.3 — Autenticación

```text
[ROL] Actúa como ingeniero full-stack experto en Supabase Auth con
@supabase/ssr en Next.js (sesión por cookies, middleware, triggers sobre
auth.users) y en RLS.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir, lee:
CLAUDE.md; mercadotech/MercadoTech_sesion3.md (sección "Fase 3.3" completa y
la decisión 1 de la tabla de validación); lib/supabase/client.ts, server.ts y
middleware.ts (este último solo refresca sesión — lo vas a ampliar);
middleware.ts raíz; supabase/migrations/20260821120100_create_profiles.sql
(función handle_new_user actual: fija role='buyer' y display_name = prefijo
del email); supabase/migrations/20260821130000_create_rls_policies.sql
(trigger protect_profile_role: bloquea que un usuario cambie su propio role);
supabase/config.toml ([auth]: enable_confirmations = false en local);
components/layout/UserMenu.tsx y app/(seller)/layout.tsx (creados en 3.2,
reciben user por props / tienen el punto de extensión del guard). Usuarios
del seed para probar (contraseña MercadoTech123!): buyer1@, seller1@,
admin@mercadotech.test.

[OBJETIVO] Ejecuta la Fase 3.3: (1) migración NUEVA
supabase/migrations/<timestamp>_handle_new_user_metadata.sql que reemplace
handle_new_user leyendo display_name y role desde new.raw_user_meta_data
(role solo 'buyer' o 'seller'; cualquier otro valor → 'buyer'); actualizar
schema.sql de referencia; `supabase db reset`. (2) lib/validators/auth.ts.
(3) services/auth.service.ts (register/login/logout/getCurrentUser, cliente
inyectable). (4) hooks/useAuth.ts con onAuthStateChange. (5) LoginForm y
RegisterForm puros + páginas /login y /register con redirectTo. (6) Ampliar
lib/supabase/middleware.ts: sin usuario en /carrito, /pedidos, /favoritos o
/vendedor → redirect a /login?redirectTo=. (7) Conectar UserMenu con useAuth
y el guard de rol en (seller)/layout (toast + redirect a / si no es
seller/admin).

[RESTRICCIONES]
- NO edites migraciones existentes ni seed.sql: la migración nueva usa
  `create or replace function` en un archivo nuevo. Justifica en comentario
  SQL por qué el rol solo puede fijarse en el INSERT del trigger.
- El registro NUNCA puede producir role='admin', ni aunque el cliente lo
  envíe manipulado.
- No crees Route Handlers en app/api/v1/ para auth: todo va por el cliente de
  navegador + middleware.
- register envía display_name y role en options.data del signUp; no hagas un
  update a profiles después (el trigger lo bloquearía).
- Componentes puros; la validación se hace con lib/validators/auth.ts antes
  de llamar al service.

[EJEMPLOS] Núcleo esperado de la función en la migración nueva:
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''),
             split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data->>'role' in ('buyer', 'seller')
         then new.raw_user_meta_data->>'role' else 'buyer' end
  );

[RAZONAMIENTO] Antes de codificar: explica en 5 líneas por qué sin la
migración el registro como vendedor es imposible (cita el trigger), y qué
pasaría si el middleware protegiera /producto (no debe: el detalle es
público). Luego implementa en el orden del objetivo.

[FORMATO DE SALIDA] (1) Migración nueva + confirmación de `supabase db reset`
limpio; (2) archivos creados; (3) evidencia de las 5 verificaciones de la
spec (registro seller → role correcto; role 'admin' manipulado → 'buyer';
login con seed; buyer1 en /vendedor/productos → redirect; anónimo en
/carrito → /login?redirectTo=/carrito); (4) lint y type-check; (5) commit:
"feat: add auth (registration role migration, service, hook, screens) for
Fase 3.3".
```

## Prompt Fase 3.4 — Catálogo de productos

```text
[ROL] Actúa como frontend engineer senior experto en PostgREST/supabase-js
(selects anidados, count exact, range, or/ilike) y en estado de filtros en URL.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir, lee:
CLAUDE.md; mercadotech/MercadoTech_sesion3.md ("Convenciones transversales"
y "Fase 3.4"); types/product.ts y types/database.ts (3.1); components/shared/
(Price, ConditionBadge, RatingStars, ProductImage, EmptyState —
reutilízalos); components/layout/CategoriesMenu.tsx y SearchBar.tsx (puros,
hay que conectarlos); hooks/useAuth.ts y services/auth.service.ts (3.3:
copia el patrón de cliente inyectable); supabase/seed.sql sección 3 (16
productos: b…08 y b…16 inactivos, b…06 con stock 0) y la migración de Storage
(URL pública: /storage/v1/object/public/product-images/{path}). Estado:
services/ solo tiene auth.service.ts; hooks/ solo useAuth.ts.

[OBJETIVO] Ejecuta la Fase 3.4 según la tabla "Archivos" de la spec:
lib/constants/catalog.ts; services/storage.service.ts (SOLO getPublicUrl por
ahora); services/category.service.ts; services/product.service.ts
(listActiveProducts con filtros/orden/paginación, getProductById,
getProductImages); hooks/useCategories.ts y hooks/useProducts.ts (filtros en
searchParams); components/catalog/ (ProductCard, ProductGrid con skeletons,
FiltersPanel, Pagination); páginas / , /categoria/[slug] y /buscar?q=
reutilizando el MISMO grid y hook; conectar CategoriesMenu y SearchBar en
(shop)/layout.

[RESTRICCIONES]
- Búsqueda por texto con ilike sobre title y brand, con comentario
  "provisional hasta la búsqueda semántica de la sesión 4". No implementes
  nada de IA.
- El service convierte price a number, ordena product_images por position,
  resuelve image_url de la portada y calcula average_rating/review_count
  desde reviews(rating). ProductCard recibe todo resuelto.
- Filtrar is_active = true explícitamente (un vendedor logueado vería los
  suyos inactivos en la home si no).
- Tunables (page size, sort options) solo en lib/constants/catalog.ts con
  comentario que justifique el valor.
- No toques el detalle de producto (3.5) ni el carrito (3.6).

[EJEMPLOS] Forma esperada del service (cliente inyectable como último
parámetro, errores propagados tal cual):
  export async function listActiveProducts(
    filters: ProductFilters,
    supabase: Client = createClient(),
  ): Promise<{ items: Product[]; total: number }>
Select anidado de referencia:
  .select("*, product_images(image_path, position), reviews(rating)", { count: "exact" })

[FORMATO DE SALIDA] (1) Archivos creados; (2) evidencia de las 5
verificaciones de la spec (14 activos en 2 páginas; /categoria/laptops;
/buscar?q=asus; filtros reflejados en URL; placeholders sin imagen rota);
(3) lint y type-check; (4) commit: "feat: add product catalog with filters
and search for Fase 3.4".
```

## Prompt Fase 3.5 — Detalle de producto, preguntas, reseñas y favoritos

```text
[ROL] Actúa como frontend engineer senior que diseña UIs "defensa en
profundidad": la interfaz solo ofrece acciones que la RLS va a permitir.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir, lee:
CLAUDE.md; mercadotech/MercadoTech_sesion3.md ("Fase 3.5" completa, con las
decisiones 7, 8 y 14); services/product.service.ts y hooks/useProducts.ts
(3.4, patrón a seguir); hooks/useAuth.ts (3.3); components/shared/ y
components/catalog/ProductCard.tsx (reutilizar en /favoritos); en
supabase/migrations/20260821130000_create_rls_policies.sql las secciones
profiles (SELECT solo dueño/admin), questions (UPDATE solo vendedor dueño +
trigger lock_question_immutable_fields), reviews (INSERT exige order_id de
pedido 'entregado' con ese producto) y product_views (INSERT authenticated,
user_id not null); supabase/seed.sql secciones 5–7 (pedidos entregados c…01
de buyer1 y c…06 de buyer3; reseñas ya existentes).

[OBJETIVO] Ejecuta la Fase 3.5: ampliar product.service con registerView;
services question.service.ts, review.service.ts (con canReview →
{allowed, orderId}), favorite.service.ts; hooks useProduct, useQuestions,
useReviews, useFavorite, useFavorites; componentes components/product/
(ProductGallery, ProductInfo, BuyBox, QuestionsSection, ReviewsSection);
página /producto/[id] compuesta con los hooks; página /favoritos.

[PÚBLICO/TONO] Textos visibles en español neutro y cortos. Como profiles no
es legible para terceros, las preguntas muestran "Usuario" y las reseñas
"Comprador verificado" + fecha; el BuyBox deshabilitado explica el motivo
("Sin stock", "Es tu propio producto", "Inicia sesión para comprar").

[RESTRICCIONES]
- review.create DEBE enviar order_id; el formulario solo aparece si
  canReview.allowed es true. canReview también verifica que no exista ya una
  reseña (unique por comprador/producto).
- registerView solo con sesión, fire-and-forget, sin bloquear ni romper la UI.
- answer solo se muestra si profile.id === product.seller_id.
- "Agregar al carrito" queda como callback onAddToCart en BuyBox; el carrito
  se implementa en 3.6 — no crees cart.service ni useCart.
- NO crees la vista public_profiles ni ninguna migración: deja comentario en
  el componente sobre la limitación de nombres.
- Componentes puros; sin imports de Supabase/services/hooks en components/.

[RAZONAMIENTO] Antes de codificar: para cada acción de la pantalla
(preguntar, responder, reseñar, favorito, registrar vista) indica qué
política/trigger la permite y qué condición muestra el hook para ofrecerla.
Si alguna acción no tiene política que la respalde, no la construyas.

[FORMATO DE SALIDA] (1) Tabla acción × política RLS × condición en el hook;
(2) archivos creados; (3) evidencia de las verificaciones de la spec
(buyer1 en b…01 NO ve formulario porque ya reseñó; tras marcar c…03 como
'entregado' en Studio, buyer2 sí lo ve en b…09; seller1 responde solo en los
suyos; favorito persiste; product_views se inserta con sesión); (4) lint y
type-check; (5) commit: "feat: add product detail with Q&A, verified reviews
and favorites for Fase 3.5".
```

## Prompt Fase 3.6 — Carrito, checkout simulado y mis pedidos

```text
[ROL] Actúa como ingeniero full-stack experto en flujos transaccionales
sobre Postgres (RPC SECURITY DEFINER) y en manejo de errores de negocio en UI.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir, lee:
CLAUDE.md; mercadotech/MercadoTech_sesion3.md ("Fase 3.6" completa, con las
decisiones 11 y 6); supabase/migrations/20260821121500_create_checkout_function.sql
(create_order_from_cart: valida p_buyer_id = auth.uid(), bloquea stock FOR
UPDATE, crea order 'pendiente' + order_items con snapshots, descuenta stock y
vacía el carrito; mensajes de error exactos: 'El carrito está vacío', 'El
producto "%" ya no está disponible', 'Stock insuficiente para "%": disponible
%, solicitado %'); en la migración de RLS: cart_items (solo dueño,
unique(user_id, product_id)), orders (sin INSERT directo; comprador solo
cancela si 'pendiente'; trigger lock_order_immutable_fields), order_items
(solo SELECT); components/product/BuyBox.tsx (3.5, expone onAddToCart);
components/layout/CartIndicator.tsx (puro, hay que conectarlo);
hooks/useAuth.ts; lib/constants/roles.ts (ORDER_STATUSES).

[OBJETIVO] Ejecuta la Fase 3.6: lib/constants/orders.ts; services
cart.service.ts y order.service.ts; hooks useCart y useOrders; componentes
components/cart/ (CartItemRow, CartSummary) y components/orders/
(OrderStatusBadge, OrderCard, OrderItemsTable); páginas /carrito, /pedidos y
/pedidos/[id]; conectar CartIndicator con useCart().count y
BuyBox.onAddToCart con useCart().add.

[PÚBLICO/TONO] El resumen del carrito dice literalmente "Pago simulado para
el laboratorio — no se realiza ningún cobro". El diálogo de cancelación
advierte "El stock no se repone automáticamente". Los errores del checkout se
muestran tal como los devuelve la base (ya nombran el producto).

[RESTRICCIONES]
- NO pedir ni almacenar datos de tarjeta; comentario en código de que el
  checkout es simulado.
- addItem: si el producto ya está en el carrito, SUMA cantidad (no
  reemplaza) y la limita al stock actual.
- checkout llama al RPC con { p_buyer_id: userId }; nunca inserta en orders.
- Tras error del RPC el hook recarga el carrito (el stock pudo cambiar);
  tras éxito solo refresca (el RPC ya lo vació) y redirige a /pedidos/[id].
- cancelIfPending hace update status='cancelado' con filtro status='pendiente';
  no intentes restaurar stock (fuera de alcance, documentado).
- subtotal se calcula con el precio ACTUAL de products (el snapshot lo fija
  el RPC). Ítem con products null (inactivo) → fila "ya no disponible".
- Sin realtime: el comprador ve cambios de estado al recargar.

[EJEMPLOS] Manejo esperado del error del RPC en el hook:
  try { const orderId = await checkout(user.id); toast.success("Pedido creado"); router.push(`/pedidos/${orderId}`); }
  catch (e) { toast.error(getErrorMessage(e)); await reload(); }
  // getErrorMessage devuelve e.message de PostgrestError sin reescribirlo.

[RAZONAMIENTO] Antes de codificar: escribe la secuencia exacta de lo que
ocurre en un checkout exitoso y en uno con stock insuficiente (qué hace el
RPC, qué queda en cart_items, qué muestra la UI). Luego implementa.

[FORMATO DE SALIDA] (1) Archivos creados; (2) evidencia de las 5
verificaciones de la spec (suma de cantidad; checkout OK con stock
descontado y carrito vacío; checkout con b…06 → toast con nombre del
producto y sin pedido; cancelar pendiente OK y pagado sin botón; buyer2 no
abre pedido de buyer1); (3) lint y type-check; (4) commit: "feat: add cart,
simulated checkout and orders for Fase 3.6".
```

## Prompt Fase 3.7 — Panel del vendedor con drag & drop

```text
[ROL] Actúa como frontend engineer senior experto en dnd-kit (sortable,
sensores de teclado, accesibilidad), Supabase Storage y actualizaciones
optimistas con rollback.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir, lee:
CLAUDE.md; mercadotech/MercadoTech_sesion3.md ("Fase 3.7" completa, con las
decisiones 9, 10 y 12, y la tabla de tunables); services/storage.service.ts
(3.4, solo tiene getPublicUrl — lo amplías); services/order.service.ts y
lib/constants/orders.ts (3.6, ORDER_STATUS_FLOW); hooks/useAuth.ts;
components/layout/SellerSidebar.tsx y app/(seller)/ (3.2–3.3, con guard de
rol); supabase/migrations/20260821140000_create_storage_buckets.sql (path
{seller_id}/{product_id}/{n}.{ext}, 5 MB, jpeg/png/webp, sin UPDATE); en la
migración de RLS: products (UPDATE/DELETE solo dueño; SELECT incluye los
propios inactivos), product_images (solo dueño del producto), orders
(vendedor solo puede poner 'pagado' | 'enviado' | 'entregado' en pedidos con
ítems suyos — NO 'cancelado' y NO valida la secuencia), order_items
(vendedor solo ve los suyos); la FK order_items.product_id on delete
restrict (migración de order_items); supabase/seed.sql sección 5 (c…02
pendiente de seller1; c…04 multi-vendedor). Paquetes @dnd-kit/* ya instalados.

[OBJETIVO] Ejecuta la Fase 3.7: lib/constants/product.ts y
lib/validators/product.ts; services/seller.service.ts; ampliar
storage.service con uploadProductImage, deleteProductImage, saveImageOrder;
hooks useSellerProducts, useProductForm, useSellerOrders; componentes
components/seller/ (ProductsTable, ProductForm, SortableImageGallery,
OrdersKanban, OrderKanbanCard); páginas /vendedor/productos,
/vendedor/publicar, /vendedor/productos/[id]/editar y /vendedor/pedidos.

[RESTRICCIONES]
- Galería en modo create: validar → createProduct → subir imágenes en el
  orden local → insertar product_images con position = índice. El reorden
  es local hasta el submit (no hay product_id antes).
- Galería en modo edit: al soltar, saveImageOrder inmediato (upsert con
  filas completas: id, product_id, image_path, position); nuevas imágenes se
  suben con n = max(n) + 1; quitar borra en Storage y en la tabla.
- Validar tipo y tamaño en cliente con los mismos límites del bucket.
- Kanban: el hook rechaza toda transición que no sea un paso adelante en
  ORDER_STATUS_FLOW (sin llamar al service); la columna "Cancelado" no acepta
  drops; actualización optimista con rollback + toast si el service falla.
- Tarjeta del kanban: muestra solo MIS ítems y el total de mis ítems, no
  orders.total.
- deleteProduct: capturar el error de FK (código 23503) y mostrar "Este
  producto tiene ventas; desactívalo en lugar de eliminarlo".
- Ambos drag & drop con KeyboardSensor + PointerSensor y anuncios aria.
- Componentes puros; ninguna regla de negocio en components/.

[EJEMPLOS] Regla de transición esperada en useSellerOrders:
  const canMove = (from: OrderStatus, to: OrderStatus) =>
    ORDER_STATUS_FLOW.indexOf(to) === ORDER_STATUS_FLOW.indexOf(from) + 1;
Path de subida:
  `${sellerId}/${productId}/${n}.${ext}`  // ext derivada del MIME, no del nombre

[RAZONAMIENTO] Antes de codificar: (a) describe el ciclo de vida de una
imagen en create y en edit (dónde vive antes y después del submit);
(b) enumera las 4 transiciones válidas del kanban y 3 inválidas con el motivo
(hook vs RLS). Luego implementa.

[FORMATO DE SALIDA] (1) Archivos creados; (2) evidencia de las 6
verificaciones de la spec (publicar con 3 imágenes reordenadas → position y
portada correctas; reorden en edit persiste; c…02 a Pagado OK y directo a
Entregado rechazado sin llamada; drop en Cancelado bloqueado; seller2 no ve
ni edita productos de seller1; eliminar producto con ventas → mensaje);
(3) lint y type-check; (4) commit: "feat: add seller panel with sortable
gallery and orders kanban for Fase 3.7".
```

## Prompt Fase 3.8 — Responsive, accesibilidad y estados

```text
[ROL] Actúa como QA de frontend con criterio de accesibilidad (WCAG AA,
navegación por teclado) y como revisor de arquitectura por capas.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Las Fases 3.1–3.7
están implementadas y commiteadas. Antes de revisar, lee: CLAUDE.md;
mercadotech/MercadoTech_sesion3.md (sección "Fase 3.8", "Mapa de rutas" de
la 3.2 y "Criterios de aceptación de la sesión"); y obtén el inventario real
con `git log --oneline` y `ls -R app components hooks services`. No existe
todavía docs/SESION3_CHECKLIST.md.

[OBJETIVO] Ejecuta la Fase 3.8: recorre las 14 rutas del mapa en 375, 768 y
1280 px; verifica y corrige skeleton en toda carga, EmptyState con acción en
toda lista vacía, ErrorState con reintento funcional en todo fallo, foco y
teclado en formularios y en ambos drag & drop, imágenes vía ProductImage con
alt, y tema claro/oscuro. Borra app/dev/ui/page.tsx y cualquier placeholder
"Próximamente". Genera docs/SESION3_CHECKLIST.md con una fila por pantalla.

[RESTRICCIONES]
- No agregues funcionalidad nueva ni cambies contratos de services/hooks;
  solo corrige estados, responsive y accesibilidad.
- Ejecuta y pega en el checklist el resultado de:
    grep -rl "@/lib/supabase" components hooks
    grep -rl "from \"@/services" components
  Ambos deben devolver vacío; si no, corrige la capa, no el grep.
- No toques migraciones ni seed.

[RAZONAMIENTO] Primero produce el checklist con TODO en estado "pendiente",
luego recorre pantalla por pantalla marcando ✅/❌ y corrigiendo los ❌ de
inmediato (un fix por commit lógico si son varios). Al final vuelve a correr
lint, type-check y build.

[FORMATO DE SALIDA] (1) docs/SESION3_CHECKLIST.md completo en verde;
(2) lista de correcciones aplicadas (archivo + qué se arregló); (3) salida de
los dos greps; (4) evidencia de `npm run lint`, `npm run type-check` y
`npm run build`; (5) confirmación de los criterios de aceptación de la
sesión (flujo comprador y flujo vendedor completos); (6) commit: "chore:
responsive, a11y and state pass with checklist for Fase 3.8".
```

## Prompt de cierre — Bitácora de la sesión y actualización de CLAUDE.md

```text
[ROL] Actúa como tech lead que cierra una iteración: documentas lo que se
construyó, lo que se decidió y lo que quedó pendiente, para que el siguiente
equipo (o la siguiente sesión) arranque sin arqueología.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Las Fases 3.0–3.8
están implementadas y commiteadas. Antes de escribir, obtén el estado REAL
(no lo reconstruyas de memoria): `git log --oneline --reverse` (todos los
commits del repo, incluidos los de la sesión 2), `git diff --stat
fb419eb..HEAD` (lo que cambió en esta sesión), `ls -R app components hooks
services lib types docs supabase/migrations`, el checklist
docs/SESION3_CHECKLIST.md, y lee CLAUDE.md y mercadotech/MercadoTech_sesion3.md
(secciones "Decisiones tomadas al validar la spec", "Restricciones",
"Entregables"). No existe docs/BITACORA.md. La sesión 1 no se ejecutó
(no hay docs/COSTOS.md ni docs/PROMPTS.md) y de la sesión 2 quedaron
pendientes las Fases 2.6 (supabase/tests/) y 2.7 (docs/ARQUITECTURA.md) —
verifica si siguen pendientes.

[OBJETIVO] Genera dos cosas:

1. docs/BITACORA.md — bitácora ACUMULATIVA del proyecto, una sección por
   sesión, la más reciente primero. Para la sesión 3, por cada fase (3.0–3.8):
   fecha, commit(s), qué se construyó (archivos clave), decisiones tomadas con
   su porqué, problemas encontrados y cómo se resolvieron, y qué se dejó fuera
   a propósito. Cierra con: (a) estado de los criterios de aceptación de la
   sesión (✅/❌ con evidencia), (b) deuda técnica y limitaciones conocidas
   (nombres de otros usuarios no legibles, cancelar no repone stock, pedidos
   multi-vendedor, sin realtime, etc. — las que estén vigentes en el código),
   (c) pendientes para la sesión 4 y lo heredado de sesiones anteriores
   (2.6, 2.7, sesión 1). Para las sesiones 1 y 2 reconstruye una sección
   breve desde el git log, marcada explícitamente como "reconstruida a partir
   de commits".

2. CLAUDE.md actualizado con lo que ESTA sesión cambió, editando quirúrgicamente
   (no reescribas lo que sigue vigente):
   - Comandos: agrega `npm run db:types` y cualquier otro script nuevo.
   - Arquitectura por capas: subcarpetas reales de components/ (ui/, shared/,
     layout/, catalog/, product/, cart/, orders/, seller/, auth/), el mapa de
     rutas con el prefijo /vendedor, y los archivos de lib/constants/.
   - Convenciones aprendidas en esta sesión: patrón de service con cliente
     inyectable (firma), numeric llega como string y se convierte en el
     service, componentes reciben image_url resuelta, filtros en URL,
     transiciones del kanban viven en el hook.
   - Verificación de capas: los dos greps que deben devolver vacío.
   - Sección nueva y corta "Estado del proyecto": sesiones completadas,
     pendientes, y enlace a docs/BITACORA.md y docs/SESION3_CHECKLIST.md.

[PÚBLICO/TONO] La bitácora la lee alguien que NO estuvo en la sesión:
español claro, frases cortas, hechos con su evidencia (commit, archivo,
comando). CLAUDE.md lo lee Claude Code en CADA conversación: cada línea que
agregues debe cambiar cómo se escribe código; lo narrativo va a la bitácora.

[RESTRICCIONES]
- Documenta lo CONSTRUIDO, no el plan: si el código difiere de la spec, gana
  el código y lo señalas en la bitácora como desviación.
- CLAUDE.md no debe crecer más de ~60 líneas netas; si una sección se vuelve
  larga, resúmela y enlaza a docs/.
- No modifiques código, migraciones ni seed. Solo los dos archivos de
  documentación (y README.md únicamente si hace falta enlazar la bitácora).
- No inventes fechas ni commits: todo sale de git.
- No describas sesiones futuras más allá de la lista de pendientes.

[EJEMPLOS] Entrada esperada en la bitácora:
  ### Fase 3.3 — Autenticación (2026-08-2X, commit a1b2c3d)
  **Construido:** migración `…_handle_new_user_metadata.sql`, `auth.service.ts`,
  `useAuth.ts`, `/login`, `/register`, middleware de rutas protegidas.
  **Decisión:** el rol se fija en el trigger de alta leyendo
  `raw_user_meta_data` porque `protect_profile_role` impide cambiarlo después.
  **Problema:** el guard de rol parpadeaba antes de cargar el profile →
  se muestra `LoadingState` mientras `initializing` es true.
  **Fuera de alcance:** confirmación de email (hosted), recuperación de contraseña.
Línea esperada en CLAUDE.md (convención, no narrativa):
  * `numeric` llega como `string` desde PostgREST: el service lo convierte
    con `Number()`; los componentes siempre reciben `number`.

[RAZONAMIENTO] Primero arma la línea de tiempo desde `git log` y la tabla de
archivos desde `ls`; contrasta con los entregables de la spec y marca qué
falta. Solo después redacta. Al terminar CLAUDE.md, léelo completo como si
fueras a empezar la sesión 4 con él y quita lo que no te cambie una decisión.

[FORMATO DE SALIDA] (1) docs/BITACORA.md; (2) diff de CLAUDE.md (solo las
líneas cambiadas); (3) tabla entregables de la spec × estado × evidencia;
(4) lista de pendientes heredados; (5) commit: "docs: add project log and
update CLAUDE.md at close of Sesión 3".
```

---

## Nota sobre la rúbrica

Igual que en la sesión 2, la regla "mínimo 4 ítems" es una heurística de
suficiencia, no una ley. Lo que cambia en esta sesión es el peso del
**Contexto**: como el trabajo se reparte en ocho conversaciones sin memoria
entre sí y el código de una fase depende del de la anterior, cada prompt
ordena leer archivos concretos (la spec, las migraciones que imponen reglas,
y lo que produjeron las fases previas) antes de generar nada. Un prompt de
frontend sin esa lectura previa produce componentes duplicados, hooks que
ignoran la RLS y rutas que colisionan — exactamente los errores que la
validación de la spec encontró. Razonamiento se pide donde hay una secuencia
o un ciclo de vida que conviene explicitar antes de codificar (rutas, auth,
checkout, imágenes, kanban); Ejemplos donde hay una firma o convención que
imitar; Público/tono solo donde se escriben textos que verá el usuario final
(3.5 y 3.6).
