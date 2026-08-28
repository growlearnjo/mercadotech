# Bitácora de MercadoTech

Registro acumulativo del proyecto, la sesión más reciente primero. Cada
entrada dice qué se construyó, qué se decidió y por qué, con qué se tropezó y
qué se dejó fuera a propósito.

---

# Sesión 5 — Custom Skills y protocolo MCP (2026-08-28)

MercadoTech no gana ninguna pantalla en esta sesión. Gana **dos cosas para las
máquinas que trabajan con la tienda**: cuatro Skills que hacen cumplir la
arquitectura del proyecto dentro de Claude Code, y un servidor MCP que expone
la plataforma en solo lectura a cualquier cliente del protocolo, reutilizando
los services de las sesiones 3 y 4 sin duplicar una línea de negocio.

**Volumen:** `git diff --stat 3e8e9b5..HEAD` → 47 archivos, +6 239 / −119.

## Prompt 0 — Verificación y dependencias (commits `601dfba`, `5b0f794`)

Repo verde de partida: `lint`, `type-check` y `build` en exit 0, stack local
arriba y `knowledge_embeddings` con sus 24 fichas. `mcp/` nace con su propio
`package.json` y las versiones **pineadas** que exige la lección 4 de la spec:
`@modelcontextprotocol/sdk ^1.29.0` (resolvió a 1.30.0), `zod ^3.25.76` y
`tsup ^8.5.1` — el SDK 1.x no es compatible con zod 4.

Desviación menor del estado de partida: `.claude/skills/` **ya existía** con
skills personales del usuario (no del proyecto). Las cuatro de gobernanza se
agregaron junto a ellas; solo las del proyecto se commitearon.

Hallazgo del Inspector: además de la UI web, tiene modo `--cli`. Toda la
verificación de la sesión quedó así reproducible en comandos, no en capturas.

## Fase 5.1 — Skills de gobernanza (commit `c0441dc`)

Cuatro `SKILL.md` en `.claude/skills/`, commiteados desde el primer día
(lección 1: en ReadHub quedaron sin versionar y se perdieron del historial).
El riesgo real de esta fase era que se pisaran entre sí, así que cada una se
escribió contra el deslinde de las otras tres:

| Skill | Cuándo actúa | Salida | Qué NO hace |
|---|---|---|---|
| `mercadotech-architecture-enforcer` | ANTES de crear o mover un archivo | PERMITIDO / RECHAZADO + ubicación correcta | no juzga estilo ni naming |
| `mercadotech-code-reviewer` | DESPUÉS de escribir | informe /10 por severidad | no bloquea, no corre lint |
| `mercadotech-automatic-validator` | al cerrar una fase | APROBADA / FALLIDA | no explica, no pondera |
| `mercadotech-tech-lead` | ante decisiones de diseño | scorecard ponderado | no es binario, no va archivo por archivo |

Las cuatro dicen explícitamente que **reportan, no editan código**, y las
cuatro cierran con "ante contradicción, gana `CLAUDE.md`". Cada regla es
verificable con un grep o una lectura, nunca un principio abstracto.

**Decisión 9 de la spec, refutada en la práctica:** la spec daba por hecho que
hacía falta reiniciar la sesión para que Claude Code descubriera las Skills.
En esta ejecución el harness las detectó **en caliente**, una a una, según se
iban escribiendo, y el laboratorio de la 5.6 pudo correrse en la misma
conversación. Queda anotado como comportamiento observado, no como garantía:
si una Skill no se activa al nombrarla, reiniciar sigue siendo el remedio.

## Fase 5.2 — Scaffolding del servidor (commit `a67b829`)

El mostrador vacío pero conectando. Toda la fontanería delicada resuelta de
una vez, con `src/lib/{tool-result,errors,safe}.ts` y `src/context.ts`.

**Desviación deliberada de la spec, y es importante.** La spec pedía la
redirección de `console.log` *literalmente en la línea 1 de `index.ts`*. Eso
**no funciona en ESM**: los `import` se hoistean y se evalúan antes que
cualquier sentencia del cuerpo del módulo, así que una dependencia que loguee
al importarse ya habría corrompido stdout. Se resolvió con
`src/lib/stdout-guard.ts` importado como **primer módulo** — los imports sí se
evalúan en orden. Cumple la intención de la lección 3; el porqué quedó escrito
en el propio archivo.

Se reutilizó tal cual el patrón de `scripts/index-all.ts` para el entorno
(`loadEnvLocal` sobre la `.env.local` de la RAÍZ, una sola fuente de secretos)
y para el cliente admin propio: `lib/supabase/admin.ts` trae
`import "server-only"`, que lanza bajo Node/tsx puro.

Se agregó `mcp/scripts/rpc.mjs`, un cliente JSON-RPC mínimo que hace el
handshake y ejecuta métodos en orden. **Aborta si detecta que algo ensució
stdout**, así que la pureza del canal se verifica sola en cada corrida.

## Fase 5.3 — Diez tools (commits `70fb01a`, `b5bd3a4`)

Un archivo por tool, registro central en `tools/index.ts`, inputs con zod,
salidas por `tool-result` y todo envuelto en `safe.ts`. Cinco corren con
`anon` y cinco necesitan `admin`, cada una con el comentario de la política
RLS que lo obliga escrito al lado.

Las derivaciones viven en `mcp/src/shared/` y están declaradas como tales
(lección 6): `stats.ts` (categorías con conteo, agregados, top de vendidos),
`product-detail.ts` (la forma única de "detalle", compartida por la tool, el
resource y un prompt) y `faq.ts`. **Cero services nuevos en el proyecto web.**

### El problema real de la sesión: `service_role` no es acceso total

Al ejercitar las tools, cuatro fallaron con `42501 permission denied`. La
causa no estaba en el MCP sino en un supuesto equivocado del esquema:

