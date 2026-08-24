import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProductCondition } from "@/lib/constants/roles";

/**
 * Etiqueta y color por condición. Los colores salen de los tokens semánticos
 * de `globals.css` (--success / --warning), no de valores hardcodeados:
 * "nuevo" comparte el verde de "envío gratis" y "reacondicionado" el óxido del
 * badge de descuento del mockup. "usado" es deliberadamente neutro.
 */
const CONDITION_STYLES: Record<
  ProductCondition,
  { label: string; className: string }
> = {
  nuevo: {
    label: "Nuevo",
    className: "bg-success text-success-foreground",
  },
  usado: {
    label: "Usado",
    className: "bg-secondary text-secondary-foreground",
  },
  reacondicionado: {
    label: "Reacondicionado",
    className: "bg-warning text-warning-foreground",
  },
};

type ConditionBadgeProps = Omit<
  React.ComponentProps<typeof Badge>,
  "variant" | "children"
> & {
  condition: ProductCondition;
};

export function ConditionBadge({
  condition,
  className,
  ...props
}: ConditionBadgeProps) {
  const { label, className: toneClassName } = CONDITION_STYLES[condition];

  return (
    // `transition-none` sustituye al `transition-all` que trae Badge de serie
    // (twMerge resuelve el conflicto). Animar `background-color` sobre un color
    // que viene de una variable CSS deja el badge anclado al color del tema
    // anterior al cambiar claro/oscuro; el color aquí es fijo y no necesita
    // transición.
    <Badge className={cn("transition-none", toneClassName, className)} {...props}>
      {label}
    </Badge>
  );
}
