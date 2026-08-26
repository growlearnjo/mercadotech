// Tipos del chat conversacional (Fase 4.6). No dependen de Supabase ni de
// lib/ai/: son la forma que exponen chat.service.ts y el endpoint hacia
// afuera, y la que consume la UI (Fase 4.7).

export type ChatMode = "compras" | "soporte";

/** Mensaje del historial de conversación (Fase 4.7 lo guarda en memoria). */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Fuente citada, ya numerada — lista para convertirse en un enlace navegable. */
export interface ChatSource {
  position: number;
  sourceType: "producto" | "articulo_soporte";
  sourceId: string;
  title: string;
  similarity: number;
  /**
   * Solo presentes cuando sourceType === 'producto': precio e imagen
   * ACTUALES del producto (Fase 4.7, mini-card de SourcesList) — no la copia
   * congelada que se usó para redactar la respuesta. `undefined` si el
   * producto ya no existe o está inactivo (ficha huérfana).
   */
  price?: number;
  imageUrl?: string | null;
}

export interface ChatResultMetadata {
  model: string;
  /** Cuántas fichas devolvió match_knowledge antes de aplicar el constructor de contexto. */
  retrievedCount: number;
  /** Cuántas de esas fichas entraron realmente al contexto que vio el LLM. */
  usedSourceCount: number;
  contextTruncated: boolean;
}

export interface ChatResult {
  query: string;
  answer: string;
  /** false cuando ninguna ficha superó el threshold: el LLM igual respondió, pero sin contexto. */
  hasRelevantContext: boolean;
  sources: ChatSource[];
  metadata: ChatResultMetadata;
}
