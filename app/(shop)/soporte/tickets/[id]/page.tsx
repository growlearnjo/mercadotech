"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  closeTicket,
  getTicketWithMessages,
} from "@/services/ticket.service";
import type { TicketWithMessages } from "@/types/ticket";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const AUTOR: Record<string, string> = {
  usuario: "Tú",
  agente: "Asistente",
  humano: "Equipo de soporte",
};

function TicketDetail({ id }: { id: string }) {
  const [ticket, setTicket] = React.useState<TicketWithMessages | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [cerrando, setCerrando] = React.useState(false);

  const cargar = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTicket(await getTicketWithMessages(id));
    } catch {
      setError("No pudimos cargar este ticket.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cerrar() {
    setCerrando(true);
    try {
      await closeTicket(id);
      await cargar();
    } catch {
      setError("No pudimos cerrar el ticket.");
    } finally {
      setCerrando(false);
    }
  }

  if (loading) return <LoadingState variant="list" count={3} label="Cargando el ticket" />;
  if (error) return <ErrorState title="Algo salió mal" description={error} onRetry={() => void cargar()} />;

  // `null` cubre dos casos que desde fuera son el mismo: no existe, o no es
  // tuyo. La RLS no distingue a propósito — decir "existe pero no es tuyo"
  // ya filtraría información.
  if (!ticket) {
    return (
      <ErrorState
        title="Ticket no encontrado"
        description="No existe o no pertenece a tu cuenta."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5" data-testid="ticket-detail">
      <Link
        href="/soporte"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a soporte
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
          <p className="text-sm text-muted-foreground">
            Abierto el {formatDateTime(ticket.created_at)}
            {ticket.channel === "voz" ? " · por voz" : ""}
          </p>
        </div>
        <TicketStatusBadge status={ticket.status} />
      </header>

      <ul className="flex flex-col gap-3">
        {ticket.messages.map((mensaje) => (
          <li
            key={mensaje.id}
            className={cn(
              "flex flex-col gap-1 rounded-lg border border-border p-3",
              mensaje.sender_role === "usuario" && "bg-muted/40",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">
                {AUTOR[mensaje.sender_role] ?? mensaje.sender_role}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(mensaje.created_at)}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{mensaje.content}</p>
          </li>
        ))}
      </ul>

      {ticket.status !== "cerrado" ? (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void cerrar()}
            disabled={cerrando}
            data-testid="ticket-close"
          >
            {cerrando ? "Cerrando…" : "Cerrar ticket"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Detalle de un ticket con su conversación (Fase 8.3).
 *
 * Cerrar es lo ÚNICO que el dueño puede cambiar: los estados intermedios
 * (`en_proceso`, `resuelto`) los decide quien atiende. Esa regla no se
 * comprueba aquí — vive en la RLS, y duplicarla en la interfaz solo crearía
 * dos sitios donde puede desincronizarse. Si la política cambia, el botón
 * hereda el cambio.
 */
export default function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  return <TicketDetail id={id} />;
}
