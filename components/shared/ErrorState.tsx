"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  /**
   * Mensaje para la persona, no el error crudo de Supabase. Quien llama
   * traduce el error a algo accionable.
   */
  description?: string;
  /** Si se pasa, se muestra el botón de reintentar. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

/**
 * Algo falló y puede volver a intentarse.
 *
 * Usa `--destructive` con opacidad baja de fondo: marca el problema sin
 * convertir media pantalla en rojo.
 */
export function ErrorState({
  title = "Algo salió mal",
  description = "No pudimos cargar esta información. Vuelve a intentarlo.",
  onRetry,
  retryLabel = "Reintentar",
  className,
}: ErrorStateProps) {
  return (
    <div
      // `alert` para que el lector de pantalla lo anuncie al aparecer.
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center",
        className,
      )}
    >
      <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
