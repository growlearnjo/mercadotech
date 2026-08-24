# MercadoTech — Prompts específicos de la Sesión 4 (RAG con Hugging Face)

Cada prompt está construido con los ítems de la rúbrica de prompt engineering
(Rol, Contexto, Objetivo, Público/tono, Restricciones, Formato, Ejemplos,
Razonamiento), incluyendo **solo los pertinentes para cada fase**. En esta
sesión pesan especialmente dos: el **Contexto** (cada fase depende de lo que
produjeron la sesión 3 y las fases anteriores, y de decisiones YA CERRADAS
sobre el proveedor de IA) y el **Formato de salida con verificación en
lenguaje de acciones** — casi todo lo que se construye es invisible, así que
cada prompt exige demostrar el resultado con algo que un alumno pueda ver y
repetir (una consulta, un conteo en Studio, un `curl`).

Todos asumen que existe `mercadotech/MercadoTech_sesion4.md` (la spec, versión
validada del 2026-08-24). La spec es la fuente de verdad; el prompt es el
disparador autocontenido.

| Fase | Rol | Contexto | Objetivo | Público/tono | Restricciones | Formato | Ejemplos | Razonamiento | Modelo sugerido |
|---|---|---|---|---|---|---|---|---|---|
| 4.0 Entorno y token HF | ✔ | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| Lectura de la spec | — | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| 4.1 Infraestructura vectorial | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | Opus |
| 4.2 Capa de IA + embeddings | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | Opus |
| 4.3 Indexación automática | ✔ | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| 4.4 Búsqueda semántica | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | Sonnet |
| 4.5 Constructor de contexto | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | Opus |
| 4.6 Chat service + endpoint | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | Opus |
| 4.7 Interfaz del asistente | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | Sonnet |
| 4.8 Calibración y docs | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | Sonnet |
| Cierre: bitácora + CLAUDE.md | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sonnet |

La columna "Modelo sugerido" sigue el criterio de la sesión 1 (que no se
ejecutó — no existe `docs/COSTOS.md`): Opus donde el error cuesta más que el
modelo (migración vectorial, capa del proveedor, función pura de contexto,
orquestación del chat); Sonnet para el resto.

---

## Cómo usar estos prompts

1. **Un prompt por turno, en orden, en conversación nueva** (o tras `/clear`):
   cada prompt lleva su contexto completo.
2. **La tarea humana va primero.** Antes del Prompt 0 el alumno crea su cuenta
   y token de Hugging Face siguiendo la sección "Antes de empezar" de la spec.
   El token se pega en `.env.local` A MANO — nunca en el chat con Claude.
3. **El Prompt 0 es un guardián.** Verifica que la sesión 3 esté realmente
   terminada y que el token funcione contra la API real ANTES de escribir
   código. Si algo falla ahí, no se avanza: se arregla primero.
4. **Verificación visible por fase.** Cada prompt termina con acciones que un
   alumno sin experiencia puede ejecutar y juzgar (escribir una consulta,
   contar filas en Studio, leer una respuesta). Si la evidencia no aparece,
   la fase no está terminada, aunque el código compile.
5. **Commit por fase**: `feat: <qué> for Fase 4.x` (`chore:` tooling,
   `docs:` documentación).
6. **Cierre.** Tras la 4.8, el Prompt de cierre actualiza `docs/BITACORA.md`
   y `CLAUDE.md` — la sesión 5 arranca leyendo esos dos archivos.

### Estado del repositorio al iniciar la sesión

Lo que el `[CONTEXTO]` de cada prompt da por cierto (el Prompt 0 lo verifica):

* Sesiones 2 y 3 ejecutadas: infraestructura completa + app funcional
  (catálogo, detalle, carrito/checkout, panel vendedor con drag & drop).
* Bitácora en `docs/BITACORA.md` y convenciones en `CLAUDE.md` (cierre de la
  sesión 3) — si no existen, ejecutar primero el Prompt de cierre de la 3.
* Sesión 1 NO ejecutada (sin `docs/COSTOS.md` ni `docs/PROMPTS.md`).
* Supabase local corriendo; seed con 14 productos activos y 10 artículos FAQ.
* NO existen: `lib/ai/`, `scripts/`, `app/api/v1/*` (solo `.gitkeep`),
  `components/chat/`, `/asistente`, `/soporte`, tabla `knowledge_embeddings`.
* Dependencias que FALTAN: `@huggingface/inference`, `tsx`.
* El token de Hugging Face es personal del alumno y vive solo en `.env.local`.

---

## Prompt 0 — Verificación de la sesión 3, token y dependencias de IA

