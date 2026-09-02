"use client";

import * as React from "react";
import type { ChatHistoryEntry, ChatMode, ChatResult } from "@/types/chat";

// El tipo se mudó a types/chat.ts en la sesión 8 (los componentes también lo
// necesitan y no deben importar de hooks/). Se reexporta para no romper nada.
export type { ChatHistoryEntry };

/** Historial en memoria (no persiste, decisión de alcance de la spec), parametrizado por modo. */
export function useChat(mode: ChatMode) {
  const [messages, setMessages] = React.useState<ChatHistoryEntry[]>([]);
  const [loading, setLoading] = React.useState(false);

  const sendMessage = React.useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed || loading) return;

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: trimmed },
      ]);
      setLoading(true);

      try {
        const res = await fetch("/api/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed, mode }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(
            body?.error?.message ?? "No pude procesar tu consulta, intenta de nuevo.",
          );
        }

        const result = (await res.json()) as ChatResult;
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.answer,
            sources: result.sources,
          },
        ]);
      } catch {
        // Errores del servidor (sin token, modelo caído, red) se convierten
        // en un mensaje más de la conversación — nunca en una pantalla rota.
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "No pude procesar tu consulta, intenta de nuevo.",
            isError: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [mode, loading],
  );

  return { messages, loading, sendMessage };
}
