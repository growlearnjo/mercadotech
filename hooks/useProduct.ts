"use client";

import * as React from "react";

import {
  getProductById,
  getProductImages,
  registerView,
} from "@/services/product.service";
import type { Product, ProductImage } from "@/types/product";

export function useProduct(
  productId: string,
  /** Usuario actual; `null` si es anónimo. Solo se usa para registrar la vista. */
  userId: string | null,
) {
  const [product, setProduct] = React.useState<Product | null>(null);
  const [images, setImages] = React.useState<ProductImage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([getProductById(productId), getProductImages(productId)])
      .then(([p, imgs]) => {
        if (!active) return;
        setProduct(p);
        setImages(imgs);
        if (!p) setError("Este producto no existe o ya no está disponible.");
      })
      .catch(() => {
        if (active) setError("No pudimos cargar el producto.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId, reloadToken]);

  // Métrica de vista: solo con sesión (product_views.user_id es NOT NULL) y
  // sin await ni propagación de error — que falle una métrica no debe afectar
  // a la ficha.
  React.useEffect(() => {
    if (!userId) return;
    registerView(productId, userId).catch(() => {});
  }, [productId, userId]);

  return {
    product,
    images,
    loading,
    error,
    retry: () => setReloadToken((t) => t + 1),
  };
}