```text
[ROL] Actúa como ingeniero DevOps que valida prerrequisitos antes de una
integración con un proveedor externo: tu regla es "probar la llave contra la
cerradura real antes de construir la puerta".

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Lee CLAUDE.md,
docs/BITACORA.md (si existe) y las secciones "Estado de partida", "Antes de
empezar" y "Guía Hugging Face" de mercadotech/MercadoTech_sesion4.md. Esta
sesión integra Hugging Face (nivel gratuito): embeddings con el SDK
@huggingface/inference y chat contra el router OpenAI-compatible. YO (el
humano) ya creé mi cuenta y pegué mi token en .env.local como
HUGGINGFACEHUB_API_TOKEN — si no está, detente y recuérdame los pasos de la
sección "Antes de empezar" de la spec; no me pidas el token por chat.

[OBJETIVO] Verifica y provisiona, en este orden:
1. Sesión 3 terminada: existen types/database.ts, services/product.service.ts,
   hooks/useProductForm.ts, app/(shop)/buscar/page.tsx,
   components/layout/SearchBar.tsx y el guard del middleware; `npm run build`
   pasa. Si algo falta, detente y dime exactamente qué fase de la sesión 3
   quedó incompleta.
2. Stack local corriendo (`supabase status`); si no, `supabase start`. Conteos
   del seed: 14 productos activos, 10 artículos publicados.
3. Token presente: .env.local contiene HUGGINGFACEHUB_API_TOKEN con prefijo
   hf_ (verifica su EXISTENCIA con grep del nombre de la variable; no
   imprimas su valor). Agrega las tres variables documentadas a .env.example
   (HUGGINGFACEHUB_API_TOKEN, HUGGINGFACE_EMBEDDING_MODEL opcional,
   HUGGINGFACE_CHAT_MODEL opcional), sin valores.
4. Instala: `npm i @huggingface/inference` y `npm i -D tsx`.
5. SMOKE TEST contra la API real, con un script temporal en el scratchpad
   (NO en el repo): (a) featureExtraction con
   sentence-transformers/all-MiniLM-L6-v2 sobre un texto corto → imprime la
   longitud del vector (debe ser 384); (b) chat completion contra
   https://router.huggingface.co/v1/chat/completions con
   meta-llama/Llama-3.1-8B-Instruct → imprime la respuesta. Si (b) falla con
   "model not supported"/"no provider", el modelo rotó (lección 3 de la Guía
   HF): prueba 2-3 candidatos instruct actuales contra la API y proponme el
   reemplazo para HUGGINGFACE_CHAT_MODEL antes de continuar.
6. `npm run lint` y `npm run type-check` siguen pasando.

[RESTRICCIONES]
- NO escribas nada de lib/ai/, services ni migraciones: eso empieza en 4.1.
- NO imprimas el token ni fragmentos de él en ninguna salida.
- NO uses el MCP de Supabase hosted; todo es local.
- El script de humo vive fuera del repo y no se commitea.

[RAZONAMIENTO] Ejecuta las verificaciones en el orden dado y detente en la
primera que falle, con el diagnóstico y el paso para resolverla; no acumules
fallos. Explica en una línea por qué el smoke test va ANTES que el código
(lección de ReadHub: la disponibilidad de modelos gratuitos rota).

[FORMATO DE SALIDA] (1) Tabla prerrequisito × estado (✅/❌) × evidencia;
(2) resultado del smoke test: longitud del vector y primera línea de la
respuesta del chat, con el modelo usado; (3) paquetes instalados;
(4) commit: "chore: provision AI dependencies and verify HF access for
Sesión 4".
```

## Prompt 1 — Lectura de la spec (sin código)

```text
[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. El Prompt 0 verificó la
sesión 3, el token de Hugging Face (smoke test real) y las dependencias. Vas
a ejecutar la sesión 4 en 8 fases, una por prompt, cada una sin memoria de la
anterior.

[OBJETIVO] Lee COMPLETOS, en este orden: CLAUDE.md;
mercadotech/MercadoTech_sesion4.md (incluidas la analogía del bibliotecario,
el glosario y la Guía Hugging Face — vas a respetar esas 8 lecciones como
decisiones cerradas); docs/BITACORA.md (sección de la sesión 3); y
supabase/seed.sql secciones 3 y 9 (productos y artículos FAQ: es el contenido
que vas a fichar). Después confírmame que entiendes el alcance.

[RESTRICCIONES] No generes código ni archivos. No propongas cambiar proveedor,
modelos, dimensiones ni umbrales: están cerrados. Si ves una contradicción
entre la spec y el repo, señálala como pregunta.

[RAZONAMIENTO] Explica con tus palabras, en 6 líneas y usando la analogía del
bibliotecario, qué pasa desde que un usuario pregunta "audífonos para el
gimnasio" hasta que ve resultados — nombrando qué fase construye cada tramo.
Es la prueba de que entendiste el flujo, no solo la lista de archivos.

[FORMATO DE SALIDA] (1) Resumen de 8 líneas, una por fase; (2) la explicación
del flujo con la analogía; (3) las 3 restricciones que más condicionan tu
trabajo (sesión obligatoria para la IA, UI nunca importa lib/ai/, admin solo
en Route Handlers/scripts); (4) dudas (o "ninguna"); (5) confirmación de que
no adelantarás trabajo de fases futuras.
```

