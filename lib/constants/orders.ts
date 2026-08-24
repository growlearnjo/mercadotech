// Tunables de pedidos. Regla 5 del CLAUDE.md: cada valor con su justificación.

import type { OrderStatus } from "@/lib/constants/roles";

/**
 * Secuencia normal de un pedido.
 *
 * NO incluye `cancelado`: no es un paso del flujo sino una salida lateral, y
 * además la RLS del vendedor solo admite pagado/enviado/entregado (decisión 9).
 * El hook del kanban usa este array para saber cuál es el siguiente estado
 * válido; la RLS valida el destino, no la secuencia.
 */
export const ORDER_STATUS_FLOW = [
  "pendiente",
  "pagado",
  "enviado",
  "entregado",
] as const;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/**
 * Color del badge por estado, siempre vía tokens de globals.css.
 *
 * `pendiente` es neutro (aún no pasa nada), `pagado` usa el azul de marca
 * (avanza), `enviado` el mismo azul más tenue, `entregado` el verde de éxito
 * y `cancelado` el rojo destructivo.
 */
export const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  pendiente: "bg-secondary text-secondary-foreground",
  pagado: "bg-primary text-primary-foreground",
  enviado: "bg-accent text-accent-foreground",
  entregado: "bg-success text-success-foreground",
  cancelado: "bg-destructive text-destructive-foreground",
};

/** Estados a los que el VENDEDOR puede mover un pedido (decisión 9). */
export const SELLER_ASSIGNABLE_STATUSES = [
  "pagado",
  "enviado",
  "entregado",
] as const;
