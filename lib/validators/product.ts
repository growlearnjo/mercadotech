// Validación del formulario de producto. Pura, sin React ni Supabase.

import { TITLE_MAX, TITLE_MIN } from "@/lib/constants/product";
import { PRODUCT_CONDITIONS, type ProductCondition } from "@/lib/constants/roles";

export type ProductInput = {
  title: string;
  description: string;
  brand: string;
  categoryId: string;
  condition: ProductCondition;
  price: number;
  stock: number;
  /** Cuántas imágenes tendrá el producto (locales + ya guardadas). */
  imageCount: number;
};

export type ProductErrors = Partial<Record<keyof ProductInput, string>>;

export function validateProduct(input: ProductInput): {
  ok: boolean;
  errors: ProductErrors;
} {
  const errors: ProductErrors = {};

  const title = input.title.trim();
  if (title.length < TITLE_MIN) {
    errors.title = `El título debe tener al menos ${TITLE_MIN} caracteres.`;
  } else if (title.length > TITLE_MAX) {
    errors.title = `El título no puede pasar de ${TITLE_MAX} caracteres.`;
  }

  if (!input.categoryId) {
    errors.categoryId = "Elige una categoría.";
  }

  if (!PRODUCT_CONDITIONS.includes(input.condition)) {
    errors.condition = "Elige la condición del producto.";
  }

  if (!Number.isFinite(input.price) || input.price <= 0) {
    errors.price = "El precio debe ser mayor que 0.";
  }

  if (!Number.isInteger(input.stock) || input.stock < 0) {
    errors.stock = "El stock debe ser 0 o más.";
  }

  // Sin imagen el producto se ve como un hueco en el catálogo.
  if (input.imageCount < 1) {
    errors.imageCount = "Agrega al menos una imagen.";
  }

  return { ok: Object.keys(errors).length === 0, errors };
}
