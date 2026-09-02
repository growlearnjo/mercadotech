import { SearchX } from "lucide-react";

import { ProductCard, ProductCardSkeleton } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  PRIORITY_IMAGE_COUNT,
  PRODUCTS_PAGE_SIZE,
} from "@/lib/constants/catalog";
import type { Product } from "@/types/product";

type ProductGridProps = {
  products: Product[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Acción sugerida cuando no hay resultados (ej. "Limpiar filtros"). */
  emptyAction?: React.ReactNode;
  /** product.id -> similitud (0-1). Pinta el badge de coincidencia en la pestaña IA (Fase 4.4). */
  similarityByProductId?: Record<string, number>;
};

/** Columnas: 2 en móvil, 3 en tablet, 4 en desktop — de ahí el page size 12. */
const GRID = "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4";

export function ProductGrid({
  products,
  loading,
  error,
  onRetry,
  emptyAction,
  similarityByProductId,
}: ProductGridProps) {
  if (error) {
    return (
      <ErrorState
        title="No pudimos cargar el catálogo"
        description="Revisa tu conexión e inténtalo de nuevo."
        onRetry={onRetry}
      />
    );
  }

  if (loading) {
    return (
      <div className={GRID} role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando productos</span>
        {Array.from({ length: PRODUCTS_PAGE_SIZE }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="Sin resultados"
        description="No encontramos productos que coincidan. Prueba con otros filtros o menos palabras."
        action={emptyAction}
      />
    );
  }

  return (
    <div className={GRID} data-testid="product-grid">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          similarity={similarityByProductId?.[product.id]}
          // Las primeras del grid son lo que se ve sin desplazar: sin esto,
          // el LCP se lo comía el "Load Delay" de una imagen lazy (Fase 7.2).
          priority={index < PRIORITY_IMAGE_COUNT}
        />
      ))}
    </div>
  );
}
