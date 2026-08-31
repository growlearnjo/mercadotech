import Link from "next/link";

import { ConditionBadge } from "@/components/shared/ConditionBadge";
import { Price } from "@/components/shared/Price";
import { ProductImage } from "@/components/shared/ProductImage";
import { RatingStars } from "@/components/shared/RatingStars";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";

type ProductCardProps = {
  product: Product;
  className?: string;
  /** 0-1. Cuando viene definido (pestaña "Resultados con IA", Fase 4.4) se pinta un badge con el % de coincidencia. */
  similarity?: number;
};

/**
 * Card del grid, con la jerarquía del mockup: badge sobre la imagen, marca en
 * versalitas, título a dos líneas, precio grande y calificación al pie.
 *
 * No conoce Supabase: recibe `image_url` ya resuelta por el service.
 */
export function ProductCard({ product, className, similarity }: ProductCardProps) {
  const outOfStock = product.stock === 0;

  return (
    <Link
      href={`/producto/${product.id}`}
      data-testid="product-card"
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <div className="relative">
        <ProductImage
          src={product.image_url}
          alt={product.title}
          className="aspect-square w-full rounded-none"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        />
        {typeof similarity === "number" ? (
          <span className="absolute top-2 right-2 rounded-4xl bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            {Math.round(similarity * 100)}% match
          </span>
        ) : null}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          <ConditionBadge condition={product.condition} />
          {outOfStock ? (
            // El producto sigue activo, así que aparece en el grid; se avisa
            // aquí para no llevar a nadie a un detalle sin poder comprar.
            <span
              data-testid="product-card-out-of-stock"
              className="rounded-4xl bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              Sin stock
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {product.brand ? (
          <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {product.brand}
          </span>
        ) : null}

        <h3 className="line-clamp-2 text-sm text-foreground group-hover:text-primary">
          {product.title}
        </h3>

        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <Price value={product.price} size="lg" />

          {product.review_count > 0 && product.average_rating !== null ? (
            <div className="flex items-center gap-1.5">
              <RatingStars value={product.average_rating} size="sm" />
              <span className="text-xs text-muted-foreground">
                ({product.review_count})
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/** Esqueleto con la MISMA forma que la card: evita el salto de layout al cargar. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-1 h-7 w-24" />
      </div>
    </div>
  );
}
