"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { listActiveProducts } from "@/services/product.service";
import {
  DEFAULT_SORT,
  PRODUCTS_PAGE_SIZE,
  isSortOption,
  type CatalogFilters,
} from "@/lib/constants/catalog";
import { PRODUCT_CONDITIONS, type ProductCondition } from "@/lib/constants/roles";
import type { Product } from "@/types/product";

type UseProductsOptions = {
  /** Fijado por la ruta en /categoria/[slug]; no editable desde los filtros. */
  categorySlug?: string;
  /** Fijado por ?q= en /buscar. */
  search?: string;
};

export type UseProductsResult = {
  items: Product[];
  total: number;
  page: number;
  totalPages: number;
  filters: CatalogFilters;
  loading: boolean;
  error: string | null;
  /**
   * Aplica uno o varios filtros en UNA sola escritura de la URL.
   *
   * Recibe un parcial y no (clave, valor) a propósito: dos llamadas seguidas
   * leerían el mismo snapshot de `searchParams` y el segundo `router.push`
   * pisaría al primero. Es justo lo que pasaba al confirmar el rango de
   * precio, que fija mínimo y máximo a la vez.
   */
  setFilters: (partial: Partial<CatalogFilters>) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
  retry: () => void;
};

function parseConditions(raw: string | null): ProductCondition[] {
  if (!raw) return [];
  return raw
    .split(",")
    .filter((value): value is ProductCondition =>
      (PRODUCT_CONDITIONS as readonly string[]).includes(value),
    );
}

function parsePrice(raw: string | null): number | undefined {
  if (raw === null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Estado del catálogo con los filtros en la URL.
 *
 * Que la URL sea la fuente de verdad tiene tres ventajas concretas: el estado
 * se puede compartir por enlace, sobrevive a un F5, y el botón atrás del
 * navegador deshace un filtro en vez de sacarte del catálogo.
 */
export function useProducts({
  categorySlug,
  search,
}: UseProductsOptions = {}): UseProductsResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = React.useState<Product[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  const sortParam = searchParams.get("sort");
  const filters: CatalogFilters = React.useMemo(
    () => ({
      condition: parseConditions(searchParams.get("condition")),
      minPrice: parsePrice(searchParams.get("minPrice")),
      maxPrice: parsePrice(searchParams.get("maxPrice")),
      sort: sortParam && isSortOption(sortParam) ? sortParam : DEFAULT_SORT,
    }),
    [searchParams, sortParam],
  );

  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);

  // Clave estable de los filtros: evita relanzar la consulta cuando cambia la
  // identidad del array pero no su contenido.
  const conditionKey = filters.condition.join(",");

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    listActiveProducts({
      categorySlug,
      search,
      condition: conditionKey ? (conditionKey.split(",") as ProductCondition[]) : [],
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      sort: filters.sort,
      page,
    })
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
        setTotal(0);
        setError("No pudimos cargar el catálogo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    categorySlug,
    search,
    conditionKey,
    filters.minPrice,
    filters.maxPrice,
    filters.sort,
    page,
    reloadToken,
  ]);

  /** Escribe los parámetros en la URL sin perder los que no se tocan (ej. ?q=). */
  const pushParams = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      // `scroll: false`: al filtrar, el usuario quiere ver el grid cambiar,
      // no que la página salte al inicio.
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setFilters = React.useCallback(
    (partial: Partial<CatalogFilters>) => {
      pushParams((params) => {
        if ("condition" in partial) {
          const list = partial.condition ?? [];
          if (list.length > 0) params.set("condition", list.join(","));
          else params.delete("condition");
        }
        if ("sort" in partial && partial.sort) {
          if (partial.sort !== DEFAULT_SORT) params.set("sort", partial.sort);
          else params.delete("sort");
        }
        for (const key of ["minPrice", "maxPrice"] as const) {
          if (!(key in partial)) continue;
          const price = partial[key];
          if (typeof price === "number") params.set(key, String(price));
          else params.delete(key);
        }
        // Cambiar un filtro invalida la página actual: la 3 de un resultado
        // filtrado puede no existir.
        params.delete("page");
      });
    },
    [pushParams],
  );

  const clearFilters = React.useCallback(() => {
    pushParams((params) => {
      for (const key of ["condition", "minPrice", "maxPrice", "sort", "page"]) {
        params.delete(key);
      }
    });
  }, [pushParams]);

  const setPage = React.useCallback(
    (next: number) => {
      pushParams((params) => {
        if (next <= 1) params.delete("page");
        else params.set("page", String(next));
      });
    },
    [pushParams],
  );

  const retry = React.useCallback(() => setReloadToken((t) => t + 1), []);

  return {
    items,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE)),
    filters,
    loading,
    error,
    setFilters,
    clearFilters,
    setPage,
    retry,
  };
}
