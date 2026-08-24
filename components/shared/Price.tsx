import { cn, formatPrice } from "@/lib/utils";

type PriceProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** Acepta string porque `numeric(12,2)` llega así desde PostgREST. */
  value: number | string;
  size?: "sm" | "md" | "lg" | "xl";
};

const SIZES: Record<NonNullable<PriceProps["size"]>, string> = {
  sm: "text-sm font-medium",
  md: "text-lg font-semibold",
  // Precio de la card del catálogo.
  lg: "text-2xl font-semibold tracking-tight",
  // Precio del BuyBox en el detalle del producto.
  xl: "text-3xl font-semibold tracking-tight",
};

/**
 * Precio ya formateado como moneda peruana.
 *
 * Se apoya en `formatPrice`, que separa "S/" de la cifra con un espacio duro
 * para que nunca queden en líneas distintas.
 */
export function Price({ value, size = "md", className, ...props }: PriceProps) {
  return (
    <span
      className={cn("text-foreground tabular-nums", SIZES[size], className)}
      {...props}
    >
      {formatPrice(value)}
    </span>
  );
}