## Prompt Fase 4.1 — Infraestructura vectorial

```text
[ROL] Actúa como DBA senior de PostgreSQL experto en pgvector sobre Supabase
(índices HNSW, funciones SQL con search_path fijado, RLS con GRANTs).

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir, lee:
CLAUDE.md; mercadotech/MercadoTech_sesion4.md (Fase 4.1 completa: tabla de
campos, firma del RPC, reglas de RLS, y la decisión 1 — la IA exige sesión);
las migraciones existentes en supabase/migrations/ (para copiar sus
convenciones de comentarios y para NO tocarlas); supabase/seed.sql secciones
3 y 9 (las dos fuentes que esta tabla fichará). El script `npm run db:types`
ya existe. pgvector viene incluido en el stack local de Supabase.

[OBJETIVO] Ejecuta la Fase 4.1: migraciones NUEVAS para (1) habilitar
`vector` en el schema extensions; (2) tabla knowledge_embeddings con
unique(source_type, source_id, chunk_index), RLS habilitado e índice HNSW
con vector_cosine_ops; (3) RPC match_knowledge(query_embedding vector(384),
p_source_type text, match_count int, similarity_threshold float) SECURITY
INVOKER con search_path fijado, que devuelve source_type, source_id, content,
metadata, similarity ordenado por similitud (ambas fuentes si p_source_type
es null); (4) políticas: SELECT para authenticated; INSERT/UPDATE/DELETE sin
política ni GRANT (solo service role); GRANTs explícitos. Actualiza
schema.sql y policies.sql de referencia, corre `supabase db reset` y
regenera types/database.ts con `npm run db:types`.

[RESTRICCIONES]
- source_id SIN foreign key: apunta a dos tablas origen distintas; documenta
  el porqué y la consecuencia (huérfanos posibles; los descarta el service)
  en comentario SQL.
- Comentario obligatorio en la migración de la tabla: cambiar de modelo de
  embeddings a otra dimensión exige ALTER COLUMN ... TYPE vector(N) +
  recrear índice y función.
- SELECT solo para authenticated — NO anon (decisión 1 de la spec).
- NO toques migraciones existentes ni seed.sql. `db reset` debe quedar limpio.

[EJEMPLOS] Convención de comentarios a imitar (de las migraciones de la
sesión 2): cada decisión no obvia lleva su porqué encima, en español:
  -- Supuesto: ... porque ...

[RAZONAMIENTO] Antes del SQL: justifica en 3 líneas por qué UNA tabla
discriminada por source_type y no dos tablas gemelas, y por qué el RPC es
SECURITY INVOKER cuando create_order_from_cart fue SECURITY DEFINER (pista:
uno debe respetar la visibilidad del caller; el otro debía saltarse RLS).

[FORMATO DE SALIDA] (1) Lista de migraciones creadas con una línea cada una;
(2) `supabase db reset` limpio; (3) en Studio SQL Editor, la llamada de
prueba con un vector constante de 384 ceros devuelve 0 filas sin error —
pega el SQL usado y el resultado; (4) types/database.ts regenerado (grep de
knowledge_embeddings); (5) lint y type-check; (6) commit: "feat: add vector
infrastructure (pgvector, knowledge_embeddings, match_knowledge) for
Fase 4.1".
```

## Prompt Fase 4.2 — Capa de IA y servicio de embeddings

