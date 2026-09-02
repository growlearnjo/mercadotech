// Tickets de soporte. Hasta la sesión 7 era solo lectura ("Mis tickets",
// Fase 4.7); la sesión 8 le añade escritura, porque el agente necesita poder
// abrir un reclamo y escalar a un humano.
//
// QUIÉN ESCRIBE AQUÍ: siempre el usuario dueño del ticket, con SU sesión. La
// RLS es la que autoriza, no este archivo: por eso todas las funciones aceptan
// el cliente inyectable y ninguna usa el cliente admin.

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  Ticket,
  TicketChannel,
  TicketMessage,
  TicketSenderRole,
  TicketWithMessages,
} from "@/types/ticket";
import type { TicketStatus } from "@/lib/constants/roles";

type Client = SupabaseClient<Database>;

/** Tickets del usuario, más recientes primero. RLS ya restringe a los propios (o admin), se filtra igual por claridad. */
export async function listMine(
  userId: string,
  supabase: Client = createClient(),
): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    status: row.status as TicketStatus,
  }));
}

/**
 * Abre un ticket con su primer mensaje (sesión 8).
 *
 * Son dos inserciones y no hay transacción: PostgREST no las agrupa, y montar
 * una función SQL solo para esto sería desproporcionado. El orden importa —el
 * mensaje cuelga del ticket—, y si la segunda fallara quedaría un ticket sin
 * cuerpo: visible en "Mis tickets" y atendible por un humano, que es un estado
 * feo pero no roto. La alternativa (borrar el ticket para "limpiar") perdería
 * el rastro de que el usuario pidió ayuda, que es justo lo que no se puede
 * perder.
 */
export async function createTicket(
  userId: string,
  subject: string,
  firstMessage: string,
  channel: TicketChannel = "chat",
  supabase: Client = createClient(),
): Promise<Ticket> {
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({ user_id: userId, subject, channel })
    .select("*")
    .single();
  if (error) throw error;

  await addMessage(data.id, "usuario", firstMessage, supabase);

  return { ...data, status: data.status as TicketStatus };
}

/** Agrega un mensaje al hilo. `sender_role` distingue usuario, agente y humano. */
export async function addMessage(
  ticketId: string,
  senderRole: TicketSenderRole,
  content: string,
  supabase: Client = createClient(),
): Promise<TicketMessage> {
  const { data, error } = await supabase
    .from("ticket_messages")
    .insert({ ticket_id: ticketId, sender_role: senderRole, content })
    .select("*")
    .single();
  if (error) throw error;

  return { ...data, sender_role: data.sender_role as TicketSenderRole };
}

/** Ticket con su conversación, en orden cronológico. `null` si no existe o no es tuyo (RLS). */
export async function getTicketWithMessages(
  ticketId: string,
  supabase: Client = createClient(),
): Promise<TicketWithMessages | null> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*, ticket_messages(*)")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { ticket_messages: mensajes, ...ticket } = data;

  return {
    ...ticket,
    status: ticket.status as TicketStatus,
    messages: (mensajes ?? [])
      .map((m) => ({ ...m, sender_role: m.sender_role as TicketSenderRole }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

/**
 * Cierra un ticket.
 *
 * La RLS solo permite al dueño mover su ticket a `cerrado`: los estados
 * intermedios (`en_proceso`, `resuelto`) los decide quien atiende, no quien
 * reclama. Aquí no se comprueba nada de eso — la base es la que manda, y
 * duplicar la regla en TypeScript solo crea dos sitios donde se puede
 * desincronizar.
 */
export async function closeTicket(
  ticketId: string,
  supabase: Client = createClient(),
): Promise<Ticket> {
  const { data, error } = await supabase
    .from("support_tickets")
    .update({ status: "cerrado" })
    .eq("id", ticketId)
    .select("*")
    .single();
  if (error) throw error;

  return { ...data, status: data.status as TicketStatus };
}
