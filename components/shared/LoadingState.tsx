import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  /**
   * `grid` imita la rejilla del catálogo, `list` una lista de filas y `card`
   * un bloque suelto. Se busca que el esqueleto tenga la forma de lo que va a
   * llegar, para que no salte el layout al cargar.
   */
  variant?: "grid" | "list" | "card";
  /** Cuántos elementos de relleno pintar. */
  count?: number;
  className?: string;
  /** Texto anunciado a lectores de pantalla mientras carga. */
  label?: string;
};

export function LoadingState({
  variant = "grid",
  count = 8,
  className,
  label = "Cargando contenido",
}: LoadingStateProps) {
  const items = Array.from({ length: count });

  return (
    <div
      // `busy` + `polite`: se anuncia el cambio sin interrumpir al usuario.
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        variant === "grid" &&
          "grid grid-cols-2 gap-4 lg:grid-cols-4 md:grid-cols-3",
        variant === "list" && "flex flex-col gap-3",
        className,
      )}
    >
      <span className="sr-only">{label}</span>

      {variant === "grid" &&
        items.map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        ))}

      {variant === "list" &&
        items.map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-14 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ))}

      {variant === "card" && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      )}
    </div>
  );
}