```text
[ROL] Actúa como ingeniero de integraciones que encapsula proveedores
externos: un solo módulo conoce la API; el resto del sistema ni sabe que
existe Hugging Face.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: CLAUDE.md; mercadotech/MercadoTech_sesion4.md — la GUÍA HUGGING FACE
COMPLETA (las 8 lecciones de ReadHub son ley: SDK solo para embeddings,
fetch al router para chat, validación del vector plano de 384, truncado de
MiniLM, modelo de chat por variable de entorno, errores accionables) y la
Fase 4.2 con la lista exacta de tunables y sus valores; types/database.ts
(fila de knowledge_embeddings); services/product.service.ts (convención de
service con cliente inyectable, de la sesión 3); supabase/seed.sql (forma
real de products y support_articles). @huggingface/inference ya está
instalado y el token ya pasó el smoke test del Prompt 0.

[OBJETIVO] Ejecuta la Fase 4.2: lib/constants/ai.ts con TODOS los tunables de
la spec, cada uno con su comentario justificatorio; lib/ai/embeddings.ts
(generateEmbedding con InferenceClient.featureExtraction + validación de
forma; buildProductEmbeddingText y buildSupportArticleEmbeddingText con
secciones etiquetadas en orden de densidad semántica y truncado a
MAX_EMBEDDING_INPUT_CHARS); lib/ai/completion.ts (generateCompletion con
fetch al router, {text, model, stopReason}, errores que distinguen 401 /
modelo no disponible / respuesta inválida); lib/ai/prompts.ts (instrucciones
de los dos modos + buildRagUserMessage); services/embedding.service.ts
(orquesta con el cliente admin INYECTADO por el caller).

[RESTRICCIONES]
- Nada fuera de lib/ai/ importa @huggingface/*; lib/ai/ no importa React ni
  Supabase; embedding.service.ts no importa lib/supabase/admin.ts.
- El modelo de chat se lee de process.env.HUGGINGFACE_CHAT_MODEL con
  fallback a la constante; el de embeddings igual con
  HUGGINGFACE_EMBEDDING_MODEL.
- Los comentarios de los tunables explican el PORQUÉ del valor (cópialos en
  espíritu de la spec, no inventes otros valores).
- En SUPPORT_SYSTEM_INSTRUCTIONS deja el comentario: las respuestas se
  leerán en voz alta en la sesión 8 — cortas y claras.
- No toques la UI ni crees endpoints: eso es 4.3+.

[EJEMPLOS] Composición del texto a vectorizar (lección 4 — lo primero
sobrevive al truncado):
  Título: Audífonos Logitech G435 Gaming Inalámbricos
  Marca: Logitech
  Categoría: Audio
  Condición: nuevo
  Descripción: <texto largo, truncado si excede>
Validación del vector (lección 5):
  if (!Array.isArray(result) || result.some(v => typeof v !== "number"))
    throw new Error("…se esperaba un vector numérico plano.");

[RAZONAMIENTO] Antes de codificar, responde en 4 líneas: ¿por qué embeddings
usa SDK y chat usa fetch, si ambos son Hugging Face? (lecciones 1 y 2 — la
respuesta está en qué soporta el router y qué no). Si no puedes responderlo,
relee la Guía antes de escribir.

[FORMATO DE SALIDA] (1) Archivos creados; (2) script de humo temporal (en el
scratchpad, no en el repo) que demuestre: embedding real de una frase del
catálogo con length 384, una completion real con el modelo usado, y el
mensaje de error claro al quitar temporalmente el token (restáuralo);
(3) el grep de @huggingface fuera de lib/ai/ devolviendo vacío; (4) lint y
type-check; (5) commit: "feat: add AI layer and embedding service for
Fase 4.2".
```

## Prompt Fase 4.3 — Indexación automática

```text
[ROL] Actúa como ingeniero backend que diseña procesos best-effort: la
indexación jamás puede romper ni retrasar la operación principal (publicar).

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: CLAUDE.md; mercadotech/MercadoTech_sesion4.md (Fase 4.3 y decisión 6 —
fichas huérfanas); services/embedding.service.ts y lib/ai/ (4.2);
lib/supabase/admin.ts (cliente service role, con su advertencia);
hooks/useProductForm.ts y hooks/useSellerProducts.ts (sesión 3 — los vas a
ampliar); app/api/v1/ (vacío: estos son los PRIMEROS Route Handlers del
proyecto, reservados desde la sesión 2 para lo que no puede correr en el
navegador). tsx ya está instalado como devDependency.

[OBJETIVO] Ejecuta la Fase 4.3: lib/api-response.ts (apiError(status, code,
message)); POST /api/v1/reindex (valida sesión 401 / body 400; cliente
admin + embedding.service; si la fuente ya no existe, borra sus fichas);
services/indexing-trigger.service.ts (triggerReindex fire-and-forget,
console.warn si falla); ampliar useProductForm (tras crear/editar →
trigger) y useSellerProducts (tras toggleActive/deleteProduct → trigger);
scripts/index-all.ts (con admin, corre con npx tsx, indexa productos
activos + artículos publicados e imprime conteos por tipo; documenta en su
cabecera que es la vía de reindexación si el admin edita artículos por SQL).

[RESTRICCIONES]
- El cliente admin SOLO aparece en app/api/v1/reindex/route.ts y en
  scripts/index-all.ts. Ni el trigger-service ni los hooks lo conocen.
- El trigger no bloquea, no lanza, no muestra toasts de error al vendedor:
  best-effort silencioso (warn en consola).
- Publicar/editar debe funcionar EXACTAMENTE igual que en la sesión 3 si
  Hugging Face está caído o el token falta.
- No toques la UI de búsqueda ni el chat: eso es 4.4+.

[RAZONAMIENTO] Antes de codificar, describe la secuencia completa de
"seller1 publica un producto": qué corre en el navegador, qué viaja al
endpoint, qué hace el service con el admin, y qué pasa en los dos caminos de
fallo (sin sesión; Hugging Face caído). Luego implementa.

[FORMATO DE SALIDA] (1) Archivos creados/ampliados; (2) salida de
`npx tsx scripts/index-all.ts` (14 productos + 10 artículos = 24 fichas) y
el conteo en Studio; (3) evidencia del flujo por la UI: publicar un producto
→ fila 25; editarlo → sigue 25 con content actualizado; publicar con el
token renombrado → publicación exitosa + warn en consola (token restaurado
después); (4) lint y type-check; (5) commit: "feat: add automatic indexing
(reindex endpoint, trigger, batch script) for Fase 4.3".
```

