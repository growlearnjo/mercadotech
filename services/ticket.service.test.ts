// Tests de las funciones de ESCRITURA de ticket.service (Fase 8.4).
//
// `listMine` ya existía desde la sesión 4 y no cambió; lo nuevo es lo que el
// agente necesita para abrir un reclamo y escalarlo a un humano.
//
// Supabase se INYECTA (nunca `vi.mock` de lib/supabase/*): estos tests pasan
// con Docker apagado, que es la regla de la suite unitaria desde la sesión 6.

import { describe, expect, it } from "vitest";

import {
  addMessage,
  closeTicket,
  createTicket,
  getTicketWithMessages,
} from "@/services/ticket.service";
import { dbError, mockSupabase } from "@/services/test-utils/supabase-mock";

const USER_ID = "u-buyer1";

const TICKET_FILA = {
  id: "t-1",
  user_id: USER_ID,
  subject: "Reclamo: la laptop llegó rayada",
  status: "abierto",
  channel: "chat",
  created_at: "2026-09-02T10:00:00Z",
};

const MENSAJE_FILA = {
  id: "m-1",
  ticket_id: "t-1",
  sender_role: "usuario",
  content: "la laptop llegó rayada",
  created_at: "2026-09-02T10:00:00Z",
};

describe("createTicket", () => {
  it("inserta el ticket y su primer mensaje, en ese orden", async () => {
    const supabase = mockSupabase({
      support_tickets: { single: TICKET_FILA },
      ticket_messages: { single: MENSAJE_FILA },
    });

    const ticket = await createTicket(
      USER_ID,
      TICKET_FILA.subject,
      "la laptop llegó rayada",
      "chat",
      supabase,
    );

    expect(ticket.id).toBe("t-1");
    // El orden importa: el mensaje cuelga del ticket por clave foránea.
    const tablas = supabase.calls().map((c) => c.table);
    expect(tablas).toEqual(["support_tickets", "ticket_messages"]);
  });

  it("registra el canal 'voz' cuando el reclamo se dictó", async () => {
    // No es cosmético: un reclamo dictado llega con las marcas del habla y
    // conviene saberlo al revisarlo.
    const supabase = mockSupabase({
      support_tickets: { single: { ...TICKET_FILA, channel: "voz" } },
      ticket_messages: { single: MENSAJE_FILA },
    });

    await createTicket(USER_ID, TICKET_FILA.subject, "algo", "voz", supabase);

    const [insercion] = supabase.calls("support_tickets");
    expect(insercion.payload).toMatchObject({
      user_id: USER_ID,
      channel: "voz",
    });
  });

  it("el primer mensaje se guarda como del USUARIO, no del agente", async () => {
    // Quien reclama es la persona: si se guardara como 'agente', el hilo
    // parecería iniciado por el sistema y quien lo atienda leería mal el caso.
    const supabase = mockSupabase({
      support_tickets: { single: TICKET_FILA },
      ticket_messages: { single: MENSAJE_FILA },
    });

    await createTicket(USER_ID, "asunto", "mi problema", "chat", supabase);

    const [mensaje] = supabase.calls("ticket_messages");
    expect(mensaje.payload).toMatchObject({
      sender_role: "usuario",
      content: "mi problema",
    });
  });

  it("propaga el error de Supabase tal cual si el ticket no se puede crear", async () => {
    const supabase = mockSupabase({
      support_tickets: { single: dbError("permission denied", "42501") },
    });

    await expect(
      createTicket(USER_ID, "asunto", "cuerpo", "chat", supabase),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("getTicketWithMessages", () => {
  it("devuelve la conversación ordenada cronológicamente", async () => {
    // PostgREST no garantiza el orden de una relación anidada, así que el
    // service ordena. Sin eso, la conversación se leería descolocada.
    const supabase = mockSupabase({
      support_tickets: {
        maybeSingle: {
          ...TICKET_FILA,
          ticket_messages: [
            { ...MENSAJE_FILA, id: "m-2", created_at: "2026-09-02T12:00:00Z", content: "segundo" },
            { ...MENSAJE_FILA, id: "m-1", created_at: "2026-09-02T10:00:00Z", content: "primero" },
          ],
        },
      },
    });

    const ticket = await getTicketWithMessages("t-1", supabase);

    expect(ticket?.messages.map((m) => m.content)).toEqual(["primero", "segundo"]);
  });

  it("devuelve null cuando no existe o no es tuyo", async () => {
    // La RLS no distingue los dos casos a propósito: decir "existe pero no es
    // tuyo" ya filtraría información.
    const supabase = mockSupabase({ support_tickets: { maybeSingle: null } });

    expect(await getTicketWithMessages("t-ajeno", supabase)).toBeNull();
  });
});

describe("addMessage y closeTicket", () => {
  it("addMessage guarda el rol de quien escribe", async () => {
    const supabase = mockSupabase({
      ticket_messages: { single: { ...MENSAJE_FILA, sender_role: "agente" } },
    });

    const mensaje = await addMessage("t-1", "agente", "Respuesta", supabase);

    expect(mensaje.sender_role).toBe("agente");
  });

  it("closeTicket solo pone 'cerrado', ningún otro estado", async () => {
    // Los estados intermedios los decide quien atiende, no quien reclama. La
    // RLS lo impone; este test ancla que el service no intente nada más.
    const supabase = mockSupabase({
      support_tickets: { single: { ...TICKET_FILA, status: "cerrado" } },
    });

    const ticket = await closeTicket("t-1", supabase);

    expect(ticket.status).toBe("cerrado");
    const [actualizacion] = supabase.calls("support_tickets");
    expect(actualizacion.payload).toEqual({ status: "cerrado" });
  });
});
