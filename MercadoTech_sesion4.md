# MercadoTech — Sesión 4: Integrando IA en tu SaaS con RAG

## Este documento contiene la especificación completa de la sesión. Léelo completamente antes de generar cualquier código. No hagas suposiciones fuera de lo especificado.

**Prompts de la sesión (ejecutar en orden):**

1. "Lee `mercadotech/MercadoTech_sesion4.md` completo y confírmame que entiendes el alcance. No generes código todavía."
2. "Ejecuta la Fase 4.1: infraestructura vectorial (pgvector, tabla, índice y función de matching)."
3. "Ejecuta la Fase 4.2: capa de IA y servicio de embeddings."
4. "Ejecuta la Fase 4.3: indexación automática de productos y artículos de soporte."
5. "Ejecuta la Fase 4.4: búsqueda semántica en el catálogo."
6. "Ejecuta la Fase 4.5: constructor de contexto."
7. "Ejecuta la Fase 4.6: servicio conversacional y endpoint de chat."
8. "Ejecuta la Fase 4.7: interfaz del asistente (compras y soporte)."
9. "Ejecuta la Fase 4.8: calibración, observabilidad y casos de prueba."

---

## Objetivo general

Transformar MercadoTech en una plataforma con IA integrada: indexar productos y
artículos de soporte como vectores, ofrecer búsqueda semántica en el catálogo y
dos asistentes conversacionales (asesor de compras y soporte) que respondan
usando EXCLUSIVAMENTE la información de la plataforma, citando sus fuentes.

## Objetivos específicos

* Comprender el flujo completo de un sistema RAG.
* Configurar pgvector sobre Supabase.
* Generar embeddings de productos y FAQ con proveedor gratuito.
* Implementar indexación automática al publicar/editar contenido.
* Realizar búsqueda semántica por similitud vectorial.
* Construir contexto optimizado (selección, orden, presupuesto de tokens).
* Desarrollar la interfaz conversacional con fuentes citadas y navegables.
* Dejar la base de conocimiento lista para el agente de voz (sesión 8).

## Proveedor de IA (decisión heredada de ReadHub — respetarla)

* **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensiones)
  vía el SDK `@huggingface/inference` (`InferenceClient.featureExtraction`).
  **NO usar `fetch` contra el router REST**: no soporta feature-extraction.
* **Chat**: `meta-llama/Llama-3.1-8B-Instruct` vía el router OpenAI-compatible
  de Hugging Face. El modelo es configurable por `HUGGINGFACE_CHAT_MODEL`
  porque la disponibilidad de modelos gratuitos ROTA — si falla, probar
  candidatos contra la API real antes de elegir reemplazo.
* Toda la lógica que conoce la API del proveedor vive SOLO en `lib/ai/`.
  Cambiar de proveedor = tocar `lib/ai/` y `lib/constants/ai.ts`, nada más.
* Variables nuevas en `.env.example`: `HUGGINGFACEHUB_API_TOKEN`,
  `HUGGINGFACE_EMBEDDING_MODEL` (opcional), `HUGGINGFACE_CHAT_MODEL` (opcional).

---

# FASES

## Fase 4.1 — Infraestructura vectorial

**Prompt sugerido:** "Ejecuta la Fase 4.1 de `MercadoTech_sesion4.md`."

Migraciones nuevas (NO tocar las existentes):

1. Habilitar `vector` en el schema `extensions` (no en `public`).
2. Tabla `knowledge_embeddings` — UNA tabla para las dos fuentes, discriminada
   por tipo (más simple que dos tablas gemelas y permite búsquedas conjuntas):

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| source_type | text | check: 'producto' / 'articulo_soporte' |
| source_id | uuid | id del producto o del artículo (sin FK dura: se valida en el service; documentar el porqué: dos tablas origen distintas) |
| chunk_index | integer | default 0 (preparado para chunking futuro) |
| content | text | el texto que se vectorizó |
| embedding | vector(384) | not null |
| metadata | jsonb | default '{}' (título, categoría, precio…) |
| created_at | timestamptz | |