## Prompt Fase 4.4 — Búsqueda semántica en el catálogo

```text
[ROL] Actúa como frontend engineer senior que integra capacidades de IA sin
duplicar UI: la pestaña nueva reutiliza el grid existente o no se hace.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: CLAUDE.md; mercadotech/MercadoTech_sesion4.md (Fase 4.4 y decisión 1:
la IA exige sesión); app/(shop)/buscar/page.tsx,
components/catalog/ProductGrid.tsx y ProductCard.tsx (sesión 3 — se
REUTILIZAN tal cual); components/layout/SearchBar.tsx (tiene el comentario
"la búsqueda semántica llega en la sesión 4" — retíralo); hooks/useAuth.ts;
lib/ai/embeddings.ts y el RPC match_knowledge (4.1-4.2);
lib/api-response.ts (4.3); services/product.service.ts (convenciones de
hidratación: price a number, image_url resuelta). Hay 24+ fichas pobladas.

[OBJETIVO] Ejecuta la Fase 4.4: services/vector-search.service.ts
(searchByEmbedding sobre el RPC; searchProducts = embedding de la consulta +
matching con source_type='producto' + hidratación con products activos,
descartando huérfanos); POST /api/v1/search/semantic (requiere sesión;
valida query; embedding server-side; cliente de SESIÓN para el RPC);
hooks/useSemanticSearch.ts; ampliar /buscar con tabs "Coincidencia exacta"
(la actual, intacta) / "Resultados con IA" (mismo ProductGrid + badge de
similitud opcional; sin sesión → EmptyState "Inicia sesión para usar la
búsqueda inteligente" con botón a /login?redirectTo=).

[PÚBLICO/TONO] Los textos de la pestaña IA en español simple: el aviso de
login, y el EmptyState sin resultados con sugerencia de reformular ("Prueba
describir para qué lo necesitas"). Nada de jerga ("embeddings", "vector")
de cara al usuario.

[RESTRICCIONES]
- La pestaña exacta NO cambia: mismos resultados que en la sesión 3, para
  anónimos incluidos.
- El token jamás viaja al navegador: el embedding de la consulta se genera
  en el endpoint.
- Nada de lib/ai/ importado desde components/ ni hooks/ (la cadena es hook →
  fetch → endpoint → service → lib/ai/).
- Reutiliza ProductGrid/ProductCard; si necesitas el badge de similitud,
  extiende por props opcionales, no dupliques el card.

[FORMATO DE SALIDA] (1) Archivos creados/ampliados; (2) la demostración
clave, con sesión: "audífonos para el gimnasio" → pestaña IA lista los
audífonos deportivos primero Y pestaña exacta no los encuentra (pega ambos
resultados — esa diferencia es la sesión); (3) "algo para conectar mi casa a
internet" → aparece el router; (4) sin sesión: pestaña IA muestra el aviso;
(5) "autos usados" → EmptyState con sugerencia; (6) lint y type-check;
(7) commit: "feat: add semantic search tab for Fase 4.4".
```

## Prompt Fase 4.5 — Constructor de contexto

```text
[ROL] Actúa como ingeniero de software funcional: funciones puras,
deterministas, sin I/O — si no se puede probar con datos en memoria, está
mal diseñado.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: CLAUDE.md; mercadotech/MercadoTech_sesion4.md (Fase 4.5 — la analogía:
de todas las fichas recuperadas, cuáles entran al escritorio del redactor y
en qué orden); lib/constants/ai.ts (los 5 tunables CONTEXT_BUILDER_* con sus
porqués, definidos en 4.2); services/vector-search.service.ts (la forma
exacta de los resultados que recibirás); lib/ai/prompts.ts
(buildRagUserMessage, que consumirá tu salida).

[OBJETIVO] Ejecuta la Fase 4.5: lib/ai/context-builder.ts — función pura:
(1) selección: filtra por minSimilarity y MIN_CONTENT_LENGTH, ordena por
similitud, corta a maxSources; (2) presupuesto: acumula contenido hasta
maxContextChars y si a la última fuente le quedan menos de
MIN_TRUNCATED_SOURCE_CHARS se descarta entera; (3) salida: {userMessage,
sources[], stats: {contextTruncated, totalChars}} conservando source_type,
source_id, título y similitud en cada fuente.

[RESTRICCIONES]
- CERO I/O: sin fetch, sin Supabase, sin React, sin lib/supabase/*. Se
  testeará en aislamiento en la sesión 6.
- Todos los umbrales vienen de lib/constants/ai.ts como defaults de las
  opciones — nada hardcodeado y todo sobreescribible por llamada.
- No modifiques vector-search ni prompts: te adaptas a sus contratos.

[EJEMPLOS] Caso de presupuesto a respetar (de la spec): si maxContextChars
deja solo 120 caracteres para la última fuente y
MIN_TRUNCATED_SOURCE_CHARS=200, esa fuente NO entra ni recortada — media
frase confunde más de lo que aporta.

[RAZONAMIENTO] Antes de codificar, enumera los casos borde: lista vacía,
todas bajo el threshold, una sola fuente gigante, empates de similitud,
contenido de 5 caracteres. Di qué devuelve la función en cada uno; luego
implementa exactamente eso.

[FORMATO DE SALIDA] (1) El archivo; (2) demostración en frío pegada en la
respuesta: 8 resultados de ejemplo (2 bajo el threshold, 1 con contenido
mínimo, 1 que excede presupuesto) → salida exacta de la función con stats;
(3) grep confirmando que el archivo no importa fetch/supabase/react;
(4) lint y type-check; (5) commit: "feat: add pure context builder for
Fase 4.5".
```

