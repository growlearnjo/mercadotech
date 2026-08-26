// Único archivo del proyecto (junto con completion.ts y prompts.ts) que
// conoce la API de Hugging Face. Nada fuera de lib/ai/ importa
// @huggingface/* (criterio de aceptación con grep, sesión 4).
//
// Embeddings SOLO con el SDK oficial (Guía Hugging Face, lección 1):
// Hugging Face documenta que feature-extraction NO está disponible en su
// endpoint REST OpenAI-compatible — un fetch directo falla. Es el único
// lugar del proyecto donde se usa un SDK en vez de fetch; lib/ai/completion.ts
// hace justo lo contrario (fetch, sin SDK) porque el chat SÍ está soportado
// por el router.
import { InferenceClient } from "@huggingface/inference";
import {
  EMBEDDING_MODEL_DEFAULT,
  MAX_EMBEDDING_INPUT_CHARS,
} from "@/lib/constants/ai";

export interface GenerateEmbeddingResult {
  embedding: number[];
  model: string;
}

let client: InferenceClient | null = null;

function getClient(apiKey: string): InferenceClient {
  if (client) return client;
  client = new InferenceClient(apiKey);
  return client;
}

/**
 * Genera el embedding de un texto con el modelo configurado
 * (HUGGINGFACE_EMBEDDING_MODEL, o EMBEDDING_MODEL_DEFAULT si no está
 * fijado). Valida la forma del vector (lección 5 de la Guía HF):
 * all-MiniLM-L6-v2 devuelve un vector plano de 384 números; otros modelos
 * devuelven una matriz por token (number[][]) — se rechaza cualquier otra
 * forma en vez de insertar una fila corrupta en knowledge_embeddings.
 */
export async function generateEmbedding(
  text: string,
): Promise<GenerateEmbeddingResult> {
  const apiKey = process.env.HUGGINGFACEHUB_API_TOKEN;
  if (!apiKey) {
    throw new Error(
      "HUGGINGFACEHUB_API_TOKEN no está configurada. Es requerida para generar embeddings.",
    );
  }

  const model = process.env.HUGGINGFACE_EMBEDDING_MODEL || EMBEDDING_MODEL_DEFAULT;

  const result = await getClient(apiKey).featureExtraction({ model, inputs: text });

  if (!Array.isArray(result) || result.some((value) => typeof value !== "number")) {
    throw new Error(
      "Respuesta inválida del proveedor de embeddings: se esperaba un vector numérico plano.",
    );
  }

  return { embedding: result as number[], model };
}

/**
 * Serializa un embedding al formato de literal que espera pgvector por
 * PostgREST: "[0.1,0.2,...]". Tanto el upsert en knowledge_embeddings como
 * el parámetro query_embedding de match_knowledge viajan como este string
 * (types/database.ts genera `embedding: string`, no `number[]`).
 */
export function toPgVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

interface ProductEmbeddingSource {
  title: string;
  brand: string | null;
  categoryName: string | null;
  condition: string;
  description: string | null;
}

/**
 * Arma el texto a vectorizar de un producto. Secciones etiquetadas en orden
 * de mayor a menor densidad semántica — título, marca, categoría y condición
 * primero, descripción (la más larga) al final — para que un eventual
 * truncado a MAX_EMBEDDING_INPUT_CHARS se coma lo menos importante (lección
 * 4 de la Guía HF).
 */
export function buildProductEmbeddingText(product: ProductEmbeddingSource): string {
  const sections: string[] = [`Título: ${product.title}`];

  if (product.brand) sections.push(`Marca: ${product.brand}`);
  if (product.categoryName) sections.push(`Categoría: ${product.categoryName}`);
  sections.push(`Condición: ${product.condition}`);
  if (product.description) sections.push(`Descripción: ${product.description}`);

  const fullText = sections.join("\n");
  return fullText.length <= MAX_EMBEDDING_INPUT_CHARS
    ? fullText
    : fullText.slice(0, MAX_EMBEDDING_INPUT_CHARS);
}

interface SupportArticleEmbeddingSource {
  title: string;
  category: string | null;
  content: string;
}

/** Mismo criterio que buildProductEmbeddingText: señales cortas primero, contenido largo al final. */
export function buildSupportArticleEmbeddingText(
  article: SupportArticleEmbeddingSource,
): string {
  const sections: string[] = [`Título: ${article.title}`];

  if (article.category) sections.push(`Categoría: ${article.category}`);
  sections.push(`Contenido: ${article.content}`);

  const fullText = sections.join("\n");
  return fullText.length <= MAX_EMBEDDING_INPUT_CHARS
    ? fullText
    : fullText.slice(0, MAX_EMBEDDING_INPUT_CHARS);
}