`unique(source_type, source_id, chunk_index)`.

3. Índice HNSW sobre `embedding` con `vector_cosine_ops`.
4. Función `match_knowledge(query_embedding vector(384), p_source_type text,
   match_count int, similarity_threshold float)` — SECURITY INVOKER (respeta la
   visibilidad del caller), `set search_path` fijado, devuelve
   `source_type, source_id, content, metadata, similarity` ordenado por similitud.
   Si `p_source_type` es null, busca en ambas fuentes.
5. RLS de `knowledge_embeddings`: SELECT para `authenticated` (los productos
   inactivos se filtran en el service cruzando con `products`); INSERT/UPDATE/
   DELETE solo service role. GRANTs correspondientes.
6. Actualizar `schema.sql`/`policies.sql` de referencia.
7. Documentar en la migración: cambiar de modelo de embeddings a otra dimensión
   exige `ALTER COLUMN ... TYPE vector(N)` + recrear índice y función.

## Fase 4.2 — Capa de IA y servicio de embeddings

**Prompt sugerido:** "Ejecuta la Fase 4.2 de `MercadoTech_sesion4.md`."

1. `lib/constants/ai.ts` — TODOS los tunables, cada uno con comentario que
   justifique el valor (patrón ReadHub):
   `EMBEDDING_DIMENSIONS = 384`, `EMBEDDING_MODEL_DEFAULT`,
   `MAX_EMBEDDING_INPUT_CHARS = 1000` (MiniLM trunca a 256 tokens en silencio),
   `VECTOR_SEARCH_DEFAULT_TOP_K = 5`, `VECTOR_SEARCH_MAX_TOP_K = 20`,
   `VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD = 0.3` (provisional, calibrar en Fase 4.8),
   `CONTEXT_BUILDER_DEFAULT_MAX_SOURCES = 5`, `CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY = 0.3`,
   `CONTEXT_BUILDER_MIN_CONTENT_LENGTH = 20`, `CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS = 8000`,
   `CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS = 200`,
   `HUGGINGFACE_CHAT_MODEL_DEFAULT`, `HUGGINGFACE_CHAT_MAX_TOKENS = 1024`,
   `CHAT_QUERY_MAX_CHARS = 4000`.
2. `lib/ai/embeddings.ts`: `generateEmbedding(text)` con el SDK oficial;
   `buildProductEmbeddingText(product, category)` (título + marca + categoría +
   condición + descripción truncada) y `buildSupportArticleEmbeddingText(article)`
   (título + contenido truncado). Validar que el vector devuelto tenga
   exactamente 384 dimensiones.
3. `lib/ai/completion.ts`: `generateCompletion(system, user)` contra el router
   OpenAI-compatible; devuelve `{text, model, stopReason}`. Manejo de errores
   con mensajes accionables (modelo no disponible ≠ token inválido).
4. `lib/ai/prompts.ts`: instrucciones de sistema para los DOS modos:
   * `SHOPPING_SYSTEM_INSTRUCTIONS`: asesor de compras; responde SOLO con los
     productos del contexto; cita fuentes numeradas; si nada es relevante lo
     dice ("no encontré productos que coincidan"); nunca inventa precios/stock.
   * `SUPPORT_SYSTEM_INSTRUCTIONS`: agente de soporte; responde SOLO con la FAQ
     del contexto; si no hay respuesta, sugiere crear un ticket; tono cordial;
     respuestas CORTAS y claras (en la sesión 8 se leerán en voz alta — dejar
     este comentario en el código).
   * `buildRagUserMessage(query, sources)` — plantilla común.
5. `services/embedding.service.ts`: orquesta — carga la fuente, construye el
   texto, genera el embedding, upsert en `knowledge_embeddings` (con el cliente
   ADMIN inyectado por el caller; el service no lo importa directamente).

## Fase 4.3 — Indexación automática

**Prompt sugerido:** "Ejecuta la Fase 4.3 de `MercadoTech_sesion4.md`."

