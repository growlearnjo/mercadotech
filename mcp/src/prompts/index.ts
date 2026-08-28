/**
 * Registro central de Prompts MCP.
 *
 * TERMINOLOGÍA (lección 2 de la spec): esto son "Prompts MCP" — plantillas
 * parametrizadas que el SERVIDOR ofrece por el protocolo a cualquier cliente.
 * NO son Skills de Claude Code (esas viven en .claude/skills/ y no salen por
 * el protocolo), ni el texto que un humano escribe en un chat.
 *
 * Cada prompt es un FORMULARIO, no un motor: obtiene el contenido real por las
 * MISMAS funciones compartidas que usan las tools, lo embebe en el mensaje, y
 * sus instrucciones remiten a las tools existentes si hace falta profundizar.
 * Ninguno reimplementa recuperación ni el pipeline RAG.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProductsByIds } from "@/services/product.service";
import { listByProduct as listQuestions } from "@/services/question.service";
import { listByProduct as listReviews } from "@/services/review.service";
import { createContext } from "../context";
import { describeError } from "../lib/errors";
import { listPublishedArticles } from "../shared/faq";
import { getProductDetail } from "../shared/product-detail";

/** Un prompt siempre devuelve algo útil: si el dato falla, lo dice en el mensaje. */
async function embed(label: string, load: () => Promise<unknown>): Promise<string> {
  try {
    return `${label}:\n${JSON.stringify(await load(), null, 2)}`;
  } catch (error) {
    return (
      `${label}: NO DISPONIBLE (${describeError(error).message}). ` +
      `No inventes este contenido; dilo y detente.`
    );
  }
}

const userMessage = (text: string) => ({
  messages: [{ role: "user" as const, content: { type: "text" as const, text } }],
});

