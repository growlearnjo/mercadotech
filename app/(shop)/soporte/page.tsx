"use client";

import { ChatWindow } from "@/components/chat/ChatWindow";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useMyTickets } from "@/hooks/useMyTickets";

const SUGGESTIONS = [
  "¿cómo devuelvo un producto?",
  "¿cuánto demora el envío?",
  "¿cómo me convierto en vendedor?",
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Soporte (modo 'soporte') + "Mis tickets" debajo. El middleware ya
 * garantiza que hay sesión en esta ruta.
 *
 * La sesión 8 amplía este layout con el botón de micrófono, junto al
 * ChatInput de texto — se deja el espacio previsto.
 */
export default function SoportePage() {
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useChat("soporte");
  const {
    tickets,
    loading: ticketsLoading,
    error: ticketsError,
  } = useMyTickets(user?.id ?? null);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Soporte</h1>
          <p className="text-sm text-muted-foreground">
            Responde con base en las preguntas frecuentes de MercadoTech.
          </p>
        </header>

        <ChatWindow
          messages={messages}
          loading={loading}
          onSend={sendMessage}
          suggestions={SUGGESTIONS}
          emptyTitle="¿En qué te ayudamos?"
          emptyDescription="Pregunta sobre envíos, devoluciones, pagos o tu cuenta."
          inputPlaceholder="Ej: ¿cómo devuelvo un producto?"
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Mis tickets</h2>

        {ticketsLoading ? (
          <LoadingState variant="list" count={2} label="Cargando tus tickets" />
        ) : ticketsError ? (
          <p className="text-sm text-destructive">{ticketsError}</p>
        ) : tickets.length === 0 ? (
          <EmptyState
            title="Aún no tienes tickets"
            description="Si el asistente no puede resolver tu consulta, te sugerirá crear uno."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(ticket.created_at)}
                  </p>
                </div>
                <TicketStatusBadge status={ticket.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
