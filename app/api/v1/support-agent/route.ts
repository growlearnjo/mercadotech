import { NextResponse, type NextRequest } from "next/server";

import { apiError, errorMessage } from "@/lib/api-response";
import { CHAT_QUERY_MAX_CHARS } from "@/lib/constants/ai";
import { runAgentTurn } from "@/services/support-agent.service";
import { createClient } from "@/lib/supabase/server";
import type { AgentMessage, PendingAction } from "@/types/support";

/**
 * Endpoint del agente de soporte (sesión 8, Fase 8.2).
 *
 * Requiere sesión y usa el cliente de SESIÓN, no el admin: así el agente ve
 * exactamente lo que vería el usuario navegando la web, ni un pedido más. Es
 * la razón de que la tabla de síntomas de la spec marque como bug CRÍTICO que
 * el agente devuelva el pedido de otra persona — con este cliente y la RLS, no
 * debería poder ni queriendo.
 *
 * Recibe y devuelve TEXTO. No sabe si el mensaje se dictó o se tecleó; eso
 * viaja en `channel` y solo se usa al registrar un ticket.
 */

function esHistorial(valor: unknown): valor is AgentMessage[] {
  return (
    Array.isArray(valor) &&
    valor.every(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as AgentMessage).role !== undefined &&
        ((m as AgentMessage).role === "user" ||
          (m as AgentMessage).role === "assistant") &&
        typeof (m as AgentMessage).content === "string",
    )
  );
}

function esPending(valor: unknown): valor is PendingAction {
  if (typeof valor !== "object" || valor === null) return false;
  const p = valor as PendingAction;
  return (
    (p.type === "crear_reclamo" || p.type === "hablar_humano") &&
    typeof p.subject === "string" &&
    typeof p.summary === "string"
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError(
      401,
      "unauthorized",
      "Debes iniciar sesión para usar el asistente de soporte.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_body", "El cuerpo debe ser JSON válido.");
  }

  const { message, history, pending, channel } = (body ?? {}) as {
    message?: unknown;
    history?: unknown;
    pending?: unknown;
    channel?: unknown;
  };

  if (typeof message !== "string" || message.trim() === "") {
    return apiError(400, "invalid_message", "message es requerido.");
  }
  if (message.length > CHAT_QUERY_MAX_CHARS) {
    return apiError(
      422,
      "message_too_long",
      `message no puede superar ${CHAT_QUERY_MAX_CHARS} caracteres.`,
    );
  }

  try {
    const result = await runAgentTurn(
      {
        message,
        history: esHistorial(history) ? history : [],
        pending: esPending(pending) ? pending : null,
        channel: channel === "voz" ? "voz" : "chat",
      },
      user.id,
      supabase,
    );

    // Observabilidad del agente: sin esto, "el agente contestó raro" no se
    // puede diagnosticar. Se registra QUÉ decidió, nunca lo que dijo el
    // usuario ni lo que respondió — un ticket de soporte puede contener datos
    // personales y los logs no son el sitio.
    console.log(
      JSON.stringify({
        endpoint: "support-agent",
        intent: result.intent,
        hasAction: Boolean(result.action),
        pendingType: result.pending?.type ?? null,
        sourceCount: result.sources?.length ?? 0,
        channel: channel === "voz" ? "voz" : "chat",
      }),
    );

    return NextResponse.json(result);
  } catch (err) {
    return apiError(
      500,
      "agent_failed",
      errorMessage(err, "Error desconocido al conversar con el agente."),
    );
  }
}
