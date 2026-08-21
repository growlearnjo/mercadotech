// Roles y estados del dominio MercadoTech. Única fuente de verdad: los
// checks SQL de las migraciones (Fase 2.2) deben coincidir con estos valores.

export const USER_ROLES = ["buyer", "seller", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ORDER_STATUSES = [
  "pendiente",
  "pagado",
  "enviado",
  "entregado",
  "cancelado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TICKET_STATUSES = [
  "abierto",
  "en_proceso",
  "resuelto",
  "cerrado",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const PRODUCT_CONDITIONS = [
  "nuevo",
  "usado",
  "reacondicionado",
] as const;
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];
