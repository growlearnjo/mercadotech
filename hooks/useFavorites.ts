"use client";

import * as React from "react";

import { listMine } from "@/services/favorite.service";
import type { Product } from "@/types/product";

/** Lista completa de favoritos, para /favoritos. */
export function useFavorites(userId: string | null) {
  const [items, setItems] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    listMine(userId)
      .then((data) => {
        if (active) setItems(data);
      })
      .catch(() => {
        if (active) setError("No pudimos cargar tus favoritos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, reloadToken]);

  return { items, loading, error, retry: () => setReloadToken((t) => t + 1) };
}
