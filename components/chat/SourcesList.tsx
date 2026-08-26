import Link from "next/link";

import { Price } from "@/components/shared/Price";
import { ProductImage } from "@/components/shared/ProductImage";
import type { ChatSource } from "@/types/chat";

type SourcesListProps = {
  sources: ChatSource[];
};

/**
 * Fuentes citadas por el asistente, navegables. Puro: solo props, no conoce
 * el endpoint ni Supabase (regla de la Fase 4.7).
 * - producto: mini-card con imagen y precio, enlaza a /producto/[id].
 * - artículo: título con ancla hacia /soporte (su página propia llega
 *   después de esta sesión).
 */
export function SourcesList({ sources }: SourcesListProps) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-border/60 pt-2">
      <p className="text-xs font-medium text-muted-foreground">Fuentes</p>
      <ul className="flex flex-col gap-1.5">
        {sources.map((source) =>
          source.sourceType === "producto" ? (
            <li key={`${source.sourceType}-${source.sourceId}`}>
              <Link
                href={`/producto/${source.sourceId}`}
                className="flex items-center gap-2 rounded-md border border-border bg-background p-1.5 text-xs transition-colors hover:border-primary"
              >
                <ProductImage
                  src={source.imageUrl}
                  alt={source.title}
                  className="size-10 shrink-0 rounded"
                />
                <span className="flex-1">
                  <span className="line-clamp-2">{source.title}</span>
                  {typeof source.price === "number" ? (
                    <Price value={source.price} size="sm" className="block" />
                  ) : null}
                </span>
              </Link>
            </li>
          ) : (
            <li key={`${source.sourceType}-${source.sourceId}`}>
              <Link
                href={`/soporte#articulo-${source.sourceId}`}
                className="block rounded-md border border-border bg-background p-1.5 text-xs transition-colors hover:border-primary"
              >
                {source.title}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
