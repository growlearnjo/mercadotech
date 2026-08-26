// Instrucciones del sistema para los dos modos del chat (Fase 4.6) y el
// constructor del mensaje de usuario con el contexto recuperado. Se
// centralizan aquí, no en context-builder.ts, para que ese archivo (función
// pura, Fase 4.5) no conozca el formato final del prompt.

/** Fuente ya seleccionada y presupuestada por context-builder.ts (Fase 4.5), lista para citarse por número. */
export interface RagContextSource {
  position: number;
  sourceType: "producto" | "articulo_soporte";
  sourceId: string;
  title: string;
  similarity: number;
  content: string;
}

export const SHOPPING_SYSTEM_INSTRUCTIONS =
  "Eres el asesor de compras de MercadoTech, un marketplace de productos " +
  "tecnológicos. Respondes preguntas de los usuarios utilizando " +
  "ÚNICAMENTE la información de los productos numerados que se incluyen a " +
  "continuación. No utilices conocimiento externo ni inventes " +
  "características, precios o stock que no estén en esas fuentes. Si " +
  "ningún producto del contexto responde a lo que pide el usuario, dilo " +
  "explícitamente ('no encontré productos que coincidan con tu búsqueda') " +
  "en vez de sugerir algo no verificado. Cuando recomiendes un producto, " +
  "cita su número entre corchetes (por ejemplo [1] o [2, 3]). Responde en " +
  "español, en un tono cercano y útil.";

// Respuestas CORTAS y CLARAS a propósito: la sesión 8 agrega un agente de
// voz sobre este mismo modo, y ese texto se leerá en voz alta.
export const SUPPORT_SYSTEM_INSTRUCTIONS =
  "Eres el asistente de soporte de MercadoTech. Respondes preguntas de los " +
  "usuarios utilizando ÚNICAMENTE la información de los artículos de la " +
  "FAQ numerados que se incluyen a continuación. No utilices conocimiento " +
  "externo ni inventes políticas o procedimientos que no estén en esas " +
  "fuentes. Si ningún artículo del contexto responde la consulta, dilo " +
  "explícitamente y sugiere al usuario crear un ticket de soporte para que " +
  "un agente humano lo revise. Cuando cites un artículo, hazlo por su " +
  "número entre corchetes (por ejemplo [1]). Responde en español, con tono " +
  "cordial, y en respuestas CORTAS y CLARAS: se leerán en voz alta desde la " +
  "sesión 8.";

const NO_SOURCES_NOTICE =
  "No se encontraron fuentes suficientemente relevantes en MercadoTech " +
  "para responder esta consulta. Indícaselo al usuario en vez de responder " +
  "con información no verificada.";

function formatSourceBlock(source: RagContextSource): string {
  return [
    `[Fuente ${source.position}]`,
    `Tipo: ${source.sourceType}`,
    `Título: ${source.title}`,
    `Similitud: ${source.similarity.toFixed(3)}`,
    "---",
    source.content,
  ].join("\n");
}

/**
 * Construye el turno de usuario: contexto recuperado (o el aviso de "sin
 * fuentes") + la consulta al final — la práctica estándar de prompting: lo
 * más cercano al punto donde el modelo empieza a generar pesa más.
 */
export function buildRagUserMessage(
  query: string,
  sources: RagContextSource[],
): string {
  const sections: string[] = [];

  if (sources.length === 0) {
    sections.push(NO_SOURCES_NOTICE);
  } else {
    sections.push(
      "=== CONTEXTO RECUPERADO ===",
      sources.map(formatSourceBlock).join("\n\n===\n\n"),
      "=== FIN DEL CONTEXTO ===",
    );
  }

  sections.push(`Consulta del usuario: ${query}`);

  return sections.join("\n\n");
}
