/** Indicador de "escribiendo…" mientras se espera la respuesta del asistente. */
export function LoadingMessage() {
  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">El asistente está escribiendo</span>
        <span className="flex gap-1" aria-hidden="true">
          <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-current" />
        </span>
      </div>
    </div>
  );
}
