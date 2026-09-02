// Tests del orquestador del agente de soporte (Fase 8.2).
//
// MOCKEO DE DOS NIVELES, igual que chat.service.test.ts (decisión 7 de la
// sesión 6): Supabase se INYECTA, y `lib/ai/completion` se mockea por módulo
// porque el orquestador lo importa directo. Lo que NO se mockea es la
// orquestación en sí —clasificar, elegir herramienta, respetar la
// confirmación—, que es justo lo que estos tests existen para probar.
//
// LOS SERVICES QUE USA COMO HERRAMIENTAS (`order`, `ticket`) tampoco se
// mockean: reciben el cliente inyectado y devuelven lo que el doble les diga.
// Así el test recorre el camino real hasta la frontera de la red.
//
// POR QUÉ ESTOS CASOS: son los cinco de la especificación, y cada uno protege
// una regla que costaría cara si se rompiera — que un reclamo no se cree sin
// permiso, que el pedido se resuelva sin pedir un UUID, y que una intención
// desconocida no dispare una herramienta al azar.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/completion", () => ({
  generateCompletion: vi.fn(),
}));

// El RAG de la FAQ ya tiene sus propios tests en chat.service.test.ts: aquí
// solo importa que el orquestador lo LLAME y devuelva sus fuentes.
vi.mock("@/services/chat.service", () => ({
  ask: vi.fn(),
}));

import { generateCompletion } from "@/lib/ai/completion";
import { ask } from "@/services/chat.service";
import { runAgentTurn } from "@/services/support-agent.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";
import type { PendingAction } from "@/types/support";

const USER_ID = "u-buyer1";

/** Fila de pedido con la forma que devuelve `ORDER_SELECT` de order.service. */
function pedido(
  id: string,
  createdAt: string,
  titulo: string,
  status = "enviado",
) {
  return {
    id,
    buyer_id: USER_ID,
    status,
    total: "1399.00",
    created_at: createdAt,
    shipping_address: "Av. Siempre Viva 123",
    order_items: [
      {
        id: `${id}-i1`,
        order_id: id,
        product_id: "p1",
        title_snapshot: titulo,
        quantity: 1,
        price_snapshot: "1399.00",
      },
    ],
  };
}

/** Hace que el clasificador devuelva la etiqueta pedida. */
function clasificaComo(intent: string, respuestaFinal = "Respuesta del agente.") {
  vi.mocked(generateCompletion)
    .mockResolvedValueOnce({ text: intent, model: "llama", stopReason: "stop" })
    .mockResolvedValue({ text: respuestaFinal, model: "llama", stopReason: "stop" });
}

beforeEach(() => {
  vi.mocked(generateCompletion).mockReset();
  vi.mocked(ask).mockReset();
});

describe("runAgentTurn — clasificación", () => {
  it("cae en 'fuera_de_alcance' si el modelo devuelve una etiqueta inventada", async () => {
    // Los modelos pequeños devuelven sinónimos ("estado_del_pedido") que
    // ningún switch maneja. El camino seguro es reconocer que no se entendió,
    // nunca ejecutar una herramienta a ciegas.
    vi.mocked(generateCompletion).mockResolvedValue({
      text: "estado_del_pedido_del_usuario",
      model: "llama",
      stopReason: "stop",
    });

    const resultado = await runAgentTurn(
      { message: "hola" },
      USER_ID,
      mockSupabase({}),
    );

    expect(resultado.intent).toBe("fuera_de_alcance");
  });

  it("rescata la etiqueta aunque el modelo la envuelva en una frase", async () => {
    vi.mocked(generateCompletion).mockResolvedValueOnce({
      text: "La etiqueta es: pregunta_faq.",
      model: "llama",
      stopReason: "stop",
    });
    vi.mocked(ask).mockResolvedValue({
      query: "q",
      answer: "Puedes devolverlo en 7 días.",
      hasRelevantContext: true,
      sources: [],
      metadata: { retrievedCount: 1, usedSourceCount: 1, model: "llama", stopReason: "stop" },
    } as never);

    const resultado = await runAgentTurn(
      { message: "¿cómo devuelvo un producto?" },
      USER_ID,
      mockSupabase({}),
    );

    expect(resultado.intent).toBe("pregunta_faq");
  });

  it("responde 'fuera_de_alcance' SIN llamar al modelo para redactar", async () => {
    vi.mocked(generateCompletion).mockResolvedValue({
      text: "fuera_de_alcance",
      model: "llama",
      stopReason: "stop",
    });

    const resultado = await runAgentTurn(
      { message: "¿me venden un auto?" },
      USER_ID,
      mockSupabase({}),
    );

    expect(resultado.reply).toContain("se sale de lo que puedo ayudarte");
    // Una sola llamada: la de clasificar. Dejar que el modelo redacte aquí
    // abriría la puerta a que intente responder igualmente.
    expect(vi.mocked(generateCompletion)).toHaveBeenCalledTimes(1);
  });
});

