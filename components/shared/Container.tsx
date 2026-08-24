import { cn } from "@/lib/utils";

type ContainerProps = React.ComponentProps<"div"> & {
  /** `wide` para grids de catálogo; `narrow` para formularios y texto largo. */
  width?: "narrow" | "default" | "wide";
};

const WIDTHS: Record<NonNullable<ContainerProps["width"]>, string> = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  // El grid del catálogo llega a 4 columnas; por debajo de 80rem se aprieta.
  wide: "max-w-[80rem]",
};

/**
 * Ancho máximo centrado + padding lateral responsive.
 *
 * Es el único sitio donde vive esa medida: si el layout cambia, se cambia aquí
 * y no en cada pantalla.
 */
export function Container({
  width = "default",
  className,
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        WIDTHS[width],
        className,
      )}
      {...props}
    />
  );
}
