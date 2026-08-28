/**
 * Detalle completo de un producto, COMPUESTO de services existentes. Lo
 * comparten la tool `get_product`, el resource `mercadotech://products/{id}`
 * y el prompt `describir_producto`: una sola forma de "detalle" en todo el
 * servidor, en vez de tres que se desincronizan.
 */
import { getProductById, getProductImages } from "@/services/product.service";
import { listByProduct as listQuestions } from "@/services/question.service";
import { getAverage } from "@/services/review.service";
import type { Client } from "../context";
import { notFound } from "../lib/errors";

export async function getProductDetail(productId: string, supabase: Client) {
  const product = await getProductById(productId, supabase);
  if (!product) throw notFound("un producto activo", productId);

  const [images, rating, questions] = await Promise.all([
    getProductImages(productId, supabase),
    getAverage(productId, supabase),
    listQuestions(productId, supabase),
  ]);

  return {
    id: product.id,
    title: product.title,
    description: product.description,
    price: product.price,
    currency: "PEN",
    condition: product.condition,
    stock: product.stock,
    brand: product.brand,
    // El esquema real de `products` no tiene columnas `model` ni `specs`
    // (verificado en types/database.ts): las características van dentro de
    // `description`. No se inventan campos que la base no guarda.
    isActive: product.is_active,
    rating: { average: rating.average, count: rating.count },
    images: images.map((image) => ({ url: image.image_url, position: image.position })),
    // Las preguntas son públicas, pero el autor NO se expone: `profiles` no
    // tiene SELECT público (deuda documentada, bitácora S3) y de todos modos
    // ninguna salida de este servidor lleva identidad de comprador.
    questions: questions.map((question) => ({
      question: question.question,
      answer: question.answer,
      answeredAt: question.answered_at,
    })),
  };
}
