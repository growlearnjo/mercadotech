"use client";

import * as React from "react";

import * as favoriteService from "@/services/favorite.service";

/** Estado de favorito de UN producto. La lista completa la da `useFavorites`. */
export function useFavorite(productId: string, userId: string | null) {
  const [isFavorite, setIsFavorite] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!userId) {
      setIsFavorite(false);
      return;
    }
    let active = true;
    favoriteService
      .isFavorite(productId, userId)
      .then((value) => {
        if (active) setIsFavorite(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [productId, userId]);

  const toggle = React.useCallback(async () => {
    if (!userId) return false;
    setLoading(true);
    // Optimista: el corazón responde al instante; si falla, se revierte.
    const previous = isFavorite;
    setIsFavorite(!previous);
    try {
      const result = await favoriteService.toggle(productId, userId);
      setIsFavorite(result);
      return result;
    } catch {
      setIsFavorite(previous);
      return previous;
    } finally {
      setLoading(false);
    }
  }, [productId, userId, isFavorite]);

  return { isFavorite, loading, toggle };
}
