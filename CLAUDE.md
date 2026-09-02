# CLAUDE.md — MercadoTech

Este documento es el contrato entre el equipo y Claude Code. Léelo antes de
generar código en este repositorio.

## Qué es MercadoTech (y qué NO es)

MercadoTech es un marketplace de productos tecnológicos: compradores navegan
un catálogo, ven detalle con galería de imágenes, preguntas y respuestas y
reseñas verificadas, agregan al carrito y hacen checkout; vendedores publican
productos y gestionan pedidos; dos asistentes con RAG (desde la sesión 4;
agente de voz desde la sesión 8) — uno de compras sobre el catálogo, otro de
soporte sobre la FAQ — responden citando sus fuentes; un admin modera y
mantiene la base de conocimiento.

**NO hay pasarela de pago real en ningún momento del proyecto.** El checkout
es simulado: crea el pedido y descuenta stock, sin cobrar.

## Comandos

Convención objetivo (se completa a medida que cada sesión los habilita):

```bash
npm run dev         # servidor de desarrollo (Next.js, Turbopack)
npm run build       # build de producción
npm run lint        # ESLint
npm run type-check  # tsc --noEmit
npm run test        # Vitest (unit): 313 tests, ~3 s, SIN red ni Docker
npm run test:coverage    # lo mismo + reporte en coverage/
npm run test:e2e    # Playwright (E2E) — exige `supabase db reset` antes, y para
                    # los specs del agente TAMBIÉN `npx tsx scripts/index-all.ts`:
                    # el reset siembra la FAQ pero no genera sus embeddings
npm run test:e2e:ui # el mismo runner en modo interactivo
npm run db:types    # regenera types/database.ts desde el esquema local
npm run db:images   # descarga imágenes de muestra y las sube a Storage
npx tsx scripts/index-all.ts   # reindexa productos activos + FAQ publicada en knowledge_embeddings
```

Servidor MCP (sesion 5). Se lanza SIEMPRE desde la raiz: el alias `@/*` resuelve
a `./*` y desde otra carpeta los imports de services fallan. Resto en
`mcp/README.md`.

```bash
npx tsx mcp/src/index.ts                                     # dev, por stdio
npx @modelcontextprotocol/inspector npx tsx mcp/src/index.ts # Inspector
node mcp/scripts/rpc.mjs tools/list                          # cliente JSON-RPC del repo
cd mcp && npm run build && npm run type-check
```

`db:images` existe porque el seed crea las filas de `product_images` pero no
los archivos. Requiere el manifiesto que documenta `scripts/seed-images.mjs`.

`test:e2e` corre SIEMPRE contra el Supabase local y **exige `supabase db reset`
antes de cada corrida completa**: los specs crean pedidos y productos reales.

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
lib/ai/            ÚNICOS archivos que conocen la API del proveedor de IA
                   (embeddings, completion, prompts, constructor de contexto).
lib/voice/         ÚNICOS archivos que conocen la API de voz del navegador/proveedor.
lib/validators/    Validación framework-agnóstica, compartida entre UI y servidor.
lib/constants/     Todos los tunables centralizados y documentados:
                   roles.ts, catalog.ts (page size, orden), orders.ts (flujo de
                   estados, colores), product.ts (límites de título e imágenes),
                   ai.ts (embeddings/chat/contexto), support.ts (estados de ticket).
types/             Tipos de dominio + database.ts generado por Supabase.
app/api/v1/        Route Handlers DELGADOS, solo para lo que no puede correr en el
                   navegador (secretos de IA, service role, cookies de sesión):
                   reindex, search/semantic, chat (sesión 4), support-agent (sesión 8).
scripts/           Utilidades de apoyo fuera del build (seed-images.mjs, index-all.ts).
mcp/               Servidor MCP (sesion 5), proceso Node APARTE de Next y consumidor mas
                   de services/: 10 tools, 7 resources, 5 prompts, todo SOLO LECTURA.
                   src/{tools,resources,prompts}/  un archivo c/u + registro central
                   src/shared/  derivaciones documentadas · src/context.ts  sus clientes
