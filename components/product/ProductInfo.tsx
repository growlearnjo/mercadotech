import { ConditionBadge } from "@/components/shared/ConditionBadge";
import { Price } from "@/components/shared/Price";
import { RatingStars } from "@/components/shared/RatingStars";
import type { Product } from "@/types/product";

type ProductInfoProps = {
  product: Product;
  /** Promedio y conteo vienen de useReviews: son más frescos que los del listado. */
  averageRating: number | null;
  reviewCount: number;
};

export function ProductInfo({
  product,
  averageRating,
  reviewCount,
}: ProductInfoProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ConditionBadge condition={product.condition} />
        {product.brand ? (
          <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {product.brand}
          </span>
        ) : null}
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>

      {reviewCount > 0 && averageRating !== null ? (
        <div className="flex items-center gap-2">
          <RatingStars value={averageRating} size="sm" />
          <span className="text-sm text-muted-foreground">
            {averageRating.toFixed(1)} · {reviewCount}{" "}
            {reviewCount === 1 ? "reseña" : "reseñas"}
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Aún sin reseñas</p>
      )}

      <Price value={product.price} size="xl" />

      <p className="text-sm text-muted-foreground">
        {product.stock > 0
          ? `${product.stock} ${product.stock === 1 ? "unidad disponible" : "unidades disponibles"}`
          : "Sin stock"}
      </p>

      {product.description ? (
        <div className="flex flex-col gap-2 pt-2">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-foreground uppercase">
            Descripción
          </h2>
          <p className="text-sm whitespace-pre-line text-muted-foreground">
            {product.description}
          </p>
        </div>
      ) : null}
    </div>
  );
}