> **Bypasear RLS no es lo mismo que tener privilegios de tabla.** `service_role`
> ignora las políticas, pero Postgres sigue exigiendo el `GRANT`.

Hasta la sesión 4 el único consumidor era la web, que corre como
`authenticated` — el rol al que el esquema sí le había dado todo. El servidor
MCP es el **primer consumidor del proyecto que corre como `service_role`**, y
por eso nadie lo había visto. `supabase/policies.sql` solo le concedía cuatro
tablas.

Arreglarlo exigía una migración, y la sesión 5 tenía prohibido tocar la base
de datos. Se planteó la disyuntiva y **se aprobó explícitamente la desviación**
antes de aplicarla: la migración
`20260828200750_grant_service_role_mcp_reads.sql` concede **solo SELECT** sobre
`orders`, `order_items`, `product_images`, `reviews` y `profiles`, más EXECUTE
sobre `match_knowledge`. Nada de escritura: el servidor es de solo lectura.
`product_images` y `reviews` ya eran públicas para anon, así que ahí solo se
alineó `service_role` con lo que cualquier visitante ya podía leer; `profiles`
no es pública y se concede exclusivamente para el resource de vendedores, que
proyecta `display_name` y nada más.

Efecto colateral del `db reset`: se vacían `knowledge_embeddings` y los
archivos de Storage. Hubo que volver a correr `npx tsx scripts/index-all.ts` y
`npm run db:images`.

### Otras desviaciones, por el esquema real

La spec asumía columnas que **no existen**: `products.model`, `products.specs`
y `reviews.title`. Las tools se ajustaron a los campos reales (la ficha técnica
vive dentro de `description`), con el porqué comentado en el código.

## Fase 5.4 — Siete resources y cinco Prompts MCP (commit `832283c`)

Los dos templates (`products/{id}`, `sellers/{sellerId}`) implementan el
callback `list`, así que sus instancias reales aparecen en `resources/list`:
12 productos y 2 vendedores además de los 5 estáticos.

La prueba que más valía la pena: **con `supabase stop`, `resources/list` sigue
respondiendo**. `info` entrega su contenido completo (es estático a propósito,
justamente para eso) y cada resource caído devuelve su error capturado en
lugar de tumbar el listado entero (lección 7).

Los cinco prompts son **formularios, no motores**: obtienen el contenido por
las mismas funciones compartidas de la 5.3 y remiten a las tools existentes
para profundizar. Ninguno reimplementa recuperación ni el pipeline RAG. La
terminología se cuidó en código y documentación (lección 2): son "Prompts
MCP", nunca "Skills".

## Fase 5.5 — Registro y documentación (commit `791c4a7`)

`.mcp.json` en la raíz y `mcp/README.md` completo: arquitectura, las 10
decisiones con su porqué, las tablas de tools/resources/prompts con su service
reutilizado y su cliente, y la tabla de síntomas.

El build de producción se validó de verdad: `node mcp/dist/index.js` responde
idéntico al fuente (`rpc.mjs` acepta `MCP_TARGET=dist` para ejercitarlo).

**Verificación con el Inspector, con una salvedad honesta:** el Inspector se
usó en modo `--cli`, no con su interfaz web. Toda la evidencia de esta sesión
salió de JSON-RPC sobre stdio — misma superficie que ejercita la UI, y con la
ventaja de quedar reproducible en un comando.

## Fase 5.6 — Laboratorio de validación (commits `965a5b0`, `648bed0`, `804ba88`, `31fb253`)

Las Skills auditando el código real. Detalle completo en
[`docs/REVISION_S5.md`](REVISION_S5.md).

**11 hallazgos: 5 corregidos, 5 aceptados como deuda con su justificación, 1
falso positivo refutado.** Los tres corregidos en esta fase, de menor a mayor
riesgo:

1. **ESLint analizaba `mcp/dist/`**, el bundle de tsup: 59 errores de código
   generado. La primera pasada del validator dio **FALLIDA** por esto, se
   corrigió y se re-invocó — el ciclo funcionando como debe.
2. **Los cuatro greps de arquitectura de `CLAUDE.md` daban falsos positivos**:
   matcheaban los *comentarios* que explican por qué un archivo NO importa
   algo. Anclados a `^import`. Un gate con falsos positivos deja de leerse.
3. **Los tres Route Handlers perdían el diagnóstico de todo error de
   Supabase.** `err instanceof Error` es **false** para un PostgrestError
   (objeto plano `{message, code, details, hint}`) y los services lo relanzan
   tal cual: cualquier fallo de base de datos llegaba al usuario como "Error
   desconocido…". El servidor MCP se golpeó con lo mismo primero; la revisión
   lo encontró arrastrado desde la sesión 4. Ahora `lib/api-response.ts` expone
   `errorMessage()` y conserva hasta la sugerencia literal de Postgres.

Scorecard del tech-lead: **8.45/10**. Code review: **8.5/10**.

Vale la pena dejarlo escrito: **la arquitectura pasó su prueba de fuego sin
saberlo.** Un consumidor completamente nuevo, fuera de Next, se conectó a los
15 services sin reescribir una línea de negocio. Eso solo funciona porque la
sesión 3 decidió que el cliente Supabase fuera inyectable y siempre el último
parámetro.

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| El Inspector lista y ejecuta las 10 tools sin errores con datos del seed | ✅ | Modo `--cli` + `rpc.mjs`. `search_products {"search":"laptop"}` → 3 productos; `compare_products` con las 2 laptops → rango S/1899–2199; `get_order_status c0000000-…01` → entregado con 2 ítems snapshot |
| `ask_assistant` con la misma calidad que la UI web | ✅ | `{"query":"¿cómo devuelvo un producto?","mode":"soporte"}` → cita `[1]`, el artículo de devoluciones, con los 7 días calendario correctos |
| Con Supabase detenido, `resources/list` sigue respondiendo | ✅ | `info` completo; `faq` con su error capturado; el listado nunca se cae |
| Ninguna tool/resource expone teléfono, email ni nombre de comprador | ✅ | Revisión manual de salidas + ítem B1 del validator. Salidas proyectadas campo por campo, nunca la fila completa |
| El validator termina en APROBADA sobre el estado final | ✅ | `docs/REVISION_S5.md`, sección final |
| `type-check` de la raíz Y de `mcp/`; el build de `mcp/` arranca | ✅ | Ambos exit 0; `node mcp/dist/index.js` conecta y responde |
| Búsqueda semántica de la misma calidad que la pestaña IA | ✅ | "audífonos para el gimnasio" → Logitech G435 primero (0.4211) |