1. Route Handler `POST /api/v1/reindex` (body: `{sourceType, sourceId}`):
   valida sesión, usa el cliente admin + `embedding.service`. Es el ÚNICO lugar
   (junto al chat) donde el navegador necesita al servidor. Respuestas de error
   consistentes (`lib/api-response.ts`: helper `apiError(status, code, message)`).
2. `services/indexing-trigger.service.ts` (lado navegador): `triggerReindex`
   — `fetch` fire-and-forget al handler; NUNCA bloquea ni rompe el flujo de
   publicación (best-effort + `console.warn` si falla).
3. Integrar el trigger en `useProductForm` (crear/editar producto) y en el
   flujo de edición de artículos de soporte (si el admin los edita por SQL,
   documentar el script de reindexación como alternativa).
4. Script one-shot `scripts/index-all.ts` (Node, con admin): indexa TODOS los
   productos activos y artículos publicados del seed — se corre una vez tras la
   migración para poblar la base vectorial inicial.

## Fase 4.4 — Búsqueda semántica en el catálogo

**Prompt sugerido:** "Ejecuta la Fase 4.4 de `MercadoTech_sesion4.md`."

1. `services/vector-search.service.ts`: `searchByEmbedding` (llama al RPC
   `match_knowledge`) y `searchProducts(query, opts)` (embedding de la consulta
   + matching + hidratación: junta con `products` activos para precio/imagen
   actuales, descartando huérfanos). El embedding de la consulta se genera
   server-side → Route Handler delgado `POST /api/v1/search/semantic`.
2. UI: la `SearchBar` del navbar gana un toggle "Búsqueda inteligente" (o la
   página de resultados muestra dos pestañas: "Coincidencia exacta" /
   "Resultados con IA"). Página `(shop)/buscar/page.tsx` con el MISMO grid de
   `ProductCard` (reutilización, no duplicación) + badge de similitud opcional.
3. `hooks/useSemanticSearch.ts`: estado de búsqueda, llama al endpoint.
4. Casos sin resultados: `EmptyState` con sugerencia de reformular.

## Fase 4.5 — Constructor de contexto

**Prompt sugerido:** "Ejecuta la Fase 4.5 de `MercadoTech_sesion4.md`."

`lib/ai/context-builder.service.ts` — función PURA, cero I/O, cero Supabase
(100% testeable en aislamiento, se testea en la sesión 6):

1. Entrada: query + resultados de búsqueda + opciones.
2. Selección: filtra por `minSimilarity` y `MIN_CONTENT_LENGTH`, ordena por
   similitud, corta a `maxSources`.
3. Presupuesto: acumula contenido hasta `maxContextChars`; si a la última
   fuente le quedan menos de `MIN_TRUNCATED_SOURCE_CHARS`, se descarta entera.
4. Salida: `{userMessage, sources[], stats: {contextTruncated, totalChars}}`
   donde `sources` conserva `source_type`, `source_id`, título y similitud
   (la UI los convierte en enlaces).

## Fase 4.6 — Servicio conversacional y endpoint

**Prompt sugerido:** "Ejecuta la Fase 4.6 de `MercadoTech_sesion4.md`."

1. `services/chat.service.ts`: `ask(query, mode: 'compras' | 'soporte', opts,
   supabase)` — orquesta SIN reimplementar nada:
   búsqueda (`vector-search`, filtrando `source_type` según modo) → contexto
   (`context-builder`) → completion (`lib/ai/completion` con las instrucciones
   del modo) → `ChatResult` estructurado:
   `{query, answer, hasRelevantContext, sources, metadata: {model, retrievedCount, usedSourceCount, contextTruncated}}`.
2. Route Handler `POST /api/v1/chat`: requiere sesión; valida body JSON, query
   no vacía y `<= CHAT_QUERY_MAX_CHARS`, `mode` válido; usa el cliente de
   SESIÓN (no admin) para que la búsqueda respete RLS; log estructurado de
   `retrievedCount/usedSourceCount/hasRelevantContext` (insumo de la Fase 4.8);
   errores 401/400/422/500 con el helper de respuestas.
3. `types/chat.ts`: `ChatMessage`, `ChatResult`, `ChatSource`.

