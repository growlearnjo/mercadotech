import Link from "next/link";
import { TicketCheck } from "lucide-react";

type TicketCreatedCardProps = {
  ticketId: string;
  subject: string;
};

/**
 * Confirmación visible de un ticket recién creado (Fase 8.3).
 *
 * POR QUÉ NO BASTA CON QUE EL AGENTE LO DIGA: el agente responde "listo,
 * registré tu reclamo" y esa frase se la lleva el viento — sobre todo si se
 * escuchó en voz alta. Esta tarjeta deja constancia de que algo se ESCRIBIÓ en
 * el sistema, y un enlace para comprobarlo. Es la diferencia entre creer que
 * pasó y poder verlo.
 */
export function TicketCreatedCard({ ticketId, subject }: TicketCreatedCardProps) {
  return (
    <div
      className="mt-2 flex items-start gap-2 rounded-md border border-success/40 bg-success/10 p-3"
      data-testid="ticket-created-card"
    >
      <TicketCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">Ticket creado</p>
        <p className="text-xs text-muted-foreground">{subject}</p>
        <Link
          href={`/soporte/tickets/${ticketId}`}
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Ver el ticket
        </Link>
      </div>
    </div>
  );
}