## Prompt Fase 4.6 — Servicio conversacional y endpoint de chat

```text
[ROL] Actúa como ingeniero backend que orquesta sin reimplementar: si
chat.service contiene lógica de búsqueda, de contexto o de proveedor, la
fase está mal hecha.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: CLAUDE.md; mercadotech/MercadoTech_sesion4.md (Fase 4.6);
services/vector-search.service.ts (4.4), lib/ai/context-builder.ts (4.5),
lib/ai/completion.ts y lib/ai/prompts.ts (4.2), lib/api-response.ts y el
patrón de los endpoints existentes (4.3-4.4); lib/constants/ai.ts
(CHAT_QUERY_MAX_CHARS). Todas las piezas existen: esta fase SOLO las
encadena y las expone.

[OBJETIVO] Ejecuta la Fase 4.6: types/chat.ts (ChatMessage, ChatResult,
ChatSource); services/chat.service.ts con ask(query, mode: 'compras' |
'soporte', opts, supabase): búsqueda filtrando source_type según modo
(compras → producto, soporte → articulo_soporte) → contexto → completion
con las instrucciones del modo → ChatResult {query, answer,
hasRelevantContext, sources, metadata: {model, retrievedCount,
usedSourceCount, contextTruncated}}; POST /api/v1/chat: sesión obligatoria
(401), body JSON válido con query no vacía <= CHAT_QUERY_MAX_CHARS y mode
válido (400/422), cliente de SESIÓN (no admin), log estructurado por
consulta (retrievedCount/usedSourceCount/hasRelevantContext — insumo de la
4.8), errores con apiError.

[RESTRICCIONES]
- chat.service no importa @huggingface/*, no arma prompts a mano (usa
  lib/ai/prompts), no consulta la tabla (usa vector-search), no recorta
  contexto (usa context-builder).
- Si no hay contexto relevante, hasRelevantContext=false y la completion
  IGUAL se llama con contexto vacío — las instrucciones del modo ya dicen
  qué responder ("no encontré…"/sugerir ticket). No inventes un atajo.
- El endpoint usa el cliente de sesión: la RLS de knowledge_embeddings
  aplica tal cual.
- Sin UI todavía: nada en components/ ni hooks/.

[EJEMPLOS] Forma exacta del log estructurado esperado por consulta:
  {"endpoint":"chat","mode":"compras","retrievedCount":5,
   "usedSourceCount":3,"hasRelevantContext":true,"model":"…"}

[RAZONAMIENTO] Antes de codificar, dibuja (en texto) la cadena de llamadas
de ask() con qué entra y qué sale de cada eslabón, y marca cuál eslabón
tocarías si mañana: (a) cambia el proveedor de chat, (b) cambia el umbral,
(c) se agrega una fuente nueva. Si la respuesta no es "uno solo por caso",
replantea antes de escribir.

[FORMATO DE SALIDA] (1) Archivos creados; (2) transcripción de 3 curl con
cookie de sesión (indica cómo obtenerla de DevTools): compras con respuesta
y fuentes; soporte citando la FAQ; "¿venden autos usados?" con
hasRelevantContext=false; (3) curl sin cookie → 401 y con mode inválido →
422; (4) los logs estructurados de esas consultas; (5) lint y type-check;
(6) commit: "feat: add chat service and endpoint for Fase 4.6".
```

## Prompt Fase 4.7 — Interfaz del asistente

