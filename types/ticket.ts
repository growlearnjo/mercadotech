// Tipos de dominio de tickets de soporte.
import type { Database } from "@/types/database";
import type { TicketStatus } from "@/lib/constants/roles";

/** Ticket tal como lo lista "Mis tickets" (Fase 4.7). */
export type Ticket = Database["public"]["Tables"]["support_tickets"]["Row"] & {
  status: TicketStatus;
};

/** Quién escribió un mensaje del hilo. Refleja el CHECK de la migración. */
export type TicketSenderRole = "usuario" | "agente" | "humano";

/**
 * Por dónde entró el ticket.
 *
 * Se guarda porque un reclamo dictado y uno tecleado no se leen igual: el
 * dictado llega con las marcas del habla y conviene saberlo al revisarlo.
 */
export type TicketChannel = "chat" | "voz";

export type TicketMessage =
  Database["public"]["Tables"]["ticket_messages"]["Row"] & {
    sender_role: TicketSenderRole;
  };

/** Ticket con su conversación completa, para el detalle (Fase 8.3). */
export type TicketWithMessages = Ticket & {
  messages: TicketMessage[];
};
