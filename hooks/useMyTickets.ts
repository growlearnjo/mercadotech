"use client";

import * as React from "react";

import * as ticketService from "@/services/ticket.service";
import type { Ticket } from "@/types/ticket";

export function useMyTickets(userId: string | null) {
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!userId) {
      setTickets([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    ticketService
      .listMine(userId)
      .then((data) => {
        if (active) setTickets(data);
      })
      .catch(() => {
        if (active) setError("No pudimos cargar tus tickets.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return { tickets, loading, error };
}
