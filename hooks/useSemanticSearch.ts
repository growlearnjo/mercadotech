"use client";

import * as React from "react";
import type { Product } from "@/types/product";

export type SemanticSearchResult = { product: Product; similarity: number };

export type UseSemanticSearchResult = {
  results: SemanticSearchResult[];
  loading: boolean;
  error: string | null;
};

/**
 * Búsqueda semántica vía /api/v1/search/semantic. `enabled` la desactiva sin
 * desmontar el hook (ej. mientras la pestaña IA no está visible o no hay
 * sesión) — evita gastar cuota de Hugging Face en consultas que no se ven.
 */
export function useSemanticSearch(
  query: string,
  enabled: boolean,
): UseSemanticSearchResult {
  const [results, setResults] = React.useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled || !query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetch("/api/v1/search/semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(
            body?.error?.message ?? "No pudimos completar la búsqueda.",
          );
        }
        return res.json() as Promise<{ results: SemanticSearchResult[] }>;
      })
      .then((data) => {
        if (active) setResults(data.results ?? []);
      })
      .catch((err) => {
        if (!active) return;
        setResults([]);
        setError(
          err instanceof Error ? err.message : "No pudimos completar la búsqueda.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, enabled]);

  return { results, loading, error };
}
