"use client";

import * as React from "react";

import { listCategories } from "@/services/category.service";
import type { Category } from "@/types/product";

/**
 * Caché en memoria a nivel de módulo.
 *
 * Las categorías son 8 filas que no cambian durante la sesión, y el hook lo
 * usan el navbar y el panel de filtros a la vez: sin esto habría una consulta
 * por cada montaje. Se guarda la promesa, no el resultado, para que dos
 * montajes simultáneos compartan la misma petición en vuelo.
 */
let cache: Promise<Category[]> | null = null;

function loadCategories(): Promise<Category[]> {
  if (!cache) {
    cache = listCategories().catch((error) => {
      // Un fallo no debe quedar cacheado: se limpia para poder reintentar.
      cache = null;
      throw error;
    });
  }
  return cache;
}

export function useCategories(): {
  categories: Category[];
  loading: boolean;
  error: string | null;
} {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    loadCategories()
      .then((data) => {
        if (active) setCategories(data);
      })
      .catch(() => {
        if (active) setError("No pudimos cargar las categorías.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { categories, loading, error };
}
