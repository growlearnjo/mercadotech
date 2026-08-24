// Tunables del formulario de producto. Los límites de imagen COINCIDEN a
// propósito con los del bucket (migración de la Fase 2.4): validarlos en el
// cliente da un error legible antes de que Storage devuelva un 413 opaco.

/** Mínimo para que un título diga algo ("SSD" no basta). */
export const TITLE_MIN = 5;
/** Máximo: cabe en dos líneas de la card sin romper el grid. */
export const TITLE_MAX = 120;

/** Tope de la galería: más de 6 miniaturas no caben sin scroll incómodo. */
export const MAX_IMAGES_PER_PRODUCT = 6;

/** 5 MB — el mismo `file_size_limit` del bucket product-images. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Los mismos `allowed_mime_types` del bucket. */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Extensión a usar en el path de Storage según el tipo MIME. */
export const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
