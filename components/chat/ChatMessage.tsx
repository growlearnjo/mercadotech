import { cn } from "@/lib/utils";
import { SourcesList } from "@/components/chat/SourcesList";
import type { ChatHistoryEntry } from "@/types/chat";

type ChatMessageProps = {
  message: ChatHistoryEntry;
};

/** Burbuja usuario vs asistente. Puro: solo recibe el mensaje, no conoce el endpoint. */
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
          message.isError &&
            "border border-destructive/50 bg-destructive/10 text-destructive",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.sources ? <SourcesList sources={message.sources} /> : null}
      </div>
    </div>
  );
}
