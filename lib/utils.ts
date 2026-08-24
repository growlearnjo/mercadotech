import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formateador único para toda la app. Se crea una sola vez a nivel de módulo:
// construir un Intl.NumberFormat es caro y esto se llama por cada card del grid.
const PRICE_FORMATTER = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un precio como "S/ 1,299.90".
 *
 * Acepta `string` porque las columnas `numeric(12,2)` (price, total,
 * price_snapshot) llegan como string desde PostgREST: aceptarlas aquí evita
 * que cada llamador tenga que acordarse de convertir.
 *
 * Un valor no numérico devuelve "S/ 0.00" en vez de "S/ NaN": es un
 * componente de presentación y no debe romper la pantalla por un dato sucio.
 */
export function formatPrice(value: number | string): string {
  const amount = typeof value === "string" ? Number(value) : value;
  return PRICE_FORMATTER.format(Number.isFinite(amount) ? amount : 0);
}