.claude/skills/    Las 4 Skills de gobernanza del proyecto (sesion 5). Ver mas abajo.
```

Reglas de independencia (aplican en todas las sesiones):

1. **Un archivo, una responsabilidad.** `product.service.ts` no sabe de pedidos;
   `order.service.ts` no sabe de embeddings.
2. **Sin barrels.** Se importa el archivo específico, nunca "todo el módulo".
3. **La UI nunca importa `lib/ai/`, `lib/voice/` ni el cliente admin**
   (`lib/supabase/admin.ts`). El navegador llega a la IA solo por esta
   cadena: hook → `fetch` a `app/api/v1/*` → service → `lib/ai/`. El cliente
   admin, además, solo aparece en Route Handlers y en `scripts/`.
   La VOZ tiene su propia cadena, distinta a propósito: componente →
   `hooks/useVoice.ts` → `lib/voice/`, sin pasar por el servidor. La IA se
   aísla tras un Route Handler porque su clave es un secreto; la Web Speech
   API corre forzosamente en el navegador y no hay salto posible, así que su
   única puerta es ese hook. Grep: `grep -rl "lib/voice" components` → vacío.
   Y si un componente necesita el TIPO de un hook, ese tipo se muda a
   `types/` (así llegaron ahí `ChatHistoryEntry` y `VoiceState`).
4. **Un solo camino de datos:** hooks → services → Supabase (RLS). NO se
   construye una capa REST paralela "por si acaso" (lección de ReadHub: quedó
   una API v1 completa que el frontend nunca llamó).
5. **Todo tunable vive en `lib/constants/`** con un comentario que justifica
   su valor.
6. **`mcp/` es un consumidor más de `services/` y `lib/ai/`: jamás reimplementa
   lógica de negocio ni importa de `app/`, `components/` o `hooks/`.** Solo
   puede importar de `services/`, `lib/ai/`, `lib/constants/` y `types/`. Sus
   clientes de Supabase se construyen en `mcp/src/context.ts` y **nunca** desde
   `lib/supabase/admin.ts`: ese archivo trae `import "server-only"`, que lanza
   bajo Node/tsx puro. Si un dato no sale de un service existente, se compone
   en `mcp/src/shared/` y se declara como derivación en el comentario. Y nada
   en `mcp/` escribe en stdout, que transporta JSON-RPC (ver `stdout-guard.ts`).
7. **Las páginas (`app/**/page.tsx` y los layouts) son el ÚNICO punto donde un
   hook se encuentra con un componente.** Si un componente necesita el tipo de
   un hook o de un service, ese tipo se mueve a `types/` o `lib/constants/`.

Estos cuatro greps deben devolver SIEMPRE vacío:

```bash
grep -rlE "^import .*@/lib/supabase" components hooks   # solo services/ y app/ usan clientes
grep -rlE "^import .*from \"@/services" components      # los componentes no llaman services
grep -rlE "^import .*@huggingface" --include="*.ts" . | grep -v node_modules | grep -v lib/ai
grep -rlE "^import .*lib/supabase/admin" app components hooks services | grep -v api/v1
```

Y estos tres, sobre el servidor MCP:

```bash
grep -rE "^import .*lib/supabase/admin" mcp/src      # server-only lanza bajo Node
grep -rn "@/app/\|@/components/\|@/hooks/" mcp/src     # el MCP no toca esas capas
grep -rn "console\.log(" mcp/src                     # stdout transporta JSON-RPC
```

Los cuatro primeros anclan en `^import` a propósito: la versión sin ancla marcaba los
COMENTARIOS que explican por qué un archivo NO importa algo (pasaba en
`embedding.service.ts` y `vector-search.service.ts`), y un gate con falsos
positivos deja de leerse.

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

### Reglas de testing (sesión 6)

* El test unitario vive JUNTO al archivo que prueba; los E2E, en `e2e/`.
* Los tests unitarios **inyectan el cliente Supabase por parámetro** — jamás
  `vi.mock` de `lib/supabase/*`. `lib/ai/*` sí se mockea por módulo (no es
  inyectable por diseño de la sesión 4): única excepción, y se comenta.
* La suite unitaria **no toca la red**: debe pasar con Docker apagado. Un test
  que solo pasa con el stack arriba está mal escrito.
* **El test documenta el contrato REAL, no el deseado.** Si parece un bug, se
  ancla con `// comportamiento actual, revisar:` y va a la bitácora; nunca se
  cambia producción para que un test luzca mejor.
* Los valores frontera salen de las constantes reales importadas. Las
  aserciones de dinero salen de `formatPrice`: Intl separa "S/" del monto con
  un espacio duro (U+00A0), invisible al leer y letal al comparar.
* `data-testid` en kebab-case con prefijo de dominio (`kanban-column-pagado`).
  En un componente es SOLO un atributo: ni lógica, ni estilos, ni estructura.
* Al cerrar una feature el ciclo es **reviewer → correcciones → validator**, y
  el validator ya corre los tests: uno rojo = FALLIDA.

## Integración continua (`.github/workflows/ci.yml`, sesión 6)

Cada push a `main` y cada pull request dispara dos jobs encadenados, sin
ningún secreto: **`checks`** (type-check, lint, `test:coverage`, type-check del
MCP; sube la cobertura como artefacto) y **`e2e`** (`needs: checks`: levanta un
Supabase efímero, lo siembra, lee sus credenciales en caliente y corre
Playwright en chromium contra `build && start`).

`package.json` lleva `"packageManager": "npm@11.6.2"` y el workflow pinea esa
MISMA versión antes de `npm ci`. **No se toca a la ligera:** el lockfile se
generó con ella en Windows, y un npm más nuevo en Linux resuelve distinto las
dependencias opcionales y rompe `npm ci`. Si se regenera el lockfile, hay que
cambiar los dos sitios a la vez. `mcp/` está EXCLUIDO del `tsconfig.json` de la
raíz: tiene su propio type-check, que el CI ejecuta en su carpeta.

## Despliegue y performance (sesión 7)

* **Deploy: PR → preview de Vercel; merge a `main` (con los checks `checks` y
  `e2e` obligatorios) → producción.** Vercel se conecta a GitHub por SU
  interfaz: prohibido instalar la CLI de Vercel, crear tokens de deploy o
  agregar jobs de despliegue al workflow.
* **Los secretos viven SOLO en el dashboard de Vercel**, cargados a mano.
  GitHub Actions no usa ninguno y así debe seguir. Tras cambiar una variable en
  Vercel: **redeploy**, o el cambio no existe (las `NEXT_PUBLIC_*` se incrustan
  en tiempo de build). Nunca se pegan valores de claves en el chat ni en el
  repositorio.
* **El esquema del remoto solo se toca con `supabase db push`** (migraciones del
  repo) y el SQL Editor para `supabase/seed.prod.sql`. Jamás cambios a mano.
  `seed.sql` es de laboratorio y **jamás** se ejecuta contra producción.
* **Performance: medir → cambiar → medir**, siempre contra build de producción,
  nunca sobre `next dev`. Ningún cambio entra sin su número de antes y después
  en [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md); lo que no mueve la aguja se
  revierte y queda anotado. Antes de medir, leer su §2: tres formas de obtener
  números falsos, ya pagadas, y la varianza de 21 puntos que obliga a reportar
  la mediana de 3 corridas.
* **Deuda técnica medida:** el catálogo se pide desde el cliente y esos ~3.9 s
  de "Load Delay" son el techo del LCP. Servirlo desde Server Components es la
  mejora principal pendiente, y cambia la regla `hooks → services`: es una
  decisión de diseño, no un ajuste.

## Agente de soporte y voz (sesión 8)

* **El agente NO sabe que existe la voz.** `services/support-agent.service.ts`
  recibe texto y devuelve texto; que el turno venga dictado solo se anota en
  `channel` al abrir un ticket. Esa frase va en su cabecera y no es adorno: es
  lo que permite que el mismo orquestador sirva mañana para WhatsApp, y que los
  E2E de texto cubran el mismo camino que recorrería la voz.
* **Consultar es directo; escribir se pregunta.** Leer un pedido no compromete
  a nadie. Crear un reclamo o escalar a un humano exige que el agente PROPONGA
  y el usuario confirme en el turno siguiente. La confirmación viaja al cliente
  y vuelve (`pending`): el servidor sigue sin estado.
* **Las herramientas del agente son services existentes.** Jamás toca Supabase
  directamente, y siempre con el cliente de SESIÓN — nunca el admin. Si
  devolviera el pedido de otra persona sería un bug crítico, no un matiz.
* **Los pedidos se resuelven por contexto, nunca pidiendo un id.** Son UUID y
  nadie los dicta. Ante ambigüedad se enumera con fecha, producto y estado.
* **Las respuestas se leen en voz alta**: máximo dos frases y una pregunta, sin
  listas ni markdown ni códigos largos (`AGENT_MAX_REPLY_CHARS`).
* **La voz no se automatiza en el CI** y no es una omisión: no hay micrófono en
  un runner y `SpeechRecognition` no existe en un navegador headless. Simularla
  verificaría nuestro propio simulador. Se comprueba a mano con la checklist de
  [`docs/DEMO.md`](docs/DEMO.md).

## Skills de gobernanza (`.claude/skills/`, sesión 5)

Cuatro manuales de puesto que Claude Code carga solo, según lo que se le pida.
**Las cuatro REPORTAN: ninguna edita código.** Corregir es siempre un paso
aparte y humano-supervisado.

| Skill | Se activa | Devuelve |
|---|---|---|
| `mercadotech-architecture-enforcer` | ANTES de crear/mover un archivo | PERMITIDO / RECHAZADO + ubicación correcta |
| `mercadotech-code-reviewer` | al revisar código ya escrito | informe /10 por severidad |
| `mercadotech-automatic-validator` | al cerrar una tarea o fase | APROBADA / FALLIDA, sin matices |
| `mercadotech-tech-lead` | ante decisiones de diseño o deuda | scorecard ponderado |

Fuente de verdad de las cuatro: este archivo — **ante contradicción, gana
`CLAUDE.md`**. Se descubren al arrancar; si una no se activa, reiniciar.

## Fuente de verdad de la base de datos

Desde la sesión 2, `supabase/migrations/` es la ÚNICA fuente de verdad del
esquema. `supabase/schema.sql` y `supabase/policies.sql` son copias de
referencia legibles, generadas a partir de las migraciones — nunca al revés.
La arquitectura completa (capas, modelo relacional, decisiones de diseño,
políticas RLS en lenguaje de negocio) está documentada en
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Mapa de rutas

Tienda `(shop)`: `/`, `/buscar`, `/categoria/[slug]`, `/producto/[id]`,
`/favoritos`, `/carrito`, `/pedidos`, `/pedidos/[id]`, `/asistente`,
`/soporte`, `/soporte/tickets/[id]` (sesión 8).
Fuera de los grupos: `app/dev/voz` — banco de pruebas de la capa de voz. **No
exige sesión y está publicada**; se conservó a propósito (desviación de la
spec de la 8.4), anotada en el roadmap.
Vendedor `(seller)`, SIEMPRE bajo el prefijo `/vendedor/` para no colisionar
con `/pedidos` del comprador: `/vendedor/productos`, `/vendedor/publicar`,
`/vendedor/productos/[id]/editar`, `/vendedor/pedidos`.
Auth `(auth)`: `/login`, `/register`.

Requieren sesión (lo impone `lib/supabase/middleware.ts`): `/carrito`,
`/pedidos`, `/favoritos`, `/vendedor`, `/asistente`, `/soporte` (sesión 4: la
IA exige sesión, protege la cuota gratuita de Hugging Face). El detalle de
producto es PÚBLICO; la pestaña "Resultados con IA" de `/buscar` pide sesión
por dentro de la página, no por el middleware (la búsqueda exacta es pública).

## Estado del proyecto

* Sesión 1: no ejecutada (sin `docs/COSTOS.md` ni `docs/PROMPTS.md`).
* Sesión 2: completa, incluidas 2.6 y 2.7.
* Sesión 3: completa (Fases 3.1–3.8). MVP funcional.
* Sesión 4: completa (Fases 4.1–4.8). Búsqueda semántica + asistentes de
  compras/soporte con RAG sobre Hugging Face.
* Sesión 5: completa (Fases 5.1–5.6). 4 Skills de gobernanza + servidor MCP de
  solo lectura (10 tools, 7 resources, 5 prompts).
* Sesión 6: completa (Fases 6.1–6.8). 293 tests unitarios y CI en GitHub
  Actions. Absorbió el pipeline que el plan maestro tenía como Fase 7.1.
* Sesión 7: completa en lo automatizable (Fases 7.2–7.5). Kanban accesible por
  teclado y sus 2 E2E fuera de `fixme` (**13/13**, no 14: el test que
  documentaba el defecto se borró al corregirlo); `docs/PERFORMANCE.md`,
  `docs/DEPLOY.md`, `supabase/seed.prod.sql`, README de producto y
  `docs/ARQUITECTURA.md` al día.
  **PENDIENTE de ejecución humana:** el go-live en sí (crear el proyecto
  Supabase de producción, `db push`, conectar Vercel, branch protection y smoke
  test). Todo está escrito paso a paso en `docs/DEPLOY.md` §2, y la rama
  `deploy-smoke` espera sin publicar. **No hay URL de producción todavía.**
* Sesión 8: completa (Fases 8.0–8.5). **Go-live EJECUTADO:
  https://mercadotech.vercel.app**, con branch protection activa y smoke test
  pasado. Agente de soporte con voz: `lib/voice/` + `useVoice`, orquestador con
  5 intenciones que reutiliza los services existentes, y `/soporte` con
  micrófono. 313 tests unitarios y 17 E2E. `docs/DEMO.md` y `docs/ROADMAP.md`
  cierran el curso.
  Desviación anotada: `app/dev/voz/` se conservó (la spec pedía borrarla en la
  8.4) y queda accesible SIN sesión en producción.
* El curso está COMPLETO. Lo siguiente sale de
  [`docs/ROADMAP.md`](docs/ROADMAP.md), que abre con la deuda medida del
  catálogo servido desde el cliente.

Mapa de carpetas: [`docs/ESTRUCTURA.md`](docs/ESTRUCTURA.md).
Detalle de decisiones y problemas: [`docs/BITACORA.md`](docs/BITACORA.md).
Checklist de calidad: [`docs/SESION3_CHECKLIST.md`](docs/SESION3_CHECKLIST.md).
Flujo RAG, casos de prueba y calibración: [`docs/RAG.md`](docs/RAG.md).
Ciclo de revisión de la sesión 5: [`docs/REVISION_S5.md`](docs/REVISION_S5.md).
Metodología de depuración y errores típicos: [`docs/DEBUGGING.md`](docs/DEBUGGING.md).
Variables, go-live, smoke test y rollback: [`docs/DEPLOY.md`](docs/DEPLOY.md).
Mediciones de performance y su metodología: [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md).
Puerta de entrada para alguien nuevo: [`README.md`](README.md) (el plan del
curso se conserva en [`docs/PLAN_CURSO.md`](docs/PLAN_CURSO.md)).
Servidor MCP (arquitectura, decisiones y síntomas): [`mcp/README.md`](mcp/README.md).
Guion de la demo final (10 min, con plan B): [`docs/DEMO.md`](docs/DEMO.md).
Qué vendría después y con cuánto esfuerzo: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Regla de sesiones

Cada sesión tiene su especificación completa en `MercadoTech_sesionN.md`. No
se adelanta trabajo de fases o sesiones futuras, incluso si parece trivial
hacerlo ahora.
