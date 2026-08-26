"use client";

import * as React from "react";
import { SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatInputProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

/** Textarea con submit por Enter (Shift+Enter = salto de línea), deshabilitado durante la carga. */
export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = React.useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className="flex items-end gap-2">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder ?? "Escribe tu pregunta…"}
        disabled={disabled}
        rows={1}
        className="min-h-10 flex-1 resize-none"
      />
      <Button
        type="button"
        size="icon"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Enviar"
      >
        <SendHorizontal className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