export function registerPrompts(server: McpServer): number {
  server.registerPrompt(
    "describir_producto",
    {
      title: "Redactar la ficha de un producto",
      description:
        "Genera una descripción comercial atractiva y FIEL de un producto del catálogo.",
      argsSchema: { productId: z.string().describe("id del producto (UUID)") },
    },
    async ({ productId }) => {
      const { anon } = createContext();
      const data = await embed("PRODUCTO", () => getProductDetail(productId, anon));
      return userMessage(
        "Redacta la ficha comercial de este producto para MercadoTech.\n\n" +
          "Reglas:\n" +
          "- Usa SOLO los datos de abajo. No inventes especificaciones, garantías, " +
          "plazos de envío ni stock que no aparezcan.\n" +
          "- Tono comercial honesto: entusiasta sin exagerar. Si la condición es " +
          "usado o reacondicionado, dilo con naturalidad, no lo escondas.\n" +
          "- Estructura: un titular, un párrafo de venta y 3-5 viñetas de " +
          "características. Precios en soles (S/).\n" +
          "- Si necesitas comparar con alternativas, usa la tool " +
          "find_related_products; no supongas qué más hay en el catálogo.\n\n" +
          data,
      );
    },
  );

  server.registerPrompt(
    "comparar_productos",
    {
      title: "Comparar productos y recomendar",
      description:
        "Tabla comparativa de 2 a 4 productos más una recomendación por perfil de uso.",
      argsSchema: {
        productIds: z.string().describe("ids separados por coma (entre 2 y 4)"),
      },
    },
    async ({ productIds }) => {
      const ids = productIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      const { anon } = createContext();
      const data = await embed("PRODUCTOS", () => getProductsByIds(ids, anon));
      return userMessage(
        `Compara estos ${ids.length} productos de MercadoTech.\n\n` +
          "Reglas:\n" +
          "- Primero una tabla: característica en filas, un producto por columna. " +
          "Precio, condición, stock, marca y rating.\n" +
          "- Después una recomendación POR PERFIL de uso (quien busca precio, quien " +
          "busca rendimiento), justificada solo con los datos de la tabla.\n" +
          "- No inventes especificaciones que no estén en la descripción.\n" +
          "- Si falta algún id en los datos, dilo explícitamente: comparaste menos " +
          "de lo que se te pidió.\n\n" +
          data,
      );
    },
  );

  server.registerPrompt(
    "redactar_respuesta_pregunta",
    {
      title: "Responder la pregunta de un comprador",
      description:
        "Borrador de respuesta para que el VENDEDOR conteste una pregunta de su producto.",
      argsSchema: {
        productId: z.string().describe("id del producto"),
        questionId: z.string().describe("id de la pregunta a responder"),
      },
    },
    async ({ productId, questionId }) => {
      const { anon } = createContext();
      const data = await embed("CONTEXTO", async () => {
        const [detail, questions] = await Promise.all([
          getProductDetail(productId, anon),
          listQuestions(productId, anon),
        ]);
        // Se proyecta campo por campo A PROPOSITO: la fila cruda de `questions`
        // incluye `user_id`, el identificador del comprador que preguntó, y
        // ninguna salida de este servidor puede llevar identidad de comprador.
        // Embeber la fila entera filtraba ese id al modelo.
        const publicShape = (question: (typeof questions)[number]) => ({
          id: question.id,
          question: question.question,
          answer: question.answer,
          answeredAt: question.answered_at,
        });

        return {
          producto: detail,
          preguntaAResponder:
            questions.filter((question) => question.id === questionId).map(publicShape)[0] ?? null,
          otrasPreguntas: questions
            .filter((question) => question.id !== questionId)
            .map(publicShape),
        };
      });
      return userMessage(
        "Redacta la respuesta del VENDEDOR a la pregunta señalada.\n\n" +
          "Reglas:\n" +
          "- Habla como el vendedor, en segunda persona y con cortesía breve.\n" +
          "- Responde SOLO con lo que consta en el producto. Si el dato no está, " +
          "dilo con honestidad (que lo vas a verificar) en vez de inventarlo: una " +
          "respuesta falsa termina en devolución.\n" +
          "- Máximo 3 frases. Sin saludos largos ni firmas.\n" +
          "- Revisa otrasPreguntas: si ya respondiste algo parecido, sé coherente.\n\n" +
          data,
      );
    },
  );

  server.registerPrompt(
    "resumen_de_resenas",
    {
      title: "Resumir lo que opinan los compradores",
      description: "Pros y contras de un producto según sus reseñas verificadas.",
      argsSchema: { productId: z.string().describe("id del producto") },
    },
    async ({ productId }) => {
      const { anon } = createContext();
      // Proyección explícita, misma razón que en redactar_respuesta_pregunta:
      // la fila cruda de `reviews` incluye `buyer_id`. El service ya anonimiza
      // el nombre con `author_label`, pero el id seguía viajando.
      const data = await embed("RESEÑAS", async () =>
        (await listReviews(productId, anon)).map((review) => ({
          rating: review.rating,
          comment: review.comment,
          author: review.author_label,
          createdAt: review.created_at,
        })),
      );
      return userMessage(
        "Resume lo que dicen los compradores de este producto.\n\n" +
          "Reglas:\n" +
          "- Pros y contras, cada uno respaldado por al menos una reseña real.\n" +
          "- Si hay pocas reseñas, dilo: con N opiniones no hay patrón claro. No " +
          "conviertas una opinión suelta en tendencia.\n" +
          "- No menciones a ningún comprador por nombre (las reseñas ya vienen " +
          "anonimizadas como Comprador verificado).\n" +
          "- Cierra con para quién conviene y para quién no.\n\n" +
          data,
      );
    },
  );

  server.registerPrompt(
    "generar_articulo_faq",
    {
      title: "Redactar un artículo nuevo de la FAQ",
      description:
        "Borrador de artículo de soporte sobre un tema, con el estilo de los existentes.",
      argsSchema: {
        tema: z.string().describe("Tema del artículo, por ejemplo garantía o cambios"),
      },
    },
    async ({ tema }) => {
      const { anon } = createContext();
      const data = await embed("ARTÍCULOS EXISTENTES", () => listPublishedArticles(anon));
      return userMessage(
        `Redacta un artículo nuevo para la FAQ de MercadoTech sobre: ${tema}.\n\n` +
          "Reglas:\n" +
          "- Imita el estilo, la extensión y el tono de los artículos de abajo, y " +
          "reutiliza una de sus categorías si encaja.\n" +
          "- No contradigas ningún artículo existente. Si el tema ya está cubierto, " +
          "dilo y propón ampliar el que ya hay en vez de duplicarlo.\n" +
          "- MercadoTech NO tiene pasarela de pago real: el checkout es simulado. " +
          "Nunca describas cobros, reembolsos a tarjeta ni plazos bancarios.\n" +
          "- Devuelve título, categoría y contenido. Es un BORRADOR: no queda " +
          "publicado hasta que un admin lo apruebe.\n\n" +
          data,
      );
    },
  );

  return 5;
}
