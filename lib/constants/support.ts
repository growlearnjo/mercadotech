// Tunables de soporte. Regla 5 del CLAUDE.md: cada valor con su justificación.

import type { TicketStatus } from "@/lib/constants/roles";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
};

/**
 * Color del badge por estado, siempre vía tokens de globals.css — mismo
 * criterio que ORDER_STATUS_CLASSES: `abierto` neutro (recién creado),
 * `en_proceso` el azul de marca (alguien lo está atendiendo), `resuelto` el
 * verde de éxito, `cerrado` un gris apagado (ya no requiere acción).
 */
export const TICKET_STATUS_CLASSES: Record<TicketStatus, string> = {
  abierto: "bg-secondary text-secondary-foreground",
  en_proceso: "bg-primary text-primary-foreground",
  resuelto: "bg-success text-success-foreground",
  cerrado: "bg-muted text-muted-foreground",
};
