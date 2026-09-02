"use client";

import * as React from "react";

import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { LoadingMessage } from "@/components/chat/LoadingMessage";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import type { ChatHistoryEntry } from "@/types/chat";

type ChatWindowProps = {
  messages: ChatHistoryEntry[];
  loading: boolean;
  onSend: (text: string) => void;
  /** Sugerencias de arranque clicables — solo se muestran sin historial todavía. */
  suggestions?: string[];
  emptyTitle: string;
  emptyDescription?: string;
  inputPlaceholder?: string;
  /**
   * Nodo que se pinta junto al campo de texto — ahí vive el botón de voz
   * (Fase 8.3). Es opcional para que /asistente siga exactamente igual: la
   * alternativa era duplicar ChatWindow, y dos copias de un chat se
   * desincronizan a la primera corrección.
   */
  inputAccessory?: React.ReactNode;
  /** Se pinta bajo un mensaje que ejecutó una acción (ej. la tarjeta del ticket). */
  renderAction?: (action: NonNullable<ChatHistoryEntry["action"]>) => React.ReactNode;
};

/** Compone la conversación completa: historial + input, con auto-scroll al último mensaje. */
export function ChatWindow({
  messages,
  loading,
  onSend,
  suggestions,
  emptyTitle,
  emptyDescription,
  inputPlaceholder,
  inputAccessory,
  renderAction,
}: ChatWindowProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex h-[32rem] flex-col rounded-lg border border-border">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <EmptyState title={emptyTitle} description={emptyDescription} />
            {suggestions && suggestions.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2 px-4">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onSend(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <div key={message.id} className="flex flex-col">
                <ChatMessage message={message} />
                {message.action && renderAction ? renderAction(message.action) : null}
              </div>
            ))}
            {loading ? <LoadingMessage /> : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-border p-3">
        <div className="min-w-0 flex-1">
          <ChatInput onSend={onSend} disabled={loading} placeholder={inputPlaceholder} />
        </div>
        {inputAccessory}
      </div>
    </div>
  );
}
