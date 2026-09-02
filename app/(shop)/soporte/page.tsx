"use client";

import * as React from "react";
import Link from "next/link";

import { ChatWindow } from "@/components/chat/ChatWindow";
import { LiveTranscript } from "@/components/support/LiveTranscript";
import { TicketCreatedCard } from "@/components/support/TicketCreatedCard";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import { VoiceButton } from "@/components/support/VoiceButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMyTickets } from "@/hooks/useMyTickets";
import { useSupportAgent } from "@/hooks/useSupportAgent";
import { useVoice } from "@/hooks/useVoice";

const SUGGESTIONS = [
  "¿cómo devuelvo un producto?",
  "¿en qué estado está mi último pedido?",
  "quiero hablar con una persona",
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Centro de soporte con voz (Fase 8.3).
 *
 * ESTA PÁGINA ES EL ÚNICO SITIO DONDE LA VOZ Y EL AGENTE SE ENCUENTRAN, y es
 * a propósito: `useVoice` no sabe que existe un agente y `useSupportAgent` no
 * sabe que existe un micrófono. Los une aquí, que es la regla del proyecto
 * desde la sesión 3 —los hooks se componen en las páginas, nunca entre ellos—
 * y lo que permite que la voz sirva mañana para otra cosa sin arrastrar al
 * agente detrás.
 *
 * PARIDAD TEXTO / VOZ: todo lo que se puede decir se puede escribir en la
 * misma pantalla. El micrófono es un acelerador, no un requisito: en Firefox,
 * sin permiso o sin ganas de hablar, la página funciona entera por teclado.
 */
export default function SoportePage() {
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useSupportAgent();
  const voz = useVoice();
  const {
    tickets,
    loading: ticketsLoading,
    error: ticketsError,
  } = useMyTickets(user?.id ?? null);

  /** El usuario silenció la lectura en voz alta; se respeta hasta que la reactive. */
  const [mudo, setMudo] = React.useState(false);
  /** Última respuesta, para poder repetirla sin volver a preguntar. */
  const [ultimaRespuesta, setUltimaRespuesta] = React.useState("");

  const escuchando = voz.state === "listening";

  /** Envía al agente y, si la voz está activa, lee la respuesta. */
  const enviar = React.useCallback(
    async (texto: string, porVoz: boolean) => {
      const respuesta = await sendMessage(texto, porVoz ? "voz" : "chat");
      if (!respuesta) return;
      setUltimaRespuesta(respuesta);
      // Solo se habla si el usuario llegó hablando: quien escribe no espera
      // que la pantalla le conteste en voz alta, y menos en una oficina.
      if (porVoz && !mudo) await voz.speak(respuesta);
    },
    [sendMessage, voz, mudo],
  );

  /** Interruptor del micrófono: una pulsación abre, la siguiente cierra y envía. */
  async function alternarMicrofono() {
    if (escuchando) {
      const texto = await voz.stopListening();
      if (!texto) {
        // No se entendió nada: `useVoice` ya dejó su mensaje de error y la
        // máquina vuelve a reposo. No se envía un turno vacío al agente.
        voz.cancel();
        return;
      }
      await enviar(texto, true);
      return;
    }
    await voz.startListening();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Soporte</h1>
          <p className="text-sm text-muted-foreground">
            Consulta tus pedidos, resuelve dudas de la tienda o abre un reclamo.
            Puedes escribir o hablar.
          </p>
        </header>

        <LiveTranscript text={voz.partialTranscript} listening={escuchando} />

        {voz.error ? (
          <p role="alert" className="text-sm text-destructive">
            {voz.error}
          </p>
        ) : null}

        <ChatWindow
          messages={messages}
          loading={loading || voz.state === "processing"}
          onSend={(texto) => void enviar(texto, false)}
          suggestions={SUGGESTIONS}
          emptyTitle="¿En qué te ayudamos?"
          emptyDescription="Pregunta por un pedido tuyo, por envíos y devoluciones, o pide hablar con una persona."
          inputPlaceholder="Escribe o pulsa el micrófono…"
          inputAccessory={
            <VoiceButton
              state={voz.state}
              supported={voz.isVoiceSupported}
              onToggle={() => void alternarMicrofono()}
            />
          }
          renderAction={(action) => (
            <TicketCreatedCard
              ticketId={action.ticketId}
              subject={action.subject}
            />
          )}
        />

        {ultimaRespuesta && voz.isVoiceSupported ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void voz.speak(ultimaRespuesta)}
              disabled={voz.state === "speaking"}
            >
              Repetir en voz alta
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMudo((m) => !m);
                // Silenciar corta lo que se esté diciendo AHORA: si no, el
                // botón parecería no hacer nada hasta la respuesta siguiente.
                if (!mudo) voz.cancel();
              }}
            >
              {mudo ? "Activar voz" : "Silenciar"}
            </Button>
          </div>
        ) : null}
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
            description="Si el asistente no puede resolver tu consulta, te propondrá abrir uno."
          />
        ) : (
          <ul className="flex flex-col gap-2" data-testid="my-tickets">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/soporte/tickets/${ticket.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary"
                >
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(ticket.created_at)}
                      {ticket.channel === "voz" ? " · por voz" : ""}
                    </p>
                  </div>
                  <TicketStatusBadge status={ticket.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
