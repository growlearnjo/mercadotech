import { PackageOpen } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  /**
   * Icono opcional. Se pasa el componente, no el elemento, para que este
   * archivo no tenga que conocer el catálogo de iconos.
   */
  icon?: React.ComponentType<{ className?: string }>;
  /** Acción sugerida (ej. "Limpiar filtros"). Es un nodo: quien lo pasa decide. */
  action?: React.ReactNode;
  className?: string;
};

/**
 * "Aquí no hay nada, y es normal": búsqueda sin resultados, carrito vacío,
 * vendedor sin productos. NO es un error, por eso el tono es neutro.
 */
export function EmptyState({
  title,
  description,
  icon: Icon = PackageOpen,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">{title}</p>
        {description ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