```text
[ROL] Actúa como frontend engineer senior de interfaces conversacionales:
el chat nunca se rompe — todo error del servidor se convierte en un mensaje
más de la conversación.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: CLAUDE.md; mercadotech/MercadoTech_sesion4.md (Fase 4.7 completa, con
las decisiones 3 y 5); el endpoint /api/v1/chat y types/chat.ts (4.6);
components/layout/UserMenu.tsx y MobileNav.tsx (sesión 3 — ganan las
entradas "Asistente" y "Soporte", omitidas a propósito entonces);
lib/supabase/middleware.ts (suma /asistente y /soporte a los prefijos
protegidos); components/shared/ y components/catalog/ProductCard.tsx (para
las mini-cards de fuentes); supabase/seed.sql sección 10 (2 tickets con
mensajes — alimentan "Mis tickets"); la política RLS de support_tickets
(dueño o admin).

[OBJETIVO] Ejecuta la Fase 4.7: hooks/useChat.ts (parametrizado por modo;
historial en memoria; errores del servidor como mensaje inline del
asistente); services/ticket.service.ts (listMine) y hooks/useMyTickets.ts;
components/chat/ (ChatWindow, ChatMessage, LoadingMessage, ChatInput con
Enter, SourcesList: producto → mini-card con imagen/Price y link a
/producto/[id], artículo → título con ancla en /soporte);
app/(shop)/asistente/page.tsx (modo compras, con sugerencias de arranque
clicables) y app/(shop)/soporte/page.tsx (modo soporte + "Mis tickets"
debajo; comentario en el layout: la sesión 8 agrega aquí el botón de
micrófono); ampliar UserMenu/MobileNav y el middleware.

[PÚBLICO/TONO] Español simple de cara al usuario: sugerencias de arranque
realistas ("¿qué laptop me recomiendas para diseño por menos de S/ 3,500?"),
mensaje de error inline amable ("No pude procesar tu consulta, intenta de
nuevo"), estados de ticket con las etiquetas del dominio (abierto,
en_proceso, resuelto, cerrado).

[RESTRICCIONES]
- components/chat/ son puros: mensajes y callbacks por props; no conocen el
  endpoint, Supabase ni lib/ai/.
- Solo LISTAR tickets: crear tickets desde la UI llega con el agente de la
  sesión 8. No lo adelantes.
- Sin streaming: respuesta completa (el streaming no está en el alcance).
- Reutiliza EmptyState/LoadingState/skeletons de la sesión 3 en el historial
  y en "Mis tickets".

[FORMATO DE SALIDA] (1) Archivos creados/ampliados; (2) recorrido en el
navegador: pregunta de compras → respuesta con fuentes → clic en fuente abre
el producto correcto; pregunta de devoluciones en /soporte → cita el
artículo; "¿venden autos?" → sugiere ticket; (3) buyer1 ve sus tickets del
seed; (4) anónimo en /asistente → /login?redirectTo=/asistente; (5) server
levantado SIN token → el chat muestra el error inline y el resto de la app
funciona; (6) lint y type-check; (7) commit: "feat: add shopping and support
assistants UI for Fase 4.7".
```

## Prompt Fase 4.8 — Calibración, observabilidad y casos de prueba

```text
[ROL] Actúa como QA de sistemas RAG: tu trabajo es documentar evidencia
reproducible y calibrar con datos, no confirmar que "se ve bien".

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Las Fases 4.1–4.7
están implementadas y commiteadas. Antes de empezar, lee:
mercadotech/MercadoTech_sesion4.md (Fase 4.8: los 6 casos y la tabla de
síntomas; y la lección 7 de la Guía HF: el 0.3 es provisional);
lib/constants/ai.ts (thresholds vigentes); y ten a mano la terminal del
server para leer los logs estructurados del endpoint de chat. El seed sigue
intacto salvo los productos creados en pruebas.

[OBJETIVO] Ejecuta la Fase 4.8: (1) `npx tsx scripts/index-all.ts` y
verificar conteo == productos activos + artículos publicados; (2) ejecutar
los 6 casos de la tabla de la spec EXACTAMENTE como están escritos,
recogiendo para cada uno: entrada, salida real (transcripción), y los logs
estructurados; (3) con esa evidencia decidir si los thresholds se quedan o
se mueven (consultas legítimas con 0 fuentes → bajar; ruido en el contexto →
subir), aplicar el cambio SOLO en lib/constants/ai.ts si corresponde, y
re-ejecutar los casos afectados; (4) escribir docs/RAG.md con: cómo funciona
el flujo (puedes reutilizar la analogía y el diagrama de la spec), los 6
casos con su evidencia, la sección de calibración (antes/después o "se queda
en 0.3 porque…"), y la tabla de síntomas y diagnóstico copiada de la spec.

[PÚBLICO/TONO] docs/RAG.md lo leerá un alumno que no programó esto: cada
caso con los pasos exactos para repetirlo (qué escribir, dónde, qué debe
ver). Sin jerga sin explicar.

[RESTRICCIONES]
- No cambies código: solo constantes en lib/constants/ai.ts (con su
  comentario actualizado) y documentación.
- La evidencia es literal: transcripciones y conteos reales, no "funciona
  correctamente".
- Si un caso falla, primero diagnostica con la tabla de síntomas de la spec
  y documenta el diagnóstico ANTES de proponer un fix.

[RAZONAMIENTO] Para la calibración: junta los logs de AL MENOS 8 consultas
variadas (las de los casos + 2 legítimas extra + 2 absurdas) en una tabla
consulta × retrievedCount × usedSourceCount × ¿respuesta útil?, y decide
mirando la tabla, no una consulta suelta.

[FORMATO DE SALIDA] (1) docs/RAG.md completo; (2) la tabla de calibración;
(3) diff de lib/constants/ai.ts si hubo ajuste (o la constancia de que no);
(4) lint, type-check y build; (5) commit: "docs: add RAG test cases and
calibration for Fase 4.8".
```