describe("runAgentTurn — consulta de pedidos", () => {
  it("'mi último pedido' elige el más reciente, sin pedir ningún identificador", async () => {
    clasificaComo("consulta_pedido", "Tu pedido más reciente ya fue enviado.");
    const supabase = mockSupabase({
      orders: {
        select: [
          pedido("o-nuevo", "2026-08-28T10:00:00Z", "Laptop Lenovo IdeaPad"),
          pedido("o-viejo", "2026-08-01T10:00:00Z", "Mouse Razer DeathAdder"),
        ],
      },
    });

    const resultado = await runAgentTurn(
      { message: "¿en qué estado está mi último pedido?" },
      USER_ID,
      supabase,
    );

    expect(resultado.intent).toBe("consulta_pedido");
    // El pedido elegido llega al modelo dentro del mensaje de usuario: se
    // afirma sobre los DATOS entregados, que es lo que evita que invente.
    const [, mensajeUsuario] = vi.mocked(generateCompletion).mock.calls[1];
    expect(mensajeUsuario).toContain("Laptop Lenovo IdeaPad");
    expect(mensajeUsuario).not.toContain("Mouse Razer");
  });

  it("'el de la laptop' resuelve por el nombre del producto", async () => {
    clasificaComo("consulta_pedido");
    const supabase = mockSupabase({
      orders: {
        select: [
          pedido("o-1", "2026-08-28T10:00:00Z", "Mouse Razer DeathAdder"),
          pedido("o-2", "2026-08-01T10:00:00Z", "Laptop ASUS Vivobook"),
        ],
      },
    });

    await runAgentTurn(
      { message: "cómo va el pedido de la laptop" },
      USER_ID,
      supabase,
    );

    const [, mensajeUsuario] = vi.mocked(generateCompletion).mock.calls[1];
    expect(mensajeUsuario).toContain("Laptop ASUS Vivobook");
  });

  it("ante ambigüedad enumera de forma hablable y NO adivina", async () => {
    clasificaComo("consulta_pedido");
    const supabase = mockSupabase({
      orders: {
        select: [
          pedido("o-1", "2026-08-28T10:00:00Z", "Monitor LG"),
          pedido("o-2", "2026-08-01T10:00:00Z", "Teclado Logitech"),
        ],
      },
    });

    const resultado = await runAgentTurn(
      { message: "quiero saber de mi pedido" },
      USER_ID,
      supabase,
    );

    expect(resultado.reply).toContain("¿Cuál de estos?");
    expect(resultado.reply).toContain("Monitor LG");
    expect(resultado.reply).toContain("Teclado Logitech");
    // Ningún identificador: nadie puede escuchar un UUID.
    expect(resultado.reply).not.toContain("o-1");
    // La enumeración son datos reales: no se le pide al modelo que los
    // reescriba, porque podría inventar un producto que no está en la lista.
    expect(vi.mocked(generateCompletion)).toHaveBeenCalledTimes(1);
  });

  it("lo dice con claridad cuando el usuario no tiene pedidos", async () => {
    clasificaComo("consulta_pedido");
    const supabase = mockSupabase({ orders: { select: [] } });

    const resultado = await runAgentTurn(
      { message: "¿cómo va mi pedido?" },
      USER_ID,
      supabase,
    );

    expect(resultado.reply).toContain("Todavía no tienes pedidos");
  });
});

