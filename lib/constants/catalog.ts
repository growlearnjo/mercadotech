// Tunables del catálogo. Regla 5 del CLAUDE.md: todo valor ajustable vive
// aquí y lleva un comentario que justifica su elección.

import type { ProductCondition } from "@/lib/constants/roles";

/**
 * Productos por página.
 *
 * 12 es múltiplo de 2, 3 y 4, que son las columnas del grid en móvil, tablet
 * y desktop: así ninguna página deja una fila coja. Con los 14 productos
 * activos del seed da 2 páginas, suficiente para ver la paginación funcionar.
 */
export const PRODUCTS_PAGE_SIZE = 12;

/**
 * Cuántas imágenes del grid se cargan con prioridad (Fase 7.2).
 *
 * Medido, no supuesto: en la home el elemento LCP era una tarjeta del grid con
 * `loading="lazy"`, y Lighthouse móvil atribuía 4055 ms de los 5315 del LCP a
 * "Load Delay" — puro esperar a que el navegador se decidiera a pedirla.
 *
 * 4 es la primera fila en desktop (4 columnas) y las dos primeras en móvil
 * (2 columnas): cubre lo que se ve sin desplazar. Subirlo desperdiciaría datos
 * móviles precargando imágenes que nadie llegó a ver; bajarlo devuelve el LCP
 * al problema original.
 */
export const PRIORITY_IMAGE_COUNT = 4;

/** Criterios de orden. El `value` viaja en la URL, así que es parte del contrato. */
export const SORT_OPTIONS = [
  { value: "recientes", label: "Más recientes" },
  { value: "precio_asc", label: "Menor precio" },
  { value: "precio_desc", label: "Mayor precio" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

/** Orden por defecto: lo recién publicado es lo que da sensación de catálogo vivo. */
export const DEFAULT_SORT: SortOption = "recientes";

/**
 * Rango de precio del filtro, en soles.
 *
 * El techo (10 000) deja holgura sobre el producto más caro del seed (2 199)
 * para que el filtro siga siendo útil cuando se publiquen equipos de gama
 * alta, sin que el control quede desproporcionado.
 */
export const PRICE_RANGE = { min: 0, max: 10_000 } as const;

/** Comprueba que un valor de la URL sea un orden conocido. */
export function isSortOption(value: string): value is SortOption {
  return SORT_OPTIONS.some((option) => option.value === value);
}

/**
 * Filtros que el usuario controla desde la UI y que viven en la URL.
 *
 * Vive aquí y no en `hooks/useProducts` para que los componentes puedan
 * tiparse sin importar un hook: la regla del CLAUDE.md es que `components/`
 * no dependa de `hooks/`.
 */
export type CatalogFilters = {
  condition: ProductCondition[];
  minPrice: number | undefined;
  maxPrice: number | undefined;
  sort: SortOption;
};