## Prompt de cierre — Bitácora de la sesión y actualización de CLAUDE.md

```text
[ROL] Actúa como tech lead que cierra una iteración: documentas lo
construido, lo decidido y lo pendiente, para que la sesión 5 arranque sin
arqueología.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Las Fases 4.0–4.8
están implementadas y commiteadas. Obtén el estado REAL: `git log --oneline`
(identifica el último commit de la sesión 3 y el rango de la 4), `git diff
--stat <último-commit-s3>..HEAD`, `ls -R lib/ai app/api components/chat
scripts docs`, docs/RAG.md, y lee docs/BITACORA.md (secciones existentes),
CLAUDE.md y mercadotech/MercadoTech_sesion4.md (decisiones de validación,
restricciones, entregables). Pendientes heredados conocidos: sesión 1 no
ejecutada; Fases 2.6 y 2.7 de la sesión 2 (verifica si siguen pendientes).

[OBJETIVO] (1) Agregar a docs/BITACORA.md la sección "Sesión 4" (arriba de
la 3): por fase, fecha, commits, qué se construyó, decisiones con su porqué
(IA solo con sesión, una tabla discriminada, source_id sin FK, modelo por
variable de entorno), problemas y solución (¿rotó el modelo en el Prompt 0?
¿hubo calibración?), y qué quedó fuera (streaming, crear tickets, voz).
Cerrar con criterios de aceptación ✅/❌ con evidencia, deuda técnica
vigente y pendientes para la sesión 5. (2) Actualizar CLAUDE.md
quirúrgicamente: la regla nueva de la capa de IA (la UI jamás importa
lib/ai/; cadena hook → endpoint → service → lib/ai/), dónde viven los
tunables de IA, los comandos nuevos (npx tsx scripts/index-all.ts), los dos
greps nuevos de verificación, y "Estado del proyecto" al día.

[PÚBLICO/TONO] La bitácora la lee un alumno que no estuvo: hechos con
evidencia (commit, archivo, comando). CLAUDE.md lo lee Claude Code en cada
conversación: solo líneas que cambien cómo se escribe código.

[RESTRICCIONES]
- Documenta lo CONSTRUIDO; si difiere de la spec, gana el código y se anota
  como desviación.
- CLAUDE.md crece máximo ~40 líneas netas; lo narrativo va a la bitácora.
- No inventes fechas ni commits: todo sale de git. No modifiques código.
- No describas la sesión 5 más allá de la lista de pendientes.

[EJEMPLOS] Línea esperada en CLAUDE.md (convención, no narrativa):
  * La UI nunca importa `lib/ai/`: el navegador llega a la IA solo vía
    hook → fetch a `app/api/v1/*` → service → `lib/ai/`.

[RAZONAMIENTO] Arma primero la línea de tiempo desde git y contrástala con
los entregables de la spec; redacta después. Relee CLAUDE.md completo al
final como si fueras a empezar la sesión 5 con él y borra lo que no cambie
una decisión.

[FORMATO DE SALIDA] (1) Sección nueva de docs/BITACORA.md; (2) diff de
CLAUDE.md; (3) tabla entregables × estado × evidencia; (4) pendientes
heredados actualizados; (5) commit: "docs: add project log and update
CLAUDE.md at close of Sesión 4".
```

---

## Nota sobre la rúbrica

Lo distintivo de esta sesión frente a la 3: casi todo lo construido es
**invisible** (fichas, umbrales, tuberías), así que el ítem que sostiene la
calidad no es solo el Contexto sino el **Formato de salida con evidencia
visible** — cada prompt exige demostrar el resultado con una acción que un
alumno pueda repetir y juzgar (la búsqueda del "gimnasio" que la pestaña
exacta no encuentra, el conteo 24 en Studio, el 401 del curl sin cookie).
Además, la Guía Hugging Face de la spec funciona como un contexto de
decisiones CERRADAS: los prompts de 4.2 y 4.6 piden razonar sobre esas
lecciones (¿por qué SDK aquí y fetch allá?) antes de codificar — no para
re-abrirlas, sino para verificar que el agente las entendió antes de tocar la
capa más delicada del proyecto. Público/tono aparece más que en la sesión 3
porque hay textos de cara al usuario final (4.4, 4.7) y documentación para
alumnos (4.8, cierre).
