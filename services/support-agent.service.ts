/**
 * Orquestador del agente de soporte (sesión 8, Fase 8.2).
 *
 * EL AGENTE NO SABE QUE EXISTE LA VOZ: recibe texto, devuelve texto. Que el
 * usuario haya dictado o tecleado no cambia una sola decisión de este archivo
 * —solo queda anotado en `channel` al abrir un ticket—, y por eso el mismo
 * orquestador serviría mañana para WhatsApp o una app móvil sin tocarlo.
 *
 * QUÉ HACE EN CADA TURNO:
 *   1. Si había una acción propuesta y el usuario responde, la resuelve.
 *   2. Clasifica la intención con el modelo.
 *   3. Ejecuta la herramienta que corresponda.
 *   4. Redacta una respuesta corta y hablable.
 *
 * SUS "HERRAMIENTAS" NO SON CÓDIGO NUEVO: cada una llama a un service que ya
 * existía. El agente jamás toca Supabase directamente, y por eso hereda gratis
 * las mismas reglas de seguridad que la web — con el cliente de SESIÓN y la
 * RLS, preguntarle por el pedido de otro devuelve lo mismo que buscarlo por la
 * interfaz: nada.
 *
 * SOBRE LA "REUTILIZACIÓN DEL MCP" que anotó la sesión 5: lo que se reutiliza
 * es el SERVICE subyacente (`order.service`), no la tool `get_order_status`
 * del servidor MCP. Este orquestador corre dentro de Next y no habla el
 * protocolo MCP; aquella tool sigue existiendo para clientes MCP externos.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateCompletion } from "@/lib/ai/completion";
import {
  INTENT_CLASSIFIER_INSTRUCTIONS,
  SUPPORT_AGENT_INSTRUCTIONS,
} from "@/lib/ai/prompts";
import {
  AGENT_INTENTS,
  AGENT_MAX_HISTORY_TURNS,
  AGENT_MAX_REPLY_CHARS,
  AGENT_ORDER_CANDIDATES,
} from "@/lib/constants/support";
import { ORDER_STATUS_LABELS } from "@/lib/constants/orders";
import { ask } from "@/services/chat.service";
import { listMyOrders } from "@/services/order.service";
import { createTicket } from "@/services/ticket.service";
import type { Database } from "@/types/database";
import type { Order } from "@/types/order";
import type {
  AgentIntent,
  AgentMessage,
  AgentTurnRequest,
  AgentTurnResult,
  PendingAction,
} from "@/types/support";

type Client = SupabaseClient<Database>;

/* ------------------------------------------------------------------ *
 * Utilidades de conversación
 * ------------------------------------------------------------------ */

/**
 * Minúsculas y sin tildes, para comparar como habla la gente.
 *
 * NO es cosmético: en JavaScript `\b` marca el límite entre `\w` y no-`\w`, y
 * `\w` NO incluye las vocales acentuadas. Por eso una expresión como
 * `/\búltim/` **nunca** coincide con "mi último pedido" — la `ú` no cuenta
 * como letra y no hay frontera de palabra donde se la espera. Lo destapó el
 * test de "mi último pedido", que caía en la rama de ambigüedad.
 *
 * Normalizar de entrada resuelve además el caso real de quien escribe sin
 * tildes, que en un chat es la mayoría.
 */