describe("runAgentTurn — FAQ", () => {
  it("delega en el RAG de la sesión 4 y devuelve sus fuentes", async () => {
    clasificaComo("pregunta_faq");
    const fuentes = [{ position: 1, title: "¿Cómo solicito la devolución?" }];
    vi.mocked(ask).mockResolvedValue({
      query: "q",
      answer: "Según [1], tienes 7 días calendario.",
      hasRelevantContext: true,
      sources: fuentes,
      metadata: { retrievedCount: 3, usedSourceCount: 1, model: "llama", stopReason: "stop" },
    } as never);

    const resultado = await runAgentTurn(
      { message: "¿cómo devuelvo un producto?" },
      USER_ID,
      mockSupabase({}),
    );

    expect(vi.mocked(ask)).toHaveBeenCalledWith(
      "¿cómo devuelvo un producto?",
      "soporte",
      {},
      expect.anything(),
    );
    expect(resultado.sources).toEqual(fuentes);
    expect(resultado.reply).toContain("[1]");
  });
});

describe("runAgentTurn — acciones con efectos", () => {
  it("un reclamo PROPONE y no crea nada todavía", async () => {
    clasificaComo("crear_reclamo");
    const supabase = mockSupabase({});

    const resultado = await runAgentTurn(
      { message: "mi laptop llegó rayada" },
      USER_ID,
      supabase,
    );

    expect(resultado.pending?.type).toBe("crear_reclamo");
    expect(resultado.reply).toContain("¿Confirmas");
    expect(resultado.action).toBeUndefined();
    // La garantía dura: no se tocó la tabla de tickets.
    expect(supabase.calls("support_tickets")).toHaveLength(0);
  });

  it("crea el ticket SOLO tras la confirmación, con el canal correcto", async () => {
    const pending: PendingAction = {
      type: "crear_reclamo",
      subject: "Reclamo: mi laptop llegó rayada",
      summary: "mi laptop llegó rayada",
    };
    const supabase = mockSupabase({
      support_tickets: {
        single: {
          id: "t-1",
          user_id: USER_ID,
          subject: pending.subject,
          status: "abierto",
          channel: "voz",
          created_at: "2026-09-02T10:00:00Z",
        },
      },
      ticket_messages: {
        single: {
          id: "m-1",
          ticket_id: "t-1",
          sender_role: "usuario",
          content: pending.summary,
          created_at: "2026-09-02T10:00:00Z",
        },
      },
    });

    const resultado = await runAgentTurn(
      { message: "sí, confirmo", pending, channel: "voz" },
      USER_ID,
      supabase,
    );

    expect(resultado.action).toEqual({
      type: "ticket_creado",
      ticketId: "t-1",
      subject: pending.subject,
    });
    // Con `pending` presente NO se vuelve a clasificar: "sí" no significa nada
    // por sí solo, su intención es la del turno anterior.
    expect(vi.mocked(generateCompletion)).not.toHaveBeenCalled();
  });

  it("un 'no' cancela la propuesta sin crear el ticket", async () => {
    const pending: PendingAction = {
      type: "crear_reclamo",
      subject: "Reclamo: algo",
      summary: "algo",
    };
    const supabase = mockSupabase({});

    const resultado = await runAgentTurn(
      { message: "no, mejor no", pending },
      USER_ID,
      supabase,
    );

    expect(resultado.action).toBeUndefined();
    expect(supabase.calls("support_tickets")).toHaveLength(0);
    // Con pending presente no se clasifica: un "no" solo cancela lo propuesto.
    expect(vi.mocked(generateCompletion)).not.toHaveBeenCalled();
  });

  it("una respuesta ambigua NO cuenta como confirmación", async () => {
    // El coste de equivocarse es asimétrico: volver a preguntar molesta, crear
    // un reclamo que nadie pidió es peor.
    const pending: PendingAction = {
      type: "crear_reclamo",
      subject: "Reclamo: algo",
      summary: "algo",
    };
    const supabase = mockSupabase({});

    const resultado = await runAgentTurn(
      { message: "mmm, déjame pensarlo", pending },
      USER_ID,
      supabase,
    );

    expect(resultado.action).toBeUndefined();
  });
});
