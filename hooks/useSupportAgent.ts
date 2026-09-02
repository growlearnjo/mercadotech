"use client";

import * as React from "react";

import type { ChatHistoryEntry } from "@/types/chat";
import type {
  AgentMessage,
  AgentTurnResult,
  PendingAction,
} from "@/types/support";
import type { TicketChannel } from "@/types/ticket";

/**
 * Conversación con el agente de soporte (Fase 8.3).
 *
 * Es primo de `useChat`, que se deja INTACTO para `/asistente`: aquel habla
 * con el RAG de la sesión 4 y no tiene intenciones, acciones ni
 * confirmaciones. Compartir un hook para ambos habría significado llenarlo de
 * condicionales por un ahorro de veinte líneas.
 *
 * NO SABE NADA DE VOZ. Recibe texto y devuelve texto, igual que el orquestador
 * del servidor. Quien une la voz con el agente es la página.
 */
export function useSupportAgent() {
  const [messages, setMessages] = React.useState<ChatHistoryEntry[]>([]);
  const [loading, setLoading] = React.useState(false);

  /**
   * La acción que el agente propuso y espera que confirmemos.
   *
   * Se guarda aquí y se REENVÍA en la siguiente petición. El servidor no
   * recuerda nada entre llamadas —y así debe seguir—, así que el cliente es
   * quien sostiene el hilo de la conversación durante los treinta segundos
   * que dura una confirmación.
   */
  const [pending, setPending] = React.useState<PendingAction | null>(null);

  /** Historial en el formato que espera el orquestador (sin ids ni fuentes). */
  const historyRef = React.useRef<AgentMessage[]>([]);

  const sendMessage = React.useCallback(
    async (text: string, channel: TicketChannel = "chat"): Promise<string> => {
      const limpio = text.trim();
      if (!limpio || loading) return "";

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: limpio },
      ]);
      historyRef.current = [
        ...historyRef.current,
        { role: "user", content: limpio },
      ];
      setLoading(true);

      try {
        const res = await fetch("/api/v1/support-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: limpio,
            history: historyRef.current,
            pending,
            channel,
          }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(
            body?.error?.message ?? "No pude procesar tu mensaje, intenta de nuevo.",
          );
        }

        const result = (await res.json()) as AgentTurnResult;

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.reply,
            sources: result.sources,
            action: result.action,
          },
        ]);
        historyRef.current = [
          ...historyRef.current,
          { role: "assistant", content: result.reply },
        ];

        // Si el agente propuso algo, queda armado para el turno siguiente; si
        // no, se limpia. Sin este `?? null`, una confirmación vieja seguiría
        // viva y un "sí" a otra cosa crearía un ticket que nadie pidió.
        setPending(result.pending ?? null);

        // Se devuelve el texto para que la página pueda LEERLO en voz alta.
        // El hook no habla: solo entrega lo que hay que decir.
        return result.reply;
      } catch (err) {
        // Mismo patrón que `useChat`: los fallos del servidor se convierten en
        // un mensaje más de la conversación, nunca en una pantalla rota.
        const mensaje =
          err instanceof Error
            ? err.message
            : "No pude procesar tu mensaje, intenta de nuevo.";
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: mensaje,
            isError: true,
          },
        ]);
        return "";
      } finally {
        setLoading(false);
      }
    },
    [loading, pending],
  );

  return { messages, loading, pending, sendMessage };
}