## Deuda técnica y limitaciones conocidas

1. **`get_order_status` no exige autenticación.** Cualquiera con el id del
   pedido lo consulta. Aceptable porque el servidor corre local contra el seed
   del curso; **en producción no bastaría**. Está advertido en el código y en
   el README. La sesión 8 lo reutiliza para el agente de voz.
2. **`mercadotech://faq` es una derivación, no un service.** No existe un
   "listar FAQ publicada" en la web. Si nace una pantalla de FAQ, ese archivo
   debe pasar a llamar al service nuevo.
3. **`tool.handler as never`** en el registro central: único punto del servidor
   donde se apaga el compilador. Los tipos reales los garantiza cada archivo.
4. **`listAllActiveProducts` pagina en cliente** para calcular agregados.
   Trivial con 16 productos; a escala pide una vista SQL.
5. **Vulnerabilidad low en `esbuild`** (transitiva de `tsup`). `npm audit fix`
   movería la versión que la spec obliga a pinear.
6. **`useProductForm.ts` con 302 líneas** orquestando 4 services. Refactor
   propuesto para después de que existan tests.
7. **Heredada, y ahora la que más pesa:** sin tests automatizados. Esta sesión
   agregó ~1.500 líneas en `mcp/` verificadas solo a mano.

## Qué quedó fuera, a propósito

* **Monorepo** (npm workspaces + Turborepo, como ReadHub). La nota de la spec
  lo deja opcional: `mcp/` importando por alias es suficiente para el
  laboratorio, y el tech-lead no vio razón para pagar la complejidad hoy.
* **Tools de escritura.** El servidor es de solo lectura, sin excepciones.
* **Agente de voz** (sesión 8) y **tests automatizados** (sesión 6).
* **Vista `public_profiles`.** Resolvería la deuda de `profiles` para web y MCP
  a la vez, pero pertenece a la sesión 7.

## Pendientes

**Heredado de la sesión 1 (no ejecutada):** siguen sin existir
`docs/COSTOS.md` ni `docs/PROMPTS.md`. No bloquea nada.

**Para la sesión 6 (testing):** Vitest y Playwright. Prioridades que deja esta
sesión: cubrir `mcp/src/shared/` (las derivaciones son el código más frágil del
servidor, porque componen a mano), el nuevo `errorMessage()` de
`lib/api-response.ts`, y `useProductForm` antes de refactorizarlo.

---

# Sesión 4 — RAG con Hugging Face (2026-08-26)

MercadoTech gana búsqueda semántica y dos asistentes conversacionales
(compras y soporte) sobre la infraestructura de las sesiones 2-3: pgvector,
una tabla nueva de embeddings, indexación automática, y los primeros Route
Handlers del proyecto (`app/api/v1/`, vacíos a propósito desde la sesión 2).

**Volumen:** `git diff --shortstat ae43c50..HEAD` → 52 archivos,
+3 302 / −14.

## Prompt 0 — Verificación y provisión de IA (commit `9f5a394`)

**Construido:** verificación de la sesión 3 (todos los prerrequisitos ✅),
stack local reconstruido, `HUGGINGFACEHUB_API_TOKEN` en `.env.local`
(nunca commiteado; ver decisión abajo), `.env.example` con las 3 variables
de IA sin valores, `@huggingface/inference` y `tsx` instalados, smoke test
real contra la API (embedding de 384, completion coherente).

**Decisión — el token se reutilizó del proyecto ReadHub del mismo alumno**,
por instrucción explícita del usuario, en vez de generar uno nuevo (tarea
que la spec reserva al humano). Se copió únicamente la variable de Hugging
Face; las credenciales de Supabase del `.env.local` de MercadoTech
quedaron intactas (son de su propio stack local, no las de ReadHub).

**Problema — Docker Desktop no estaba corriendo.** Mismo síntoma que en la
sesión 3: se resolvió arrancándolo y con `supabase start`.

## Fase 4.1 — Infraestructura vectorial (commit `876a5a1`)

**Construido:** 4 migraciones nuevas — `enable_pgvector`,
`create_knowledge_embeddings` (tabla + índice HNSW `vector_cosine_ops`),
`create_match_knowledge` (RPC), `knowledge_embeddings_rls` — más
`schema.sql`/`policies.sql` actualizados y `types/database.ts` regenerado.

**Decisión — una tabla discriminada por `source_type`, no dos gemelas.**
Permite un solo RPC y una sola búsqueda para ambas fuentes (productos y
FAQ); el precio es que `source_id` no lleva FK dura (apunta a dos tablas
distintas), documentado en la propia migración: al borrar la fuente, la
ficha queda huérfana hasta que algo la limpie (Fase 4.3).

**Decisión — `match_knowledge` es `SECURITY INVOKER`, no `DEFINER`** (a
diferencia de `create_order_from_cart`, sesión 2). `create_order_from_cart`
necesita saltarse RLS porque `authenticated` no tiene INSERT directo en
`orders`; `match_knowledge` solo LEE `knowledge_embeddings`, y la política
de esa tabla (SELECT solo `authenticated`, decisión 1 de la spec: la IA
exige sesión) es exactamente el control de acceso que se quiere aplicar —
no hay nada que saltarse.

