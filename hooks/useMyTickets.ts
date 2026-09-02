"use client";

import * as React from "react";

import * as ticketService from "@/services/ticket.service";
import type { Ticket } from "@/types/ticket";

/**
 * Tickets del usuario.
 *
 * `refetch` se añadió en la sesión 8 por un defecto que solo apareció usando
 * la aplicación entera: el agente creaba el reclamo, respondía "listo, lo
 * registré", y la lista de abajo seguía igual. La carga ocurría una sola vez
 * al montar y nadie la volvía a pedir, así que el usuario veía al asistente
 * afirmar algo que la pantalla desmentía.
 *
 * Lo cazó el E2E del flujo completo, no los tests unitarios: cada pieza
 * funcionaba: crear el ticket y listar tickets. Lo que faltaba era la
 * coordinación entre ambas.
 */
export function useMyTickets(userId: string | null) {
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const cargar = React.useCallback(async () => {
    if (!userId) {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setTickets(await ticketService.listMine(userId));
    } catch {
      setError("No pudimos cargar tus tickets.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  return { tickets, loading, error, refetch: cargar };
}