## Fase 4.7 — Interfaz del asistente

**Prompt sugerido:** "Ejecuta la Fase 4.7 de `MercadoTech_sesion4.md`."

1. `hooks/useChat.ts` (parametrizado por modo): historial de mensajes en
   memoria, `sendMessage`, loading, errores del servidor como mensaje inline
   del asistente (nunca romper la conversación).
2. Componentes `components/chat/`: `ChatWindow`, `ChatMessage` (usuario vs
   asistente), `LoadingMessage` (indicador de escritura), `ChatInput`
   (textarea con submit por Enter, deshabilitado durante carga),
   `SourcesList` — cards de fuentes citadas: para productos → mini-card con
   imagen/precio y link a `/producto/[id]`; para FAQ → link al artículo.
3. Páginas:
   * `(shop)/asistente/page.tsx` — asesor de compras ("¿qué laptop me
     recomiendas para diseño por menos de S/ 3,500?").
   * `(shop)/soporte/page.tsx` — asistente de soporte (modo 'soporte') + lista
     "Mis tickets" debajo. Esta página se AMPLÍA con voz en la sesión 8 — el
     layout debe dejar espacio para el botón de micrófono (comentario en el código).
4. Entrada al asistente desde el navbar/UserMenu.

## Fase 4.8 — Calibración, observabilidad y casos de prueba

**Prompt sugerido:** "Ejecuta la Fase 4.8 de `MercadoTech_sesion4.md`."

1. Correr `scripts/index-all.ts` y verificar conteo de embeddings == productos
   activos + artículos publicados.
2. Ejecutar y documentar en `docs/RAG.md` los casos:

| Caso | Entrada | Resultado esperado |
|---|---|---|
| 1. Indexación automática | publicar producto nuevo por la UI | fila nueva en `knowledge_embeddings` |
| 2. Recuperación semántica | "audífonos para gimnasio" | productos de audio deportivo primero |
| 3. Respuesta contextual (compras) | "laptop liviana para la universidad" | respuesta cita 2+ productos reales con links |
| 4. Respuesta contextual (soporte) | "¿cómo devuelvo un producto?" | respuesta basada en el artículo de devoluciones, citado |
| 5. Sin información | "¿venden autos usados?" | admite que no hay resultados; soporte sugiere ticket |
| 6. Navegación desde fuentes | clic en fuente | abre el producto/artículo correcto |

3. Con los logs del endpoint, ajustar (si hace falta) los thresholds en
   `lib/constants/ai.ts`, documentando el antes/después en `docs/RAG.md`.

---

## Restricciones de la sesión

* NO implementar voz (sesión 8). NO implementar herramientas/acciones del
  agente (estado de pedido, crear ticket) — en esta sesión el chat SOLO
  responde con conocimiento indexado.
* NO usar el cliente admin fuera de Route Handlers/scripts.
* NO hardcodear tunables fuera de `lib/constants/ai.ts`.
* NO modificar migraciones existentes.
* La UI no importa `lib/ai/` — siempre a través de hooks → endpoint → service.

## Entregables

1. Migraciones vectoriales + `match_knowledge` + RLS/GRANTs.
2. `lib/ai/` completo (embeddings, completion, prompts, context-builder) +
   `lib/constants/ai.ts` documentado.
3. Servicios: embedding, vector-search, chat + trigger de indexación + script batch.
4. Endpoints: `/api/v1/reindex`, `/api/v1/search/semantic`, `/api/v1/chat`.
5. Búsqueda semántica en catálogo + páginas `asistente` y `soporte`.
6. `docs/RAG.md` con casos de prueba ejecutados y calibración.

## Criterios de aceptación de la sesión

* Los 6 casos de prueba pasan y quedan documentados.
* Sin `HUGGINGFACEHUB_API_TOKEN`, el resto de la app funciona normal y el chat
  devuelve un error controlado inline (nunca una pantalla rota).
* `grep` confirma: ningún archivo fuera de `lib/ai/` importa `@huggingface/*`.
* `npm run lint` y `tsc --noEmit` pasan.
