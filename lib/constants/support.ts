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

/* ------------------------------------------------------------------ *
 * Agente de soporte (sesión 8)
 * ------------------------------------------------------------------ */

/**
 * Las cinco intenciones que el agente sabe distinguir.
 *
 * Es una lista CERRADA a propósito: la clasificación se hace con un modelo de
 * lenguaje, y si se le deja inventar etiquetas devuelve sinónimos
 * ("consulta_de_pedido", "pedido", "estado_pedido") que ningún `switch` puede
 * manejar. Con la lista cerrada, cualquier respuesta que no esté aquí se trata
 * como `fuera_de_alcance`, que es el comportamiento seguro.
 *
 * `hablar_humano` existe separada de `crear_reclamo` aunque ambas terminen en
 * un ticket: quien pide un humano no siempre tiene una queja, y mezclarlas
 * haría que el agente respondiera con el tono equivocado.
 */
export const AGENT_INTENTS = [
  "consulta_pedido",
  "pregunta_faq",
  "crear_reclamo",
  "hablar_humano",
  "fuera_de_alcance",
] as const;

export type AgentIntentName = (typeof AGENT_INTENTS)[number];

/**
 * Cuántos turnos previos se le pasan al modelo.
 *
 * Hacen falta para resolver referencias: "¿y el otro pedido?" no significa
 * nada sin lo anterior. Se recortan a 6 porque cada turno se paga dos veces
 * (una al clasificar y otra al redactar) contra un modelo gratuito con cuota,
 * y porque más allá de tres intercambios el contexto útil ya no está en el
 * historial sino en la última frase.
 */
export const AGENT_MAX_HISTORY_TURNS = 6;

/**
 * Longitud máxima de la respuesta, en caracteres.
 *
 * El límite no es estético: estas respuestas SE ESCUCHAN. Un párrafo que se
 * lee en diagonal sin esfuerzo se vuelve interminable dicho en voz alta, y el
 * usuario no puede "saltar al final". 320 caracteres son unas dos frases más
 * una pregunta, que es exactamente el turno que se busca.
 */
export const AGENT_MAX_REPLY_CHARS = 320;

/**
 * Tokens máximos al clasificar la intención.
 *
 * La clasificación solo tiene que devolver UNA etiqueta, así que 12 tokens
 * sobran. Ponerlo al mínimo abarata la mitad del turno y, de paso, evita que
 * el modelo se ponga a explicar su razonamiento en vez de responder la
 * etiqueta.
 */
export const INTENT_MAX_TOKENS = 12;

/**
 * Cuántos pedidos recientes se le muestran al agente para desambiguar.
 *
 * Los identificadores son UUID y nadie los dicta por voz, así que el pedido se
 * resuelve por contexto sobre esta lista ("el último", "el de la laptop"). 5
 * cubre lo que cualquiera recuerda de sus compras recientes; enumerar más en
 * voz alta sería insufrible.
 */
export const AGENT_ORDER_CANDIDATES = 5;