## Fase 4.2 — Capa de IA y servicio de embeddings (commit `505e66a`)

**Construido:** `lib/constants/ai.ts` (13 tunables comentados),
`lib/ai/embeddings.ts`, `lib/ai/completion.ts`, `lib/ai/prompts.ts`,
`services/embedding.service.ts`.

**Decisión — el modelo de chat se lee de `HUGGINGFACE_CHAT_MODEL`, con
`HUGGINGFACE_CHAT_MODEL_DEFAULT` como fallback en código.** Ambos
verificados contra la API real en el Prompt 0. Mismo patrón para el modelo
de embeddings.

**Decisión — embeddings vía SDK, chat vía `fetch`.** Hugging Face no
expone `feature-extraction` en su router OpenAI-compatible (documentado);
el router de chat sí es estable para `fetch` directo. Es el único archivo
del proyecto que usa un SDK en vez de `fetch`, justificado por el propio
proveedor, no por preferencia.

## Fase 4.3 — Indexación automática (commit `042bc32`)

**Construido:** `lib/api-response.ts`, `app/api/v1/reindex/route.ts`
(primer Route Handler del proyecto), `services/indexing-trigger.service.ts`
(fire-and-forget), `scripts/index-all.ts`, y `useProductForm`/
`useSellerProducts` ampliados para disparar el trigger tras crear, editar,
activar/ocultar o eliminar un producto.

**Problema — `service_role` no tenía GRANT sobre `products`,
`support_articles`, `categories` ni `knowledge_embeddings`.** Este proyecto
nunca otorga privilegios por default (sin `ALTER DEFAULT PRIVILEGES`); cada
rol recibe exactamente lo que sus políticas necesitan, tabla por tabla
(convención de la sesión 2). Hasta esta sesión ningún código usaba el
cliente admin contra tablas de dominio, así que el hueco nunca se
manifestó — apareció como `permission denied for table products` (42501)
al correr `index-all.ts`. Se agregó una migración nueva
(`grant_service_role_knowledge_access`) con los GRANTs exactos que faltaban.
Misma lección de la sesión 2: RLS/GRANT sin GRANT explícito = error opaco,
esta vez para el rol que bypasea RLS.

**Evidencia:** `npx tsx scripts/index-all.ts` → 14 productos + 10 artículos
= 24 fichas. Publicar un producto de prueba como `seller1` → fila 25;
editar su título → sigue en 25 (upsert, `content` actualizado); publicar
con el token renombrado → la publicación funciona igual, con
`console.warn` en la consola del navegador (best-effort real, no solo en
el papel); eliminar el producto → su ficha huérfana se limpia sola.

## Fase 4.4 — Búsqueda semántica en el catálogo (commit `6308949`)

**Construido:** `services/vector-search.service.ts`,
`app/api/v1/search/semantic/route.ts`, `hooks/useSemanticSearch.ts`,
pestaña "Resultados con IA" en `/buscar` (reutiliza `ProductGrid`/
`ProductCard` con un prop opcional `similarity` para el badge — sin
duplicar el card), y `getProductsByIds` nuevo en `product.service.ts` para
hidratar los resultados contra el catálogo ACTUAL.

**Evidencia (con sesión):** "audífonos para el gimnasio" → pestaña exacta
0 productos, pestaña IA lista Audífonos Logitech G435 primero (42% match).
"algo para conectar mi casa a internet" → aparece el router TP-Link.
Anónimo → pestaña IA muestra el aviso de login con
`redirectTo=%2Fbuscar%3Fq%3D...`; pestaña exacta sigue funcionando igual.
"autos usados" → `EmptyState` con sugerencia de reformular.

## Fase 4.5 — Constructor de contexto (commit `1132637`)

**Construido:** `lib/ai/context-builder.ts`, función pura (selección por
similitud/largo mínimo + presupuesto de caracteres con truncado-o-descarte).

**Evidencia:** demostración en frío con 8 fuentes sintéticas (sin red):
descarta correctamente las 2 bajo threshold y la de contenido mínimo,
trunca la fuente "gigante" para llenar exactamente el presupuesto, y un
caso adicional confirma el descarte completo (no un truncado a medias)
cuando el remanente es menor que `MIN_TRUNCATED_SOURCE_CHARS`. `grep`
confirma cero imports de `fetch`/Supabase/React.

## Fase 4.6 — Servicio conversacional y endpoint (commit `2fa6bfa`)

**Construido:** `types/chat.ts`, `services/chat.service.ts` (orquesta
búsqueda → contexto → completion, sin reimplementar ninguna), y
`app/api/v1/chat/route.ts` con el log estructurado por consulta.

**Decisión — `ChatSource` se enriquece con precio/imagen ACTUALES del
producto** (vía `getProductsByIds`, la misma hidratación de 4.4) para que
la mini-card de fuentes de la Fase 4.7 tenga algo que mostrar — el título
citado en la respuesta viene congelado del momento de la indexación, pero
precio e imagen no tiene sentido que lo estén.

**Evidencia:** 3 `curl` con cookie de sesión real — compras cita 5 fuentes
con respuesta coherente; soporte cita el artículo de devoluciones exacto;
"¿venden autos usados?" ya mostraba la primera señal del problema de
calibración que se resolvió en la 4.8. 401 sin cookie, 422 con `mode`
inválido, logs estructurados con el formato exacto de la spec.

## Fase 4.7 — Interfaz del asistente (commit `5ffdc2c`)

