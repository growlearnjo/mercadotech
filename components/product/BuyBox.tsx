"use client";

import * as React from "react";
import { Heart, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Price } from "@/components/shared/Price";
import { cn } from "@/lib/utils";

type BuyBoxProps = {
  price: number;
  stock: number;
  isActive: boolean;
  /** El vendedor no puede comprarse a sí mismo. */
  isOwner: boolean;
  isFavorite: boolean;
  favoriteLoading?: boolean;
  addingToCart?: boolean;
  onAddToCart: (quantity: number) => void;
  onToggleFavorite: () => void;
};

/** Motivo por el que no se puede comprar, o null si sí se puede. */
function blockedReason({
  isActive,
  isOwner,
  stock,
}: Pick<BuyBoxProps, "isActive" | "isOwner" | "stock">): string | null {
  if (!isActive) return "Este producto ya no está publicado.";
  if (isOwner) return "Es tu propio producto.";
  if (stock === 0) return "Sin stock por ahora.";
  return null;
}

export function BuyBox({
  price,
  stock,
  isActive,
  isOwner,
  isFavorite,
  favoriteLoading,
  addingToCart,
  onAddToCart,
  onToggleFavorite,
}: BuyBoxProps) {
  const [quantity, setQuantity] = React.useState(1);
  const blocked = blockedReason({ isActive, isOwner, stock });

  return (
    <aside
      data-testid="buy-box"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
    >
      <Price value={price} size="xl" data-testid="buy-box-price" />

      {blocked ? (
        <p
          data-testid="buy-box-blocked"
          className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          {blocked}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quantity">Cantidad</Label>
          <select
            id="quantity"
            data-testid="buy-box-quantity"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {/* Tope real: no se puede pedir más de lo que hay. */}
            {Array.from({ length: Math.min(stock, 10) }, (_, i) => i + 1).map(
              (n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ),
            )}
          </select>
        </div>
      )}

      <Button
        onClick={() => onAddToCart(quantity)}
        disabled={Boolean(blocked) || addingToCart}
        data-testid="buy-box-add-to-cart"
        className="w-full"
      >
        <ShoppingCart className="size-4" aria-hidden="true" />
        {addingToCart ? "Agregando…" : "Agregar al carrito"}
      </Button>

      <Button
        variant="outline"
        onClick={onToggleFavorite}
        disabled={favoriteLoading}
        aria-pressed={isFavorite}
        data-testid="buy-box-favorite"
        className="w-full"
      >
        <Heart
          className={cn("size-4", isFavorite && "fill-current text-destructive")}
          aria-hidden="true"
        />
        {isFavorite ? "En favoritos" : "Agregar a favoritos"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Compra simulada: no se procesa ningún pago real.
      </p>
    </aside>
  );
}
