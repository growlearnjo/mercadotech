// Tunables de la capa de IA (sesión 4, RAG con Hugging Face). Los valores y
// sus porqués vienen calibrados del proyecto anterior del curso (ReadHub,
// packages/ai/), que se golpeó con estas mismas esquinas primero. Ningún
// tunable se hardcodea fuera de este archivo (criterio de aceptación de la
// sesión).

/**
 * Dimensión del vector que produce el modelo de embeddings elegido
 * (sentence-transformers/all-MiniLM-L6-v2). Queda grabada en la columna SQL
 * `knowledge_embeddings.embedding vector(384)` y en la firma de
 * `match_knowledge`. Cambiar de modelo a otra dimensión exige una migración
 * (`ALTER COLUMN ... TYPE vector(N)` + recrear índice y función), no solo
 * cambiar esta constante.
 */
export const EMBEDDING_DIMENSIONS = 384;

/**
 * Modelo de embeddings por defecto. Decisión cerrada (Guía Hugging Face de
 * la spec): se usa vía SDK (`InferenceClient.featureExtraction`), nunca
 * fetch directo — Hugging Face no expone feature-extraction en su router
 * OpenAI-compatible.
 */
export const EMBEDDING_MODEL_DEFAULT = "sentence-transformers/all-MiniLM-L6-v2";

/**
 * all-MiniLM-L6-v2 acepta máximo 256 tokens (~1000 caracteres) y trunca en
 * SILENCIO lo que sobra. Por eso el texto a vectorizar se arma con las
 * señales más valiosas primero (título, marca, categoría) y el contenido
 * largo al final: si algo se corta, se corta lo menos importante.
 */
export const MAX_EMBEDDING_INPUT_CHARS = 1000;

/** Cuántas fichas trae por defecto una búsqueda semántica (pestaña IA, chat). */
export const VECTOR_SEARCH_DEFAULT_TOP_K = 5;

/** Tope duro de fichas por consulta, aunque el caller pida más. */
export const VECTOR_SEARCH_MAX_TOP_K = 20;

/**
 * Similitud mínima (coseno, 0-1) para considerar un resultado relevante.
 * Calibrado en la Fase 4.8 con datos reales (ver docs/RAG.md, sección
 * "Calibración"): con 0.3, consultas sin relación ("¿venden autos usados?",
 * "recomiéndame una pizza") seguían trayendo 5 productos por encima del
 * umbral (0.32-0.35) — ruido, no señal. Subido a 0.38: sigue sin cortar el
 * caso canónico "audífonos para el gimnasio" (su mejor match es 0.421) y
 * corta ambos casos de ruido (su mejor match, 0.354 y 0.322, queda por
 * debajo). Sigue siendo IMPERFECTO para el modo soporte — el vocabulario
 * compartido entre artículos de FAQ hace que hasta preguntas absurdas
 * ("cuéntame un chiste") superen 0.38 (0.431); ahí la última defensa es que
 * SUPPORT_SYSTEM_INSTRUCTIONS ya le pide al modelo admitir cuando el
 * contexto no sirve, y en la práctica lo hace (ver docs/RAG.md, Caso 5).
 */
export const VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD = 0.38;

/** Máximo de fuentes que entran al contexto del LLM, tras ordenar por similitud. */
export const CONTEXT_BUILDER_DEFAULT_MAX_SOURCES = 5;

/** Mismo umbral que la búsqueda vectorial (calibrado en la Fase 4.8, ver arriba): el contexto no debe incluir ruido que la propia búsqueda ya descartaría. */
export const CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY = 0.38;

/** Bajo este largo, una ficha es demasiado corta para aportar contexto útil (ej. un título suelto). */
export const CONTEXT_BUILDER_MIN_CONTENT_LENGTH = 20;

/** Presupuesto de caracteres para todo el contexto combinado que recibe el LLM. */
export const CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS = 8000;

/**
 * Si al truncar por presupuesto a la última fuente le quedan menos
 * caracteres que esto, se descarta ENTERA en vez de recortarla: media frase
 * confunde más de lo que aporta.
 */
export const CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS = 200;

/**
 * Modelo de chat por defecto. Configurable por HUGGINGFACE_CHAT_MODEL
 * (Guía HF, lección 3): los modelos gratuitos de Hugging Face rotan sin
 * aviso — zephyr-7b-beta, Qwen2.5-7B-Instruct y Mistral-7B-Instruct-v0.3 ya
 * se quedaron sin proveedor de inferencia gratuito cuando ReadHub los probó.
 * Si este también rota, se reemplaza SOLO la variable de entorno.
 */
export const HUGGINGFACE_CHAT_MODEL_DEFAULT = "meta-llama/Llama-3.1-8B-Instruct";

/** Tope de tokens de salida del modelo de chat — respuestas cortas por diseño (se leerán en voz alta desde la sesión 8). */
export const HUGGINGFACE_CHAT_MAX_TOKENS = 1024;

/** Largo máximo de una consulta de chat/búsqueda semántica antes de rechazarla con 400/422. */
export const CHAT_QUERY_MAX_CHARS = 4000;