**Construido:** `hooks/useChat.ts`, `services/ticket.service.ts`
(`listMine`) + `hooks/useMyTickets.ts`, `components/chat/*` (puros: solo
props, sin conocer el endpoint ni `lib/ai/`), `TicketStatusBadge`, páginas
`/asistente` y `/soporte` (+ "Mis tickets"), `UserMenu`/`MobileNav` y el
middleware ampliados con los dos prefijos nuevos.

**Evidencia:** flujo completo en el navegador — "laptop liviana para la
universidad" en `/asistente` cita 2 productos reales, clic en una fuente
abre el producto correcto; "¿cómo devuelvo un producto?" en `/soporte` cita
el artículo correcto; "¿venden autos usados?" en modo soporte sugiere crear
un ticket; `buyer1` y `buyer3` ven cada uno sus propios tickets del seed;
anónimo en `/asistente` → `/login?redirectTo=%2Fasistente`; servidor sin
token → mensaje de error inline ("No pude procesar tu consulta, intenta de
nuevo"), resto de la app sin afectar. `npm run build` de producción pasa.

## Fase 4.8 — Calibración, observabilidad y casos de prueba (commit `d960477`)

**Construido:** `docs/RAG.md` con los 6 casos ejecutados y su evidencia, la
tabla de calibración, y la tabla de síntomas ampliada.

**Decisión — threshold 0.3 → 0.38, con datos reales.** Con 0.3, las 10
consultas de calibración (los 6 casos + 2 legítimas + 2 absurdas)
recuperaban ficha "relevante" sin excepción — el piso de ruido del modelo
de embeddings en español ronda 0.3-0.35, no 0.1-0.2 como asumía el
comentario original. 0.38 corta las consultas absurdas de tipo `producto`
sin romper el caso canónico "audífonos para el gimnasio" (su mejor match,
0.421, sigue arriba). **Limitación documentada, no resuelta:** el modo
`soporte` sigue dejando pasar ruido (los artículos de FAQ comparten
vocabulario y su similitud de base es más alta) — subir lo suficiente para
filtrarlo rompería el caso canónico de `producto`. Mitigado en la práctica
porque `SUPPORT_SYSTEM_INSTRUCTIONS` ya le pide al modelo admitir cuando el
contexto no sirve, y lo cumple.

**Problema — cuota mensual de Hugging Face agotada a mitad de la
calibración** (HTTP 402 del proveedor de *chat*, cuota separada de la de
embeddings). No es una falla del código: `lib/ai/completion.ts` ya lo
reporta con un mensaje accionable. La calibración de similitud se completó
igual consultando `match_knowledge` directamente (solo embeddings, cuota
intacta) en vez de `/api/v1/chat` — no afecta la validez de los datos, es
justo la pieza que el threshold gobierna.

---

## Criterios de aceptación de la sesión

| Criterio | Estado | Evidencia |
|---|---|---|
| Los 6 casos de prueba pasan y quedan documentados | ✅ | `docs/RAG.md` |
| Sin token, el resto de la app funciona y el chat/búsqueda IA fallan con error controlado | ✅ | Fase 4.7: mensaje inline, resto de la app intacto |
| Anónimo: catálogo y búsqueda exacta intactos; IA pide sesión | ✅ | Fases 4.4 y 4.7 |
| `grep "@huggingface"` fuera de `lib/ai/` → vacío | ✅ | verificado en 4.2 |
| `grep "lib/supabase/admin"` fuera de Route Handlers/`scripts/` → vacío | ✅ | verificado en 4.3 |
| `lint` / `type-check` / `build` | ✅ | los tres exit 0, build de producción completo |

## Deuda técnica y limitaciones conocidas

1. **Threshold único para ambas fuentes.** `producto` y `articulo_soporte`
   tienen distribuciones de similitud distintas (la FAQ comparte más
   vocabulario); un solo `VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD`
   global no puede optimizar ambas a la vez. Ver `docs/RAG.md`,
   "Calibración".
2. **`source_id` sin FK dura** en `knowledge_embeddings` (decisión de
   diseño, no un olvido) — fichas huérfanas posibles, limpiadas por el
   trigger best-effort y descartadas al hidratar, nunca por integridad
   referencial de Postgres.
3. **Sin streaming.** El chat espera la respuesta completa; no está en el
   alcance de la sesión.
4. **Crear tickets desde el chat no existe todavía.** `ticket.service.ts`
   solo lista (`listMine`); llega con el agente de la sesión 8.
5. **Historial de chat solo en memoria.** No persiste entre recargas ni
   entre pestañas (decisión de alcance de la spec).
6. **Heredada de la sesión 3:** sin tests automatizados de frontend
   (Vitest/Playwright llegan en la sesión 6).

## Pendientes

**Heredado de la sesión 1 (no ejecutada):** siguen sin existir
`docs/COSTOS.md` ni `docs/PROMPTS.md`. No bloquea nada.

**Sesión 2 (Fases 2.6/2.7):** ya estaban completas desde la sesión 3
(commits `feccd12` y `fb419eb`) — no quedaba nada pendiente ahí.

**Para la sesión 5:** ver `MercadoTech_sesion5.md`. Esta bitácora no
adelanta su contenido.

---

# Sesión 3 — UI Inteligente y Frontend Multimodal (2026-08-24)

MVP funcional completo del marketplace sobre la infraestructura de la sesión 2:
14 rutas, autenticación con roles, catálogo con filtros, ficha de producto con
Q&A y reseñas, carrito con checkout simulado y panel del vendedor con dos
interacciones drag & drop.

**Volumen:** `git diff --stat fb419eb..HEAD` → 131 archivos, +13 739 / −475.

## Prompt 0 — Provisión del entorno (commit `5b9f08d`)

**Construido:** stack Supabase local operativo, `.env.local` verificado contra
`supabase status -o env`, 16 componentes shadcn, `lucide-react` + `@dnd-kit/*`,
script `db:types`.

**Problema 1:** Docker Desktop no estaba corriendo y, al arrancarlo, el stack
quedó a medias (9 servicios sanos, `edge_runtime` en `Exited (255)`). Se
resolvió con `supabase stop` → `supabase start`, que es la limpieza que la
propia spec anticipaba.

**Problema 2:** `shadcn add` terminó en ✔ pero **no instaló los peers** del
estilo `base-nova`: dejó un `node_modules/@base-ui` vacío y `type-check`
fallaba con 14 errores `TS2307`. Se instalaron a mano `@base-ui/react` y
`class-variance-authority`.

**Problema 3:** `npm run lint` daba 154 errores provenientes de
`supabase/.temp/start-secrets/…`, un bundle minificado que genera el CLI. Está
en `.gitignore`, pero ESLint 9 flat config no lo lee; se añadió
`supabase/.temp/**` a los `ignores`.

**Fuera de alcance:** actualizar el CLI de Supabase (2.111 → 2.115) y las 3
vulnerabilidades high de `postcss`/`sharp`, transitivas de `next@15.5.23`,
cuyo arreglo exige Next 16 (breaking).

## Fase 3.1 — Tipos, sistema visual y componentes base (commit `33b1654`)

**Construido:** `types/database.ts` generado + 5 archivos de tipos de dominio,
tokens de tema claro/oscuro, `images.remotePatterns`, `formatPrice`, y los 8
componentes de `components/shared/`.

**Decisión — la paleta salió del mockup, no de la imaginación.** El PDF
`diseño_visual_platform.pdf` es un mockup rasterizado (2 páginas, sin texto
extraíble). Se extrajeron sus 19 imágenes embebidas y se **muestrearon los
colores por píxel**: primario `#1868E8`, navy de cabecera `#081838`, verde de
envío `#0FA06B`, óxido de descuento `#B04820`, fondo `#F8F8F9`. Convertidos a
OKLCH, que es el espacio que ya usaban los tokens de shadcn.

**Decisión — la spec manda en contenido, el mockup en forma.** El mockup está
marcado como "NODO." y usa `$` con dirección de CDMX. Se conservó la marca
*MercadoTech* y la moneda `S/` con `es-PE`, que es lo que fija la spec; del
mockup se tomaron disposición y color.

**Problema 1 — todo el sitio renderizaba en Times New Roman.** `@theme inline`
traía `--font-sans: var(--font-sans)`, una autorreferencia cíclica que
invalida la variable; además `layout.tsx` define `--font-geist-sans` sobre
`<body>` mientras la fuente se aplicaba en `<html>`. Se apuntó la variable a
la real y se movió `font-sans` a `body`.

**Problema 2 — contraste por debajo de AA.** El verde del mockup es *texto*
verde sobre blanco; usado como relleno de badge con texto blanco daba 3.22:1
(AA exige 4.5:1 a 12 px). Se oscureció `--success` de L .624 a .530 → 4.61:1,
y `--muted-foreground` de L .551 a .530 → 4.73:1 sobre `--muted`.

**Problema 3 — `ConditionBadge` se quedaba anclado al color del tema
anterior.** Aislado por búsqueda binaria sobre las 31 clases del `Badge`: el
culpable es `transition-all`, que al animar un `background-color` derivado de
una variable CSS deja el valor computado congelado en Chrome. Se añadió
`transition-none` en el componente propio, sin tocar `components/ui/badge.tsx`.

**Fuera de alcance:** estrellas en ámbar — el mockup muestra la calificación en
el azul de marca y se respetó.

## Fase 3.2 — Layouts, navegación y mapa de rutas (commit `27ee27b`)

**Construido:** layout raíz real (`lang="es"`, metadata, `<Toaster />`), los
tres layouts de grupo, 9 componentes de `components/layout/` y las 14 rutas
del mapa como placeholders.

**Decisión — navbar de tres pisos**, como el mockup: banda navy fina
(decorativa), barra blanca con marca + buscador ancho + cuenta/carrito, y fila
de categorías. La banda usa un par de tokens propio (`--band` /
`--band-foreground`) en vez de un color literal.

**Decisión — `components/layout/Brand.tsx`**, que no estaba en la tabla de la
spec: el wordmark aparece en tres sitios (navbar, cabecera del vendedor,
layout de auth) y triplicar el marcado garantizaba desincronización.

**Problema:** tras borrar `app/page.tsx` (colisionaba con `(shop)/page.tsx` en
`/`), `type-check` falló por un `.next/types/validator.ts` obsoleto. Se
resolvió con `rm -rf .next`.

**Fuera de alcance:** "Soporte" no aparece en el menú; su ruta llega en la
sesión 4.

## Fase 3.3 — Autenticación (commit `3d25934`)

**Construido:** migración `20260824194558_handle_new_user_metadata.sql`,
`lib/validators/auth.ts`, `services/auth.service.ts`, `hooks/useAuth.ts`,
`LoginForm`/`RegisterForm`, `/login` y `/register`, y el guard de sesión en
`lib/supabase/middleware.ts`.

**Decisión — el rol se fija en el trigger de alta.** Sin la migración,
registrarse como vendedor era imposible: `handle_new_user` omitía `role` (caía
al default `buyer`) y corregirlo después con un `UPDATE` lo bloquea
`protect_profile_role`. El único instante posible es el `INSERT` del trigger,
que corre `SECURITY DEFINER`. El `role` se filtra con lista blanca de dos
valores: `'admin'` manipulado degrada a `buyer`, verificado contra la API.

**Decisión — `/producto` NO se protege.** El detalle es público por spec;
protegerlo expulsaría a `/login` a quien llega desde un enlace compartido y
contradiría las políticas RLS, que ya permiten leer productos activos de forma
anónima.

**Problema:** el guard de rol del panel parpadeaba antes de cargar el profile
→ se muestra `LoadingState` mientras `initializing` es true, y solo entonces
se decide.

**Fuera de alcance:** confirmación de correo (en local `enable_confirmations =
false`; el código contempla el caso `session === null`) y recuperación de
contraseña.

## Fase 3.4 — Catálogo de productos (commit `637d521`)

**Construido:** `lib/constants/catalog.ts`, tres services
(`storage`, `category`, `product`), `useCategories` y `useProducts`, cuatro
componentes de `components/catalog/` y las páginas `/`, `/categoria/[slug]` y
`/buscar`.

**Decisión — filtros en la URL.** El estado se puede compartir por enlace,
sobrevive a F5 y el botón atrás deshace un filtro en vez de sacarte del
catálogo.

**Decisión — `categories!inner` en el select.** `category_id` es NOT NULL, así
que el inner join nunca descarta filas y permite filtrar por slug en la MISMA
consulta, sin un viaje extra para resolver slug → id.

**Problema 1 — el rango de precio borraba los demás filtros.** `commitPrice`
llamaba a `onChange` dos veces seguidas y ambas partían del mismo snapshot de
`searchParams`: el segundo `router.push` pisaba al primero. Se cambió el
contrato de `setFilter(clave, valor)` a **`setFilters(parcial)`**, que escribe
todo en una sola pasada. Solo apareció al teclear con teclado real.

**Problema 2 — violación de capas.** `CatalogView` importaba `useProducts`.
Ahora es puro y cada página conecta el hook; el tipo `CatalogFilters` se movió
de `hooks/useProducts` a `lib/constants/catalog.ts`.

**Problema 3 — tres errores de Base UI en consola**, heredados de 3.2/3.3:
`Button`/`SheetClose`/`DropdownMenuItem` renderizando `<a>` sin
`nativeButton={false}`, y una excepción no capturada
(`MenuGroupContext is missing`) por un `DropdownMenuLabel` fuera de
`DropdownMenuGroup`.

**Fuera de alcance:** búsqueda semántica. El `ilike` sobre `title`/`brand` es
provisional y está marcado como tal en el código.

## Fase 3.5 — Detalle, preguntas, reseñas y favoritos (commit `781607d`)

**Construido:** `question`/`review`/`favorite` services, `registerView`, cinco
hooks, cinco componentes de `components/product/`, `/producto/[id]` y
`/favoritos`.

**Decisión — sin nombres de otros usuarios.** `profiles` solo es legible por
su dueño o un admin, así que las preguntas muestran "Usuario" y las reseñas
"Comprador verificado". Mostrar nombres exigiría una vista `public_profiles`
(migración nueva), fuera de alcance.

**Decisión — `canReview` es defensa en profundidad.** La RLS ya cruza
`order_id` con un pedido `entregado` del comprador; el hook comprueba lo mismo
antes para no ofrecer un formulario que va a fallar.

**Fuera de alcance:** el botón "Agregar al carrito" quedó cableado a un
callback provisional, que la 3.6 sustituyó.

## Fase 3.6 — Carrito, checkout simulado y pedidos (commit `12270c6`)

**Construido:** `lib/constants/orders.ts`, `cart` y `order` services, `useCart`
y `useOrders`, componentes de `components/cart/` y `components/orders/`, y las
páginas `/carrito`, `/pedidos` y `/pedidos/[id]`.

**Decisión — el carrito no guarda precios.** Guarda producto + cantidad; el
precio que vale es el actual, y solo se congela como snapshot dentro del RPC.
Así nadie "reserva" un precio viejo dejando el carrito abierto.

**Decisión — el error del RPC se propaga tal cual.** El mensaje de Postgres ya
nombra el producto que falló (`Stock insuficiente para "X": disponible 0,
solicitado 1`, verificado); reescribirlo perdería esa información.

**Problema — el contador del navbar no se actualizaba al agregar.** Cada
`useCart()` creaba su propio estado, así que el layout no se enteraba de lo
que hacía la ficha de producto. Se convirtió `useCart` en un store a nivel de
módulo con `useSyncExternalStore`: mismo API del hook, todos los consumidores
sincronizados, sin envolver la app en un provider.

**Fuera de alcance (decisión 11):** cancelar un pedido **no repone stock** — no
hay trigger para ello. El diálogo de confirmación lo advierte.

## Fase 3.7 — Panel del vendedor con drag & drop (commit `85b9fe3`)

**Construido:** `lib/constants/product.ts`, `lib/validators/product.ts`,
`seller.service`, ampliación de `storage.service`, tres hooks, seis
componentes de `components/seller/` y las cuatro páginas del panel.

**Decisión — alta en dos pasos (decisión 12).** El path de Storage incluye el
`product_id`, así que en modo alta no se puede subir nada antes de crear el
producto: el reorden es local (`URL.createObjectURL`) y todo se sube tras el
`createProduct`. En modo edición cada cambio se persiste al momento.

**Decisión — las transiciones del kanban viven en el hook.** La RLS permite al
vendedor poner `pagado`/`enviado`/`entregado` pero **no valida el orden**
(aceptaría `entregado → pagado`). `useSellerOrders` rechaza cualquier salto
que no sea un paso adelante en `ORDER_STATUS_FLOW`.

**Decisión — la columna "Cancelado" es de solo lectura.** La RLS no deja al
vendedor cancelar; sus tarjetas no se arrastran y la columna no acepta drops.

**Problema — violación de capas.** `OrdersKanban` y `OrderKanbanCard`
importaban el tipo `SellerOrder` desde `services/`. Se movió a
`types/order.ts`.

**Fuera de alcance:** en un pedido multi-vendedor, mover la tarjeta cambia el
estado del pedido COMPLETO, porque el estado vive en `orders` y no en
`order_items`. Resolverlo exige cambio de esquema. Está comentado en el
service.

### Imágenes de muestra (mismo commit)

El seed crea las 35 filas de `product_images` pero **no los archivos**, así que
el catálogo se veía entero con placeholders. Se añadió
`scripts/seed-images.mjs` (`npm run db:images`), que descarga imágenes de
**Lorem Picsum** —fotos de Unsplash bajo licencia que permite este uso— y las
sube a Storage. Son fotos genéricas, no del producto real: las fotos de
producto de una tienda están protegidas por copyright.

Dos tropiezos: `service_role` no tiene GRANT de `SELECT` sobre
`public.product_images` (los GRANTs de la 2.3 son para anon/authenticated), así
que las rutas se leen de un manifiesto generado con psql en vez de por REST; y
picsum devuelve 404 si el `seed` lleva barras, incluso codificadas, por lo que
se usa un hash SHA-1 corto de la ruta (determinista: reejecutar da la misma
imagen).

## Fase 3.8 — Responsive, accesibilidad y estados (commit `c3a196a`)

**Construido:** `docs/SESION3_CHECKLIST.md` con la tabla por pantalla, las
mediciones de contraste y la evidencia de los dos greps de capas.

**Corregido para que los greps dieran vacío:** `useAuth` importaba
`lib/supabase/client` para suscribirse a `onAuthStateChange` → la suscripción
se movió a `auth.service.ts`, que ahora expone `onAuthStateChange(callback)`.

**Limpieza:** `app/dev/ui/page.tsx` eliminado; sin placeholders "Próximamente".

---

## Criterios de aceptación de la sesión

| Criterio | Estado | Evidencia |
|---|---|---|
| 14 rutas del mapa responden | ✅ | todas 200 (o 307 a `/login` si son protegidas) |
| Registro con elección de rol | ✅ | `profiles.role = 'seller'`; `'admin'` manipulado → `buyer` |
| Rutas protegidas sin parpadeo | ✅ | middleware devuelve 307 con `redirectTo` |
| Catálogo con datos reales | ✅ | 14 activos en 2 páginas; 12 cards con imagen real, 0 placeholders |
| Filtros compartibles por URL | ✅ | `?minPrice=500&maxPrice=1200&condition=nuevo` compone sin pisarse |
| Detalle con galería, Q&A y reseñas | ✅ | 3 miniaturas, 3 secciones, reseña solo si `canReview` |
| Carrito y checkout simulado | ✅ | pedido `pendiente` S/ 4 098, stock 8→7 y 5→4, carrito vacío, redirect a `/pedidos/[id]` |
| Error de stock con nombre del producto | ✅ | `Stock insuficiente para "Monitor Samsung Odyssey…": disponible 0, solicitado 1` |
| Panel del vendedor | ✅ | 8 productos (7 publicados + 1 oculto), kanban con 5 columnas |
| Dos drag & drop accesibles | ✅ | `KeyboardSensor` en galería y kanban, asas con `aria-label` |
| Separación de capas | ✅ | los dos greps devuelven vacío |
| `lint` / `type-check` / `build` | ✅ | los tres exit 0 |

## Deuda técnica y limitaciones conocidas

1. **No se pueden mostrar nombres de otros usuarios.** RLS restringe `profiles`
   a su dueño. Preguntas → "Usuario"; reseñas → "Comprador verificado".
   Requiere una vista `public_profiles`.
2. **Cancelar un pedido no repone stock.** No hay trigger. Advertido en la UI.
3. **Pedidos multi-vendedor:** el estado vive en `orders`, así que mover una
   tarjeta afecta al pedido completo aunque el vendedor solo vea sus ítems.
4. **Sin realtime.** El comprador ve los cambios de estado del vendedor al
   recargar.
5. **Búsqueda por `ilike`,** provisional hasta la búsqueda semántica.
6. **Vulnerabilidades transitivas** en `postcss` y `sharp` vía `next@15.5.23`;
   el arreglo exige Next 16.
7. **Sin tests automatizados de frontend.** Vitest y Playwright llegan en la
   sesión 6; toda la verificación de esta sesión fue manual e instrumentada.

## Pendientes

**Heredado de la sesión 1 (no ejecutada):** no existen `docs/COSTOS.md` ni
`docs/PROMPTS.md`. No bloquean nada.

**Sesión 2:** las fases 2.6 y 2.7 figuraban como pendientes en la spec, pero
**ya estaban hechas**: existen `supabase/tests/rls-validation.sql` y
`docs/ARQUITECTURA.md` (commits `feccd12` y `fb419eb`).

**Para la sesión 4:** asistente de soporte con RAG, ruta `/soporte` y su
entrada en el menú, pestaña de IA en `/buscar`, y los Route Handlers de
`app/api/v1/` que hasta ahora están vacíos a propósito.

---

# Sesión 2 — Base de datos, RLS y Storage

> Reconstruida a partir de commits; no hubo bitácora en su momento.

| Commit | Qué entregó |
|---|---|
| `fecd756` | Buckets `product-images` y `avatars` con sus políticas (Fase 2.4) |
| `cb96ae4` | `seed.sql`: 6 usuarios, 8 categorías, 16 productos, pedidos en los 5 estados (Fase 2.5) |
| `feccd12` | Batería de validación de RLS en `supabase/tests/` (Fase 2.6) |
| `fb419eb` | `docs/ARQUITECTURA.md` y actualización de CLAUDE.md (Fase 2.7) |
| `66622bd` | Corrección: `pgcrypto` cualificado por esquema en `seed.sql` y `search_path` fijado en las funciones de trigger |

Dejó 14 tablas con RLS, el RPC transaccional `create_order_from_cart` y los
clientes de Supabase (browser, server, middleware, admin) sobre los que se
apoyó toda la sesión 3.

---

# Sesión 1 — Fundamentos

No se ejecutó. No hay commits ni entregables (`docs/COSTOS.md`,
`docs/PROMPTS.md`) en el repositorio.
