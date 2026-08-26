// Tickets de soporte. Solo lectura por ahora: crear tickets desde la UI
// llega con el agente de voz (sesión 8) — aquí solo se listan los propios,
// para "Mis tickets" (Fase 4.7).

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Ticket } from "@/types/ticket";
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
