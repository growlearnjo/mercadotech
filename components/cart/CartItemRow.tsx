"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Price } from "@/components/shared/Price";
import { ProductImage } from "@/components/shared/ProductImage";

type CartItemRowProps = {
  id: string;
  quantity: number;
  product: {
    id: string;
    title: string;
    price: number;
    stock: number;
    image_url: string | null;
  } | null;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
};

export function CartItemRow({
  quantity,
  product,
  onQuantityChange,
  onRemove,
}: CartItemRowProps) {
  // Producto desactivado: RLS lo oculta y llega como null. No se puede enlazar
  // ni comprar, solo quitarlo del carrito.
  if (!product) {
    return (
      <li
        data-testid="cart-item-unavailable"
        className="flex items-center gap-4 border-b border-border py-4"
      >
        <div className="flex size-20 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
          N/D
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Producto ya no disponible</p>
          <p className="text-sm text-muted-foreground">
            El vendedor lo despublicó. Quítalo para poder finalizar la compra.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          data-testid="cart-item-remove"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Quitar
        </Button>
      </li>
    );
  }

  return (
    <li
      data-testid="cart-item"
      className="flex flex-wrap items-center gap-4 border-b border-border py-4"
    >
      <ProductImage
        src={product.image_url}
        alt={product.title}
        className="size-20 shrink-0"
        sizes="80px"
      />

      <div className="min-w-0 flex-1">
        <Link
          href={`/producto/${product.id}`}
          className="line-clamp-2 text-sm hover:text-primary"
        >
          {product.title}
        </Link>
        <Price value={product.price} size="sm" className="mt-1 block" />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor={`qty-${product.id}`} className="sr-only">
          Cantidad de {product.title}
        </label>
        <select
          id={`qty-${product.id}`}
          data-testid="cart-item-quantity"
          value={quantity}
          onChange={(event) => onQuantityChange(Number(event.target.value))}
          className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {Array.from({ length: Math.max(1, Math.min(product.stock, 10)) },
            (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <Price
          value={product.price * quantity}
          size="md"
          data-testid="cart-item-subtotal"
        />

        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          data-testid="cart-item-remove"
          aria-label={`Quitar ${product.title} del carrito`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
