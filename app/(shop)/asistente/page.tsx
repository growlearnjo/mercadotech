"use client";

import { ChatWindow } from "@/components/chat/ChatWindow";
import { useChat } from "@/hooks/useChat";

/** Realistas y concretas: lo que un comprador de MercadoTech preguntaría de verdad. */
const SUGGESTIONS = [
  "¿qué laptop me recomiendas para diseño por menos de S/ 3,500?",
  "busco audífonos para hacer ejercicio en el gimnasio",
  "necesito algo para conectar mi casa a internet",
];

/**
 * Asesor de compras (modo 'compras'). El middleware ya garantiza que hay
 * sesión en esta ruta (decisión 1: la IA exige sesión).
 */
export default function AsistentePage() {
  const { messages, loading, sendMessage } = useChat("compras");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Asesor de compras</h1>
        <p className="text-sm text-muted-foreground">
          Cuéntame qué necesitas y te recomiendo productos del catálogo, citando de dónde salió cada uno.
        </p>
      </header>

      <ChatWindow
        messages={messages}
        loading={loading}
        onSend={sendMessage}
        suggestions={SUGGESTIONS}
        emptyTitle="¿En qué producto estás pensando?"
        emptyDescription="Describe para qué lo necesitas, no hace falta el nombre exacto."
        inputPlaceholder="Ej: laptop liviana para la universidad"
      />
    </div>
  );
}
