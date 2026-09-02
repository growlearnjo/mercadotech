// Tipos del agente de soporte (sesión 8).
//
// El agente conversa por TEXTO: no hay aquí nada de audio, micrófono ni voz.
// Que un turno venga dictado o tecleado solo se nota en `channel`, y eso es a
// efectos de registro del ticket, no de comportamiento.

import type { AgentIntentName } from "@/lib/constants/support";
import type { ChatSource } from "@/types/chat";
import type { TicketChannel } from "@/types/ticket";

export type AgentIntent = AgentIntentName;

/** Un turno del historial. `assistant` incluye solo el texto, no las fuentes. */
export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Acción con efectos que el agente propone y aún NO ha ejecutado.
 *
 * Es el corazón del guardrail de confirmación: consultar un pedido es directo
 * porque solo lee, pero abrir un reclamo escribe en la base y compromete al
 * usuario, así que primero se propone y se espera un "sí".
 */
export type PendingAction = {
  type: "crear_reclamo" | "hablar_humano";
  /** Asunto propuesto para el ticket. */
  subject: string;
  /** Resumen que el agente le leyó al usuario y que este debe confirmar. */
  summary: string;
};

/** Acción con efectos ya ejecutada, para que la interfaz la muestre. */
export type AgentAction = {
  type: "ticket_creado";
  ticketId: string;
  subject: string;
};

export type AgentTurnRequest = {
  message: string;
  history?: AgentMessage[];
  /**
   * La propuesta del turno anterior, devuelta tal cual por el cliente.
   *
   * POR QUÉ VIAJA DE IDA Y VUELTA EN VEZ DE GUARDARSE EN EL SERVIDOR: una
   * confirmación tiene que sobrevivir entre dos peticiones HTTP, que no
   * comparten memoria. Guardarla en el servidor obligaría a inventar sesiones
   * de conversación en la base (con su expiración y su limpieza) para un dato
   * que vive treinta segundos. Devolviéndosela al cliente, el servidor sigue
   * sin estado y cada petición se explica sola.
   *
   * Y no abre un agujero: el `pending` solo dice QUÉ se propuso. Quién puede
   * crear el ticket lo decide la sesión y la RLS, así que manipularlo no
   * permite escribir en nombre de otro — como mucho, cambiar el asunto de tu
   * propio reclamo.
   */
  pending?: PendingAction | null;
  /** Por dónde entró el mensaje. Solo se usa al registrar el ticket. */
  channel?: TicketChannel;
};

export type AgentTurnResult = {
  /** Respuesta ya redactada, corta y pensada para ser escuchada. */
  reply: string;
  intent: AgentIntent;
  /** Fuentes de la FAQ cuando la respuesta salió del RAG. */
  sources?: ChatSource[];
  /** Presente cuando el agente EJECUTÓ algo con efectos. */
  action?: AgentAction;
  /** Presente cuando el agente PROPONE algo y espera confirmación. */
  pending?: PendingAction;
};
