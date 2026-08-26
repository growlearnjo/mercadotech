// Tipos de dominio de tickets de soporte.
import type { Database } from "@/types/database";
import type { TicketStatus } from "@/lib/constants/roles";

/** Ticket tal como lo lista "Mis tickets" (Fase 4.7). Solo lectura: crear tickets llega con el agente de la sesión 8. */
export type Ticket = Database["public"]["Tables"]["support_tickets"]["Row"] & {
  status: TicketStatus;
};
