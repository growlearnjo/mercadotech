import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";

type CartIndicatorProps = {
  /** 0 en esta fase; `useCart` lo alimenta en la 3.6. */
  count: number;
  className?: string;
};

/** Tope visual del contador: más de 9 se muestra como "9+". */
const MAX_VISIBLE_COUNT = 9;

export function CartIndicator({ count, className }: CartIndicatorProps) {
  const hasItems = count > 0;

  return (
    <Link
      href="/carrito"
      className={cn(
        "relative inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
      // El número va en el nombre accesible: un "3" suelto no dice nada.
      aria-label={
        hasItems
          ? `Carrito, ${count} ${count === 1 ? "producto" : "productos"}`
          : "Carrito, vacío"
      }
    >
      <span className="relative">
        <ShoppingCart className="size-5" aria-hidden="true" />
        {hasItems ? (
          <span
            aria-hidden="true"
            className="absolute -top-2 -right-2 flex size-4.5 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] leading-none font-semibold text-primary-foreground"
          >
            {count > MAX_VISIBLE_COUNT ? `${MAX_VISIBLE_COUNT}+` : count}
          </span>
        ) : null}
      </span>
      <span className="hidden lg:inline">Carrito</span>
    </Link>
  );
}
