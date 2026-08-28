/**
 * #5 — ADMIN obligatorio: `ask` hace `match_knowledge` sobre
 * `knowledge_embeddings`, cuya política concede SELECT solo `to authenticated`.
 * Con anon el RAG se quedaría siempre sin contexto.
 * Requiere token de Hugging Face (embedding + completion).
 */
import { z } from "zod";
import { ask } from "@/services/chat.service";
import { createContext } from "../context";
import { safeTool } from "../lib/safe";
import { toolResult } from "../lib/tool-result";

export const askAssistantTool = {
  name: "ask_assistant",
  config: {
    title: "Preguntar a un asistente de MercadoTech",
    description:
      "¿Qué respondería la propia tienda a esta pregunta, citando sus fuentes? Ejecuta " +
      "el mismo RAG que usa la web. Modo 'compras': recomienda productos del catálogo. " +
      "Modo 'soporte': responde sobre envíos, pagos, devoluciones y cuenta según la FAQ " +
      "publicada. Devuelve la respuesta y las fuentes que la sustentan.",
    inputSchema: {
      query: z.string().min(2).describe("La pregunta, en lenguaje natural"),
      mode: z
        .enum(["compras", "soporte"])
        .describe("'compras' busca en el catálogo; 'soporte' en la FAQ"),
      topK: z.number().int().positive().max(20).optional().describe("Fuentes a recuperar"),
    },
  },
  handler: safeTool(async (input: {
    query: string;
    mode: "compras" | "soporte";
    topK?: number;
  }) => {
    const { admin } = createContext();
    const result = await ask(input.query, input.mode, { topK: input.topK }, admin);
    return toolResult(result, result.answer);
  }),
};
