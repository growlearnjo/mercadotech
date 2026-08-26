// Chat SOLO con el router OpenAI-compatible (Guía Hugging Face, lección 2):
// a diferencia de feature-extraction (embeddings.ts), Hugging Face SÍ
// documenta este endpoint como estable para fetch directo, sin su SDK.
import {
  HUGGINGFACE_CHAT_MAX_TOKENS,
  HUGGINGFACE_CHAT_MODEL_DEFAULT,
} from "@/lib/constants/ai";

const HUGGINGFACE_CHAT_COMPLETIONS_URL =
  "https://router.huggingface.co/v1/chat/completions";

export interface GenerateCompletionResult {
  text: string;
  model: string;
  stopReason: string | null;
}

interface HuggingFaceChatCompletionResponse {
  model?: string;
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string | null;
  }>;
}

/**
 * Genera una respuesta de chat con el modelo configurado
 * (HUGGINGFACE_CHAT_MODEL, o HUGGINGFACE_CHAT_MODEL_DEFAULT si no está
 * fijado). Errores distintos, mensajes distintos (lección 8 de la Guía HF):
 * 401 = token mal configurado; "model not supported"/"no provider" = el
 * modelo rotó (lección 3); respuesta sin choices = respuesta inválida del
 * proveedor. Así un alumno diagnostica leyendo el mensaje, sin leer código.
 */
export async function generateCompletion(
  systemPrompt: string,
  userMessage: string,
): Promise<GenerateCompletionResult> {
  const apiKey = process.env.HUGGINGFACEHUB_API_TOKEN;
  if (!apiKey) {
    throw new Error(
      "HUGGINGFACEHUB_API_TOKEN no está configurada. Es requerida para generar respuestas.",
    );
  }

  const model = process.env.HUGGINGFACE_CHAT_MODEL || HUGGINGFACE_CHAT_MODEL_DEFAULT;

  const response = await fetch(HUGGINGFACE_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: HUGGINGFACE_CHAT_MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (response.status === 401) {
    throw new Error(
      "Token de Hugging Face inválido o rechazado (401). Revisa HUGGINGFACEHUB_API_TOKEN en .env.local.",
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();

    if (/model[_ ]not[_ ]supported|no provider/i.test(errorBody)) {
      throw new Error(
        `El modelo de chat "${model}" ya no está disponible en el nivel gratuito de Hugging Face (rotó). ` +
          "Reemplázalo en HUGGINGFACE_CHAT_MODEL por un candidato vigente, probado contra la API real.",
      );
    }

    throw new Error(
      `Error del proveedor de chat (HTTP ${response.status}): ${errorBody}`,
    );
  }

  const payload = (await response.json()) as HuggingFaceChatCompletionResponse;
  const text = payload.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(
      "Respuesta inválida del proveedor de chat: no se encontró contenido de texto en choices[0].message.content.",
    );
  }

  return {
    text,
    model: payload.model ?? model,
    stopReason: payload.choices?.[0]?.finish_reason ?? null,
  };
}