function sinAcentos(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Convierte el historial recortado en texto plano para el modelo. */
function formatHistory(history: AgentMessage[]): string {
  if (history.length === 0) return "";
  const turnos = history
    .slice(-AGENT_MAX_HISTORY_TURNS)
    .map((m) => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content}`)
    .join("\n");
  return `Conversación previa:\n${turnos}\n\n`;
}

/**
 * ¿El usuario aceptó la propuesta?
 *
 * Se resuelve con palabras y no preguntándole al modelo por dos razones: una
 * confirmación es una decisión con efectos y no debe depender de que un modelo
 * probabilístico esté de buen humor, y además ahorra una llamada entera.
 *
 * Ante la duda se responde `false`: si no queda claro que dijo que sí, no se
 * crea nada. El coste de equivocarse es asimétrico — volver a preguntar
 * molesta, crear un reclamo que nadie pidió es peor.
 */
function esConfirmacion(mensaje: string): boolean {
  // Normalizado: quien confirma por escrito rara vez pone la tilde de "sí".
  const texto = sinAcentos(mensaje).trim();
  const NEGACIONES = /\b(no|cancela|cancelar|olvidalo|nada|espera)\b/;
  if (NEGACIONES.test(texto)) return false;
  return /\b(si|claro|confirmo|confirma|dale|ok|okay|de acuerdo|correcto|hazlo|adelante|por favor|perfecto)\b/.test(
    texto,
  );
}

/** Recorta la respuesta a lo que se puede escuchar sin perder el hilo. */
function recortar(texto: string): string {
  const limpio = texto.trim();
  if (limpio.length <= AGENT_MAX_REPLY_CHARS) return limpio;
  // Se corta en el último punto que quepa: dejar una frase a medias suena peor
  // que quedarse corto.
  const cortado = limpio.slice(0, AGENT_MAX_REPLY_CHARS);
  const ultimoPunto = cortado.lastIndexOf(".");
  return ultimoPunto > 80 ? cortado.slice(0, ultimoPunto + 1) : `${cortado.trim()}…`;
}

/* ------------------------------------------------------------------ *
 * 1. Clasificación de intención
 * ------------------------------------------------------------------ */

function esIntencionConocida(valor: string): valor is AgentIntent {
  return (AGENT_INTENTS as readonly string[]).includes(valor);
}

/**
 * Pide al modelo UNA etiqueta y la valida contra la lista cerrada.
 *
 * Ante cualquier respuesta inesperada devuelve `fuera_de_alcance`, que es el
 * camino seguro: el agente dice honestamente que no puede con eso, en vez de
 * ejecutar una herramienta equivocada.
 */
export async function classifyIntent(
  message: string,
  history: AgentMessage[] = [],
): Promise<AgentIntent> {
  const { text } = await generateCompletion(
    INTENT_CLASSIFIER_INSTRUCTIONS,
    `${formatHistory(history)}Mensaje del usuario: ${message}`,
  );

  // El modelo a veces devuelve la etiqueta con comillas, punto final o
  // envuelta en una frase; se busca la primera que aparezca.
  const normalizado = text.toLowerCase().replace(/[^a-z_\s]/g, " ");
  const encontrada = AGENT_INTENTS.find((intent) => normalizado.includes(intent));
  if (encontrada) return encontrada;

  const primera = normalizado.trim().split(/\s+/)[0] ?? "";
  return esIntencionConocida(primera) ? primera : "fuera_de_alcance";
}

/* ------------------------------------------------------------------ *
 * 2. Herramienta: consulta de pedidos
 * ------------------------------------------------------------------ */

/** Fecha hablable: "18 de agosto", no "2026-08-18T14:32:00Z". */
function fechaHablable(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
  });
}

/** Descripción de un pedido pensada para ser escuchada, nunca su id. */
function describirPedido(order: Order): string {
  const primero = order.items[0]?.title_snapshot ?? "sin productos";
  const resto = order.items.length > 1 ? ` y ${order.items.length - 1} más` : "";
  return `del ${fechaHablable(order.created_at)}, ${primero}${resto}, estado ${ORDER_STATUS_LABELS[order.status].toLowerCase()}`;
}

/**
 * Elige de qué pedido habla el usuario, SIN pedirle nunca un identificador.
 *
 * Los ids son UUID y nadie dicta "ce cero cero cero...". Se resuelve como lo
 * haría una persona: por recencia ("el último") o por lo que contiene ("el de
 * la laptop"). Si nada desempata, no se adivina — se enumera y se pregunta.
 */
function elegirPedido(
  mensaje: string,
  pedidos: Order[],
): { pedido: Order } | { ambiguo: Order[] } | null {
  if (pedidos.length === 0) return null;

  const texto = sinAcentos(mensaje);

  // "el último", "el más reciente", "mi pedido" a secas → el más nuevo.
  // `listMyOrders` ya los devuelve ordenados por fecha descendente.
  if (/\b(ultim|reciente|nuevo)/.test(texto)) {
    return { pedido: pedidos[0] };
  }

  // "el de la laptop": se busca la palabra dentro de los productos del pedido.
  // Se ignoran las palabras cortas para que "de", "la" o "mi" no emparejen
  // con todo, y las genéricas de la propia pregunta ("pedido", "estado"), que
  // si no emparejarían con cualquier cosa por accidente.
  const GENERICAS = new Set([
    "pedido",
    "pedidos",
    "estado",
    "compra",
    "compras",
    "orden",
    "saber",
    "quiero",
    "esta",
    "como",
  ]);
  const palabras = texto
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 4 && !GENERICAS.has(p));

  const coincidencias = pedidos.filter((order) =>
    order.items.some((item) => {
      const titulo = sinAcentos(item.title_snapshot);
      return palabras.some((palabra) => titulo.includes(palabra));
    }),
  );

  if (coincidencias.length === 1) return { pedido: coincidencias[0] };
  if (coincidencias.length > 1) return { ambiguo: coincidencias };

  // Sin pistas: con un solo pedido no hay nada que desambiguar.
  if (pedidos.length === 1) return { pedido: pedidos[0] };

  return { ambiguo: pedidos.slice(0, AGENT_ORDER_CANDIDATES) };
}

async function responderConsultaPedido(
  message: string,
  history: AgentMessage[],
  userId: string,
  supabase: Client,
): Promise<AgentTurnResult> {
  const pedidos = await listMyOrders(userId, supabase);
  const eleccion = elegirPedido(message, pedidos);

  if (eleccion === null) {
    return {
      intent: "consulta_pedido",
      reply:
        "Todavía no tienes pedidos en tu cuenta. Cuando hagas tu primera compra podré contarte cómo va.",
    };
  }

  if ("ambiguo" in eleccion) {
    const lista = eleccion.ambiguo
      .map((order, i) => `${i + 1}. Pedido ${describirPedido(order)}`)
      .join("\n");
    // Esta respuesta NO pasa por el modelo: es una enumeración de datos
    // reales, y hacer que un LLM la reescriba solo añade latencia y riesgo de
    // que se invente un producto que no está en la lista.
    return {
      intent: "consulta_pedido",
      reply: `Tienes varios pedidos. ¿Cuál de estos?\n${lista}`,
    };
  }

  const { pedido } = eleccion;
  const datos = [
    `Pedido realizado el ${fechaHablable(pedido.created_at)}.`,
    `Estado actual: ${ORDER_STATUS_LABELS[pedido.status]}.`,
    `Productos: ${pedido.items.map((i) => `${i.quantity} × ${i.title_snapshot}`).join(", ")}.`,
    `Total: S/ ${pedido.total.toFixed(2)}.`,
  ].join("\n");

  const { text } = await generateCompletion(
    SUPPORT_AGENT_INSTRUCTIONS,
    `${formatHistory(history)}El usuario pregunta: ${message}\n\n` +
      `DATOS REALES DE SU PEDIDO (única fuente permitida):\n${datos}\n\n` +
      "Cuéntaselo en dos frases como máximo.",
  );

  return { intent: "consulta_pedido", reply: recortar(text) };
}

/* ------------------------------------------------------------------ *
 * 3. Herramienta: FAQ (reutiliza el RAG de la sesión 4)
 * ------------------------------------------------------------------ */

async function responderFaq(
  message: string,
  supabase: Client,
): Promise<AgentTurnResult> {
  // El pipeline de la sesión 4 tal cual: embedding → búsqueda vectorial →
  // contexto → respuesta con fuentes. No se reimplementa nada.
  const resultado = await ask(message, "soporte", {}, supabase);

  return {
    intent: "pregunta_faq",
    reply: recortar(resultado.answer),
    sources: resultado.sources,
  };
}

/* ------------------------------------------------------------------ *
 * 4. Herramientas con efectos: reclamo y escalamiento
 * ------------------------------------------------------------------ */

/** Asunto corto a partir del mensaje: es lo que verá quien atienda el ticket. */
function proponerAsunto(mensaje: string, prefijo: string): string {
  const limpio = mensaje.trim().replace(/\s+/g, " ");
  const corto = limpio.length > 60 ? `${limpio.slice(0, 57)}...` : limpio;
  return `${prefijo}: ${corto}`;
}

/**
 * Propone la acción y espera el "sí" del turno siguiente.
 *
 * Aquí NO se crea nada. Es la regla dura de la sesión: consultar es directo
 * porque solo lee, pero todo lo que escribe pasa antes por el usuario. Y la
 * propuesta se le lee en voz alta, así que tiene que entenderse de oído.
 */
function proponerAccion(
  intent: "crear_reclamo" | "hablar_humano",
  message: string,
): AgentTurnResult {
  const esEscalamiento = intent === "hablar_humano";

  const pending: PendingAction = {
    type: intent,
    subject: proponerAsunto(message, esEscalamiento ? "Escalamiento" : "Reclamo"),
    summary: message.trim(),
  };

  const reply = esEscalamiento
    ? "Puedo abrir un ticket para que una persona del equipo te contacte y revise tu caso. ¿Lo confirmo?"
    : `Voy a registrar tu reclamo con este resumen: "${recortar(message)}". ¿Confirmas que lo abra?`;

  return { intent, reply, pending };
}

/** Ejecuta la acción ya confirmada. */
async function ejecutarAccion(
  pending: PendingAction,
  userId: string,
  channel: "chat" | "voz",
  supabase: Client,
): Promise<AgentTurnResult> {
  const ticket = await createTicket(
    userId,
    pending.subject,
    pending.summary,
    channel,
    supabase,
  );

  return {
    intent: pending.type,
    reply:
      pending.type === "hablar_humano"
        ? "Listo, abrí el ticket y una persona del equipo lo revisará. Puedes seguirlo desde Mis tickets."
        : "Listo, registré tu reclamo. Puedes seguirlo desde Mis tickets y te responderán por ahí.",
    action: { type: "ticket_creado", ticketId: ticket.id, subject: ticket.subject },
  };
}

/* ------------------------------------------------------------------ *
 * Turno completo
 * ------------------------------------------------------------------ */

export async function runAgentTurn(
  request: AgentTurnRequest,
  userId: string,
  supabase: Client,
): Promise<AgentTurnResult> {
  const { message, history = [], pending = null, channel = "chat" } = request;

  // PASO 1 — resolver una confirmación pendiente. Va ANTES de clasificar
  // porque "sí" no significa nada por sí solo: su intención es la del turno
  // anterior, no una nueva.
  if (pending) {
    if (esConfirmacion(message)) {
      return ejecutarAccion(pending, userId, channel, supabase);
    }
    return {
      intent: pending.type,
      reply:
        "De acuerdo, no lo registro. ¿Quieres que te ayude con otra cosa o prefieres contármelo de otra forma?",
    };
  }

  // PASO 2 — clasificar.
  const intent = await classifyIntent(message, history);

  // PASO 3 — la herramienta que corresponda.
  switch (intent) {
    case "consulta_pedido":
      return responderConsultaPedido(message, history, userId, supabase);

    case "pregunta_faq":
      return responderFaq(message, supabase);

    case "crear_reclamo":
    case "hablar_humano":
      return proponerAccion(intent, message);

    case "fuera_de_alcance":
    default:
      // Respuesta fija, sin pasar por el modelo: reconocer los límites con
      // honestidad y reencuadrar qué SÍ puede hacer. Dejárselo al modelo abre
      // la puerta a que intente responder igualmente.
      return {
        intent: "fuera_de_alcance",
        reply:
          "Eso se sale de lo que puedo ayudarte aquí. Puedo contarte cómo va un pedido tuyo, resolver dudas de envíos, pagos o devoluciones, o abrirte un reclamo.",
      };
  }
}
