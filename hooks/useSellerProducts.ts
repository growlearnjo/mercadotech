"use client";

import * as React from "react";

import * as sellerService from "@/services/seller.service";
import { ProductHasSalesError } from "@/services/seller.service";
import { triggerReindex } from "@/services/indexing-trigger.service";
import type { Product } from "@/types/product";

export function useSellerProducts(sellerId: string | null) {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    if (!sellerId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    sellerService
      .listMyProducts(sellerId)
      .then((data) => {
        if (active) setProducts(data);
      })
      .catch(() => {
        if (active) setError("No pudimos cargar tus productos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sellerId, reloadToken]);

  const toggleActive = React.useCallback(
    async (productId: string, isActive: boolean) => {
      const previous = products;
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_active: isActive } : p)),
      );
      try {
        await sellerService.toggleActive(productId, isActive);
        // Best-effort (Fase 4.3): activo → (re)indexa; inactivo → el
        // service detecta is_active=false y borra la ficha.
        triggerReindex("producto", productId);
        return true;
      } catch {
        setProducts(previous);
        return false;
      }
    },
    [products],
  );

  /** Devuelve el mensaje de error, o null si se eliminó. */
  const remove = React.useCallback(
    async (productId: string): Promise<string | null> => {
      try {
        await sellerService.deleteProduct(productId);
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        // Best-effort (Fase 4.3, decisión 6): el producto ya no existe, el
        // service detecta la ausencia y limpia la ficha huérfana.
        triggerReindex("producto", productId);
        return null;
      } catch (err) {
        if (err instanceof ProductHasSalesError) return err.message;
        return "No pudimos eliminar el producto.";
      }
    },
    [],
  );

  return {
    products,
    loading,
    error,
    toggleActive,
    remove,
    reload: () => setReloadToken((t) => t + 1),
  };
}
